import OpenAI from "openai"
import { readTool } from "./tools/read.js"
import { bashTool } from "./tools/bash.js"
import { writeTool } from "./tools/write.js"
import { editTool } from "./tools/edit.js"
import { globTool } from "./tools/glob.js"
import { grepTool } from "./tools/grep.js"
import { webSearchTool } from "./tools/web_search.js"
import { todoWriteTool, todoReadTool } from "./tools/todo.js"
import { taskTool, taskResultTool, initTaskTool } from "./tools/task.js"
import { codeOutlineTool, codeDefinitionTool, codeContextTool } from "./tools/optimizer.js"
import { generateParserTool } from "./tools/generate_parser.js"
import { loadMemory } from "./memory.js"
import { loadMcpTools } from "./mcp.js"
import { checkPermission } from "./permissions.js"
import { runHooks } from "./hooks.js"
import { compactIfNeeded } from "./compactor.js"
import { getModel, printReasoning } from "./thinking.js"
import { getConfig, saveConfig } from "./config.js"
import { arm, disarm } from "./interrupt.js"
import { isFileTool, cacheCheck, cacheSet } from "./file_cache.js"
import { c } from "./ui.js"
import { print, emit } from "./output.js"
import {
  getMessages, setMessages, pushMessage,
  createCheckpoint, incrementTurn
} from "./session.js"

let client = null

function getClient() {
  if (!client) client = new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY
  })
  return client
}

let _initialized = false
let TOOLS = []
let _mcpTools = []

const OPTIMIZER_TOOLS = [codeOutlineTool, codeDefinitionTool, codeContextTool, generateParserTool]

export function rebuildTools() {
  const { disallowedTools, optimizer } = getConfig()

  TOOLS = [
    readTool, bashTool, writeTool, editTool,
    globTool, grepTool, webSearchTool,
    todoWriteTool, todoReadTool,
    taskTool, taskResultTool,
    ..._mcpTools,
    ...(optimizer ? OPTIMIZER_TOOLS : [])
  ].filter(t => !disallowedTools.includes(t.name))

  _openAITools = null // сбросить кеш
}

async function initialize() {
  if (_initialized) return
  _initialized = true

  _mcpTools = await loadMcpTools()
  rebuildTools()
  initTaskTool(agentLoop)
}

let _openAITools = null
function buildOpenAITools() {
  if (!_openAITools) {
    _openAITools = TOOLS.map(t => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }))
  }
  return _openAITools
}

async function executeTool(name, args) {
  const tool = TOOLS.find(t => t.name === name)
  if (!tool) return `Unknown tool: ${name}`

  const allowed = await runHooks("PreToolUse", { tool: name, args })
  if (!allowed) return `Blocked by PreToolUse hook`

  if (!tool.isReadOnly) {
    const perm = await checkPermission(name, args)
    if (!perm.allowed) return `Rejected: ${perm.reason}`
  }

  let result
  try {
    result = await tool.execute(args)
  } catch (err) {
    result = `Error: ${err.message}`
  }

  await runHooks("PostToolUse", { tool: name, args, result: String(result).slice(0, 500) })
  return result
}

function formatToolCall(name, args) {
  switch (name) {
    case "read_file":    return `Read ${args.path}`
    case "write_file":   return `Write ${args.path}`
    case "edit_file":    return `Edit ${args.path}`
    case "bash":         return `Bash ${(args.command ?? "").slice(0, 72)}`
    case "glob":         return `Glob ${args.pattern}${args.cwd ? ` in ${args.cwd}` : ""}`
    case "grep":         return `Grep "${args.pattern}"${args.dir ? ` in ${args.dir}` : ""}`
    case "web_search":   return `Search "${args.query}"`
    case "todo_read":    return `Todo read`
    case "todo_write":   return `Todo write`
    case "task":         return `Task ${(args.description ?? args.parallel?.join(", ") ?? "").slice(0, 60)}`
    case "code_outline":    return `Outline ${args.path}`
    case "code_definition": return `Definition ${args.name} in ${args.path}`
    case "code_context":    return `Context line ${args.line} in ${args.path}`
    default:             return `${name} ${JSON.stringify(args).slice(0, 60)}`
  }
}

function formatToolResult(name, args, result) {
  // write_file и edit_file уже вывели diff сами — ничего не добавляем
  if (name === "write_file" || name === "edit_file") return null

  if (name === "read_file") {
    const lines = result.split("\n").length
    return `${lines} строк, ${result.length} символов`
  }

  if (name === "glob") {
    const files = result.split("\n").filter(Boolean)
    return files.length ? `${files.length} файлов` : "нет совпадений"
  }

  if (name === "grep") {
    if (result === "No matches found.") return "нет совпадений"
    const count = result.split("\n").filter(Boolean).length
    return `${count} совпадений`
  }

  if (name === "code_outline") {
    const count = result.split("\n").filter(Boolean).length
    return `${count} символов`
  }

  if (name === "code_definition" || name === "code_context") {
    const lines = result.split("\n").length
    return `${lines} строк`
  }

  if (name === "web_search") {
    return result.slice(0, 120) + (result.length > 120 ? "…" : "")
  }

  // bash и остальные — показываем вывод как есть (он уже обрезан в bash.js)
  const trimmed = result.trim()
  if (!trimmed) return null
  const lines = trimmed.split("\n")
  return lines.length > 1
    ? lines.slice(0, 8).join("\n  ") + (lines.length > 8 ? `\n  … ещё ${lines.length - 8} строк` : "")
    : trimmed
}

// Определяет язык по доминирующему скрипту Unicode.
// Считает только буквы (\p{L}) — пути, цифры, операторы, ASCII-код не влияют.
// Возвращает название языка или null (латиница / недостаточно данных).
function detectLanguage(text) {
  const letters = text.match(/\p{L}/gu) ?? []
  let cyrillic = 0, cjk = 0, arabic = 0, korean = 0
  for (const ch of letters) {
    const cp = ch.codePointAt(0)
    if (cp >= 0x0400 && cp <= 0x04FF) cyrillic++
    else if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3040 && cp <= 0x30FF)) cjk++
    else if (cp >= 0x0600 && cp <= 0x06FF) arabic++
    else if (cp >= 0xAC00 && cp <= 0xD7AF) korean++
  }
  const total = letters.length
  if (total < 8) return null  // слишком мало букв
  if (cyrillic >= 4 && cyrillic / total >= 0.15) return "Russian"
  if (cjk     >= 4 && cjk     / total >= 0.15) return "Chinese"
  if (arabic  >= 4 && arabic  / total >= 0.15) return "Arabic"
  if (korean  >= 4 && korean  / total >= 0.15) return "Korean"
  return null
}

export async function agentLoop(userMessage) {
  await initialize()
  await runHooks("UserPromptSubmit", { message: userMessage })

  const signal = arm()

  // Авто-определяем язык на каждом сообщении, пока он не установлен
  {
    const config = getConfig()
    if (!config.language) {
      const detected = detectLanguage(userMessage)
      if (detected) {
        config.language = detected
        await saveConfig()
        // Обновляем мягкую инструкцию в уже живом system-сообщении
        const msgs = getMessages()
        if (msgs.length > 0 && msgs[0].role === "system") {
          msgs[0] = { ...msgs[0], content: msgs[0].content.replace(
            "Always respond in the same language the user is writing in. Do not switch languages mid-conversation.",
            `Always respond in ${detected}. Code, commands, variable names, and technical identifiers must remain in English.`
          )}
          setMessages(msgs)
        }
      }
    }
  }

  // Инициализируем messages если сессия пустая
  if (getMessages().length === 0) {
    const memory = await loadMemory()
    const { language, optimizer } = getConfig()
    const systemContent = [
      "You are a helpful coding assistant with access to tools.",
      "Always read a file before editing it.",
      "Use glob to list files and grep to search content — prefer these over bash for any read-only file exploration.",
      "Use todo_write to track multi-step tasks.",
      "Be concise in your responses. Never use sycophantic phrases like 'отлично', 'конечно', 'да, вы правы', 'great', 'certainly', 'absolutely', 'sure' — go straight to the answer or action.",
      "CRITICAL: Never guess or fabricate file contents, paths, function names, or technical details. Always use tools (read_file, glob, grep) to verify before making claims.",
      "If you are unsure about something, say so honestly instead of guessing. Use tools to check.",
      "Never assume code structure — always look at the actual files first.",
      "Do not proactively scan directories at the start of a task. Only use glob/grep when the user's request explicitly involves local files or code.",
      "Do NOT run redundant verification commands after a successful operation. Never re-list a directory or re-read a file you already retrieved in this session, even with different flags. Trust the result you already have.",
      "Do not attempt to read binary files (images, archives, executables, media, fonts, databases) unless the user explicitly asks you to inspect them.",
      optimizer
        ? "Optimizer is ON. For supported files (PHP, JS/TS, Go, CSS/SCSS) prefer code_outline + code_definition over read_file to save context. Use read_file only for unsupported file types or when you need the entire file."
        : "",
      language
        ? `Always respond in ${language}. Code, commands, variable names, and technical identifiers must remain in English.`
        : "Always respond in the same language the user is writing in. Do not switch languages mid-conversation.",
      memory ? `\n\n${memory}` : ""
    ].join(" ")
    pushMessage({ role: "system", content: systemContent })
  }

  // Создаём чекпоинт перед каждым ходом
  createCheckpoint()
  incrementTurn()

  pushMessage({ role: "user", content: userMessage })

  try {
    while (true) {
      if (signal.aborted) break

      let messages = getMessages()
      messages = await compactIfNeeded(messages, getClient())
      setMessages(messages)

      let stream
      try {
        stream = await getClient().chat.completions.create({
          model: getModel(),
          messages,
          tools: buildOpenAITools(),
          temperature: getConfig().temperature ?? 0,
          stream: true,
          signal
        })
      } catch (err) {
        if (signal.aborted || err.name === 'AbortError') break
        throw err
      }

      let fullContent = ""
      let toolCalls = []
      let finishReason = null
      let hasReasoning = false

      print(c.green("\nAgent: "))

      try {
        for await (const chunk of stream) {
          if (signal.aborted) break
          const delta = chunk.choices[0]?.delta
          finishReason = chunk.choices[0]?.finish_reason ?? finishReason

          if (printReasoning(chunk)) {
            if (!hasReasoning) { print(c.dim("\n[thinking]\n")); hasReasoning = true }
            continue
          }

          if (hasReasoning && delta?.content && !fullContent) {
            print(c.dim("[/thinking]\n") + c.green("Agent: "))
            hasReasoning = false
          }

          if (delta?.content) {
            print(delta.content)
            emit("text", { text: delta.content })
            fullContent += delta.content
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = { id: "", type: "function", function: { name: "", arguments: "" } }
              }
              if (tc.id) toolCalls[tc.index].id += tc.id
              if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name
              if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments
            }
          }
        }
      } catch (err) {
        if (signal.aborted || err.name === 'AbortError') {
          if (fullContent) print("\n")
          break
        }
        throw err
      }

      if (signal.aborted) {
        if (fullContent) print("\n")
        break
      }

      if (fullContent) print("\n")

      pushMessage({
        role: "assistant",
        content: fullContent || null,
        tool_calls: toolCalls.length ? toolCalls : undefined
      })

      if (finishReason === "stop") {
        await runHooks("Stop", { response: fullContent })
        return fullContent
      }

      if (finishReason === "tool_calls") {
        for (const call of toolCalls) {
          if (signal.aborted) break

          let args
          try { args = JSON.parse(call.function.arguments) } catch { args = {} }

          print(c.cyan("\n● " + formatToolCall(call.function.name, args)) + "\n")
          emit("tool_call", { tool: call.function.name, args })

          if (isFileTool(call.function.name, args)) {
            const hit = await cacheCheck(call.function.name, call.function.arguments, args.path, getMessages().length)
            if (hit) {
              print(c.dim(`  ↳ кеш\n`))
              pushMessage({ role: "tool", tool_call_id: call.id, content: "[File unchanged — already in context]" })
              continue
            }
          }

          const result = await executeTool(call.function.name, args)

          const full = String(result)
          const CONTEXT_LIMIT = 12000
          const toolContent = full.length > CONTEXT_LIMIT
            ? full.slice(0, CONTEXT_LIMIT) + `\n[... truncated, ${full.length - CONTEXT_LIMIT} chars omitted]`
            : full
          const summary = formatToolResult(call.function.name, args, full)
          if (summary) print(c.dim(`  ↳ ${summary}\n`))
          emit("tool_result", { tool: call.function.name, result: full.slice(0, 300) })

          pushMessage({ role: "tool", tool_call_id: call.id, content: toolContent })

          if (isFileTool(call.function.name, args)) {
            await cacheSet(call.function.name, call.function.arguments, args.path, getMessages().length)
          }
        }
      }
    }
  } finally {
    disarm()
  }

  print(c.yellow("[прервано]\n"))
  return null
}
