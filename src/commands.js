import fs from "fs/promises"
import { exec } from "child_process"
import { promisify } from "util"
import OpenAI from "openai"
import {
  getMessages, setMessages, clearMessages,
  createCheckpoint, getCheckpoints, restoreCheckpoint,
  getTurnCount, setTurnCount, loadSessions
} from "./session.js"
import { compactIfNeeded } from "./compactor.js"
import { getConfig } from "./config.js"
import { getModel } from "./thinking.js"
import { c, waitForInput } from "./ui.js"
import { askKey } from "./rl.js"
import { print } from "./output.js"
import { saveConfig } from "./config.js"

const execAsync = promisify(exec)

function getClient() {
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY
  })
}

// Грубая оценка токенов
function estimateTokens(messages) {
  const text = messages.map(m =>
    typeof m.content === "string" ? m.content :
    Array.isArray(m.content) ? m.content.map(b => b.text ?? "").join("") : ""
  ).join("")
  return Math.ceil(text.length / 4)
}

// ─────────────────────────────────────────────
// /clear — сбросить контекст
// ─────────────────────────────────────────────
export function cmdClear() {
  clearMessages()
  print(c.dim("[clear] Context reset. Starting fresh.\n"))
}

// ─────────────────────────────────────────────
// /compact — вручную сжать контекст
// ─────────────────────────────────────────────
export async function cmdCompact() {
  const msgs = getMessages()
  if (msgs.length <= 2) {
    print(c.dim("[compact] Nothing to compact.\n"))
    return
  }
  const before = estimateTokens(msgs)
  const compacted = await compactIfNeeded(
    msgs.map((m, i) => i === 0 ? { ...m } : m),
    getClient(),
    true // force
  )
  setMessages(compacted)
  const after = estimateTokens(compacted)
  print(c.dim(`[compact] ${before} → ${after} tokens\n`))
}

// ─────────────────────────────────────────────
// /context — визуализация контекста
// ─────────────────────────────────────────────
export function cmdContext() {
  const msgs = getMessages()
  const tokens = estimateTokens(msgs)
  const limit = getConfig().contextLimit
  const pct = Math.round((tokens / limit) * 100)
  const filled = Math.round(pct / 5)
  const bar = "█".repeat(filled) + "░".repeat(20 - filled)

  const color = pct < 60 ? c.green : pct < 80 ? c.yellow : c.red
  print(`\n${color(`[${bar}]`)} ${tokens} / ${limit} tokens (${pct}%)\n`)
  print(c.dim(`Messages: ${msgs.length}  Turns: ${getTurnCount()}\n\n`))
}

// ─────────────────────────────────────────────
// /usage — расход токенов за сессию
// ─────────────────────────────────────────────
export function cmdUsage() {
  cmdContext()
}

// ─────────────────────────────────────────────
// /export [filename] — сохранить разговор
// ─────────────────────────────────────────────
export async function cmdExport(args) {
  const msgs = getMessages()
  if (msgs.length === 0) {
    print(c.dim("[export] No conversation to export.\n"))
    return
  }

  const lines = msgs
    .filter(m => m.role !== "system")
    .map(m => {
      const role = m.role.toUpperCase()
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content)
      return `[${role}]\n${content}\n`
    })
    .join("\n---\n\n")

  const filename = args || `export-${Date.now()}.txt`
  await fs.writeFile(filename, lines, "utf-8")
  print(c.dim(`[export] Saved to ${filename}\n`))
}

// ─────────────────────────────────────────────
// /recap — краткое резюме сессии
// ─────────────────────────────────────────────
export async function cmdRecap() {
  const msgs = getMessages().filter(m => m.role !== "system")
  if (msgs.length === 0) {
    print(c.dim("[recap] Nothing to recap yet.\n"))
    return
  }

  const client = getClient()
  const res = await client.chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: "Summarize what was done in this conversation in 1-3 sentences." },
      { role: "user", content: msgs.map(m => `[${m.role}]: ${typeof m.content === "string" ? m.content : ""}`).join("\n") }
    ]
  })

  print(c.bold("\nSession recap: ") + res.choices[0].message.content + "\n\n")
}

// ─────────────────────────────────────────────
// /btw <question> — вопрос без добавления в историю
// ─────────────────────────────────────────────
export async function cmdBtw(question) {
  if (!question) {
    print(c.dim("[btw] Usage: /btw <your question>\n"))
    return
  }

  const client = getClient()
  const systemMsg = getMessages().find(m => m.role === "system")
  const tempMessages = [
    systemMsg ?? { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: question }
  ]

  print(c.dim("\n[btw] "))
  const stream = await client.chat.completions.create({
    model: getModel(),
    messages: tempMessages,
    stream: true
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) print(text)
  }
  print("\n\n")
  // messages[] не меняем — вопрос не входит в историю
}

// ─────────────────────────────────────────────
// /diff — показать git diff
// ─────────────────────────────────────────────
export async function cmdDiff() {
  try {
    const { stdout } = await execAsync("git diff --stat HEAD 2>&1 && echo '---' && git diff HEAD 2>&1")
    if (!stdout.trim()) {
      print(c.dim("[diff] No uncommitted changes.\n"))
    } else {
      print("\n" + stdout + "\n")
    }
  } catch {
    print(c.red("[diff] Not a git repository or git not installed.\n"))
  }
}

// ─────────────────────────────────────────────
// /rewind — откат к чекпоинту
// ─────────────────────────────────────────────
export async function cmdRewind() {
  const checkpoints = getCheckpoints()
  if (checkpoints.length === 0) {
    print(c.dim("[rewind] No checkpoints yet. Checkpoints are created automatically each turn.\n"))
    return
  }

  print(c.bold("\nAvailable checkpoints:\n"))
  checkpoints.forEach((cp, i) => {
    const time = new Date(cp.timestamp).toLocaleTimeString()
    const lastMsg = cp.messages.filter(m => m.role === "user").at(-1)
    const preview = typeof lastMsg?.content === "string" ? lastMsg.content.slice(0, 60) : ""
    print(`  ${c.cyan(`[${i}]`)} turn ${cp.turn}  ${c.dim(time)}  ${preview}\n`)
  })

  print(c.yellow("\nRestore checkpoint [number] or Enter to cancel: "))
  const answer = await waitForInput()
  const idx = parseInt(answer.trim())

  if (!isNaN(idx) && restoreCheckpoint(idx)) {
    print(c.dim(`[rewind] Restored to checkpoint #${idx}\n`))
  } else {
    print(c.dim("[rewind] Cancelled.\n"))
  }
}

// ─────────────────────────────────────────────
// /review — ревью изменений
// ─────────────────────────────────────────────
export async function cmdReview(args) {
  const { agentLoop } = await import("./agent.js")
  let diff
  try {
    const { stdout } = await execAsync("git diff HEAD 2>&1")
    diff = stdout.trim()
  } catch {
    print(c.red("[review] Not a git repository.\n"))
    return
  }

  if (!diff) {
    print(c.dim("[review] No changes to review.\n"))
    return
  }

  const prompt = args
    ? `Review these changes with focus on: ${args}\n\n${diff}`
    : `Review these code changes. Check for bugs, code quality, edge cases, and suggest improvements.\n\n${diff}`

  await agentLoop(prompt)
}

// ─────────────────────────────────────────────
// /security-review — анализ безопасности
// ─────────────────────────────────────────────
export async function cmdSecurityReview() {
  const { agentLoop } = await import("./agent.js")
  let diff
  try {
    const { stdout } = await execAsync("git diff HEAD 2>&1")
    diff = stdout.trim()
  } catch {
    print(c.red("[security-review] Not a git repository.\n"))
    return
  }

  if (!diff) {
    print(c.dim("[security-review] No changes to review.\n"))
    return
  }

  await agentLoop(
    `Perform a security review of these changes. Look for: SQL injection, XSS, command injection, path traversal, insecure dependencies, hardcoded secrets, auth issues, data exposure.\n\n${diff}`
  )
}

// ─────────────────────────────────────────────
// /simplify — параллельное ревью качества кода
// ─────────────────────────────────────────────
export async function cmdSimplify(args) {
  const { agentLoop } = await import("./agent.js")
  const { taskTool } = await import("./tools/task.js")

  let changedFiles
  try {
    const { stdout } = await execAsync("git diff --name-only HEAD 2>&1")
    changedFiles = stdout.trim()
  } catch {
    changedFiles = ""
  }

  const context = changedFiles ? `Changed files:\n${changedFiles}\n\n` : ""
  const focus = args ? `Focus on: ${args}` : ""

  print(c.dim("[simplify] Running 3 parallel review agents...\n"))

  const tasks = [
    `${context}Review recently changed files for code reuse opportunities and DRY violations. Suggest and apply fixes. ${focus}`,
    `${context}Review recently changed files for code quality issues: naming, complexity, readability. Suggest and apply fixes. ${focus}`,
    `${context}Review recently changed files for performance and efficiency issues. Suggest and apply fixes. ${focus}`
  ]

  await taskTool.execute({ parallel: tasks })
}

// ─────────────────────────────────────────────
// /batch <instruction> — параллельные задачи по кодовой базе
// ─────────────────────────────────────────────
export async function cmdBatch(instruction) {
  if (!instruction) {
    print(c.dim("[batch] Usage: /batch <instruction>\n"))
    return
  }

  const { agentLoop } = await import("./agent.js")
  const { taskTool } = await import("./tools/task.js")

  print(c.dim("[batch] Planning tasks...\n"))

  // Агент планирует задачи
  const plan = await agentLoop(
    `Decompose this instruction into 3-8 independent units of work that can be done in parallel. Return ONLY a JSON array of strings, each describing one unit. Instruction: ${instruction}`
  )

  let units
  try {
    const match = plan.match(/\[[\s\S]*\]/)
    units = JSON.parse(match?.[0] ?? "[]")
  } catch {
    print(c.red("[batch] Could not parse task plan.\n"))
    return
  }

  if (units.length === 0) {
    print(c.red("[batch] No tasks extracted.\n"))
    return
  }

  print(c.dim(`[batch] Running ${units.length} tasks in parallel...\n`))
  units.forEach((u, i) => print(c.dim(`  ${i + 1}. ${u}\n`)))
  print("\n")

  await taskTool.execute({ parallel: units })
}

// ─────────────────────────────────────────────
// /loop [interval] [prompt] — периодический запуск
// ─────────────────────────────────────────────
let _loopTimer = null

export async function cmdLoop(args) {
  if (_loopTimer) {
    clearInterval(_loopTimer)
    _loopTimer = null
    print(c.dim("[loop] Stopped.\n"))
    return
  }

  if (!args) {
    print(c.dim("[loop] Usage: /loop [interval] <prompt>  |  /loop to stop\n"))
    print(c.dim("  Example: /loop 5m check if tests pass\n"))
    return
  }

  const { agentLoop } = await import("./agent.js")

  // Парсим интервал (5m, 30s, 1h)
  const intervalMatch = args.match(/^(\d+)(s|m|h)\s*/)
  let intervalMs = 5 * 60 * 1000 // дефолт 5 минут
  let prompt = args

  if (intervalMatch) {
    const val = parseInt(intervalMatch[1])
    const unit = intervalMatch[2]
    intervalMs = unit === "s" ? val * 1000 : unit === "m" ? val * 60000 : val * 3600000
    prompt = args.slice(intervalMatch[0].length).trim()
  }

  if (!prompt) prompt = "Do a quick maintenance check of the project."

  print(c.dim(`[loop] Starting loop every ${intervalMs / 1000}s: "${prompt}"\n`))
  print(c.dim("[loop] Run /loop again to stop.\n\n"))

  const run = () => agentLoop(prompt).catch(err => print(c.red(`[loop] Error: ${err.message}\n`)))
  await run()
  _loopTimer = setInterval(run, intervalMs)
}

// ─────────────────────────────────────────────
// /resume — восстановить одну из последних сессий
// ─────────────────────────────────────────────
function _resumeRelTime(ts) {
  const d = Date.now() - ts
  const m = Math.floor(d / 60000)
  const h = Math.floor(d / 3600000)
  const day = Math.floor(d / 86400000)
  if (m < 1)   return "только что"
  if (m < 60)  return `${m}м назад`
  if (h < 24)  return `${h}ч назад`
  if (day < 2) return "вчера"
  return `${day}д назад`
}

function _resumeTurns(n) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} ход`
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return `${n} хода`
  return `${n} ходов`
}

export async function cmdResume() {
  if (getMessages().length > 1) {
    print(c.dim("[resume] Сессия уже активна. Сначала выполните /clear.\n"))
    return
  }

  const sessions = await loadSessions()
  if (!sessions.length) {
    print(c.dim("[resume] Нет сохранённых сессий.\n"))
    return
  }

  print(c.bold("\nСохранённые сессии:\n\n"))
  sessions.forEach((s, i) => {
    const time  = _resumeRelTime(s.timestamp).padEnd(11)
    const turns = _resumeTurns(s.turnCount).padEnd(8)
    const desc  = (s.firstMessage || "").replace(/\s+/g, " ").slice(0, 70)
    const tail  = s.firstMessage.length > 70 ? "…" : ""
    print(` ${c.cyan(`[${i + 1}]`)}  ${c.dim(time)}  ${c.dim(turns)}  "${desc}${tail}"\n`)
  })

  const keys = sessions.map((_, i) => i + 1).join("/")
  const answer = await askKey(c.yellow(`\n[${keys}] выбрать  [Esc] отмена: `))

  const idx = parseInt(answer) - 1
  if (isNaN(idx) || idx < 0 || idx >= sessions.length) {
    print(c.dim("\n[resume] Отменено.\n"))
    return
  }

  const chosen = sessions[idx]
  setMessages(chosen.messages)
  setTurnCount(chosen.turnCount)
  print(c.dim(`\n[resume] Сессия #${idx + 1} восстановлена. ${_resumeTurns(chosen.turnCount)}, ${chosen.messageCount} сообщений.\n\n`))
}

// ─────────────────────────────────────────────
// /lang [code|off] — установить язык ответов
// ─────────────────────────────────────────────
const LANG_ALIASES = {
  ru: "Russian", en: "English", de: "German", fr: "French",
  zh: "Chinese", ja: "Japanese", es: "Spanish", ar: "Arabic",
  ko: "Korean",  pt: "Portuguese", it: "Italian", pl: "Polish"
}

function applyLangToSystemMessage(language) {
  const msgs = getMessages()
  if (msgs.length === 0 || msgs[0].role !== "system") return
  const newInstruction = language
    ? `Always respond in ${language}. Code, commands, variable names, and technical identifiers must remain in English.`
    : "Always respond in the same language the user is writing in. Do not switch languages mid-conversation."
  const updated = msgs[0].content
    .replace(
      /Always respond in (?:the same language the user is writing in\. Do not switch languages mid-conversation\.|[^\n.]+\. Code, commands, variable names, and technical identifiers must remain in English\.)/,
      newInstruction
    )
  msgs[0] = { ...msgs[0], content: updated }
  setMessages(msgs)
}

export async function cmdLang(args) {
  const config = getConfig()

  if (!args) {
    const cur = config.language ?? "авто (определяется по первому сообщению)"
    print(c.bold(`\n[lang] Язык ответов: ${cur}\n`))
    print(c.dim("  /lang ru       — установить русский\n"))
    print(c.dim("  /lang en       — установить английский\n"))
    print(c.dim("  /lang off      — авто-определение\n\n"))
    return
  }

  if (args === "off" || args === "auto" || args === "clear") {
    config.language = null
    await saveConfig()
    applyLangToSystemMessage(null)
    print(c.dim("[lang] Язык сброшен — авто-определение активно.\n\n"))
    return
  }

  config.language = LANG_ALIASES[args.toLowerCase()] ?? args
  await saveConfig()
  applyLangToSystemMessage(config.language)
  print(c.dim(`[lang] Язык установлен: ${config.language}\n\n`))
}

// ─────────────────────────────────────────────
// /parser — управление авто-генерацией парсеров
// ─────────────────────────────────────────────
export async function cmdParser(args) {
  const { getConfig, saveConfig } = await import("./config.js")
  const { getSupportedExtensions } = await import("./parsers/index.js")
  const { tryGenerateParser } = await import("./parsers/generator.js")
  const config = getConfig()

  const sub = (args ?? "").trim().toLowerCase()

  if (!sub || sub === "status") {
    const mode = config.generateParser ?? "ask"
    const never = (config.generateParserNever ?? [])
    print(c.bold("\n[parser] Авто-генерация парсеров\n"))
    print(c.dim(`  Режим:          `) + c.cyan(mode) + "\n")
    print(c.dim(`  Языков в базе:  `) + getSupportedExtensions().length + "\n")
    if (never.length) {
      print(c.dim(`  Исключения:     `) + never.join(", ") + "\n")
    }
    print(c.dim(`\n  Подкоманды:\n`))
    print(c.dim(`    /parser ask     — спрашивать при каждом новом типе\n`))
    print(c.dim(`    /parser always  — всегда генерировать без вопросов\n`))
    print(c.dim(`    /parser never   — никогда не генерировать\n`))
    print(c.dim(`    /parser allow .ext — убрать .ext из исключений\n`))
    print(c.dim(`    /parser gen <file> — сгенерировать для конкретного файла\n`))
    print("\n")
    return true
  }

  if (sub === "ask" || sub === "always" || sub === "never") {
    config.generateParser = sub
    await saveConfig()
    print(c.bold(`\n[parser] generateParser = ${sub}\n\n`))
    return true
  }

  if (sub.startsWith("allow ")) {
    const ext = sub.slice(6).trim()
    config.generateParserNever = (config.generateParserNever ?? []).filter(e => e !== ext)
    await saveConfig()
    print(c.dim(`\n[parser] ${ext} убран из исключений\n\n`))
    return true
  }

  if (sub.startsWith("gen ")) {
    const filePath = args.trim().slice(4).trim()
    await tryGenerateParser(filePath)
    return true
  }

  print(c.yellow(`\n[parser] Неизвестная подкоманда: ${sub}\n`))
  print(c.dim(`  Используй /parser без аргументов для справки.\n\n`))
  return true
}

// ─────────────────────────────────────────────
// /optimizer — включить/выключить code optimizer
// ─────────────────────────────────────────────
export async function cmdOptimizer() {
  const config = getConfig()
  config.optimizer = !config.optimizer
  await saveConfig()

  const { rebuildTools } = await import("./agent.js")
  rebuildTools()

  const state = config.optimizer ? "ON" : "OFF"
  const tools = config.optimizer
    ? "code_outline, code_definition, code_context"
    : "read_file, grep"
  print(c.bold(`\n[optimizer] ${state}\n`))
  print(c.dim(`  Инструменты: ${tools}\n`))
  print(c.dim(`  Поддержка: 75+ языков (YAML, Go, Rust, Python, …)\n`))
  if (config.optimizer) {
    print(c.dim(`  Для неизвестных типов — предложит сгенерировать парсер (/parser для настройки)\n`))
  }
  print("\n")
}

// ─────────────────────────────────────────────
// /creative — переключить режим (точный ↔ рассуждения)
// ─────────────────────────────────────────────
export function cmdCreative() {
  const config = getConfig()
  const wasCreative = (config.temperature ?? 0) > 0.1
  config.temperature = wasCreative ? 0 : 0.5

  if (wasCreative) {
    print(c.bold("\n[creative] OFF → точный режим\n"))
    print(c.dim("  temperature: 0 — минимум галлюцинаций, строгие ответы\n\n"))
  } else {
    print(c.bold("\n[creative] ON → режим рассуждений\n"))
    print(c.dim("  temperature: 0.5 — взвешивает варианты, рассуждает\n\n"))
  }
}

// ─────────────────────────────────────────────
// /model — информация о доступных моделях
// ─────────────────────────────────────────────
export function cmdModel() {
  const { model, thinkingModel } = getConfig()
  print(c.bold("\nAvailable models:\n"))
  print(`  ${c.green("deepseek-chat")}     — fast, cheap, general purpose ${model === "deepseek-chat" ? c.dim("(current)") : ""}\n`)
  print(`  ${c.cyan("deepseek-reasoner")} — extended thinking, complex tasks ${model === thinkingModel ? c.dim("(current)") : ""}\n`)
  print(c.dim("\nTo switch: edit .agent/settings.json → \"model\"\n"))
  print(c.dim("Or run with --think flag to use deepseek-reasoner for the session.\n\n"))
}

// ─────────────────────────────────────────────
// Роутер команд
// ─────────────────────────────────────────────
export async function handleCommand(input) {
  const [cmd, ...rest] = input.trim().slice(1).split(" ")
  const args = rest.join(" ")

  switch (cmd.toLowerCase()) {
    case "clear":
    case "reset":
    case "new":          cmdClear(); return true
    case "compact":      await cmdCompact(); return true
    case "context":      cmdContext(); return true
    case "usage":
    case "cost":         cmdUsage(); return true
    case "export":       await cmdExport(args); return true
    case "recap":        await cmdRecap(); return true
    case "btw":          await cmdBtw(args); return true
    case "diff":         await cmdDiff(); return true
    case "rewind":
    case "undo":
    case "checkpoint":   await cmdRewind(); return true
    case "review":       await cmdReview(args); return true
    case "security-review": await cmdSecurityReview(); return true
    case "simplify":     await cmdSimplify(args); return true
    case "batch":        await cmdBatch(args); return true
    case "loop":
    case "proactive":    await cmdLoop(args); return true
    case "lang":
    case "language":     await cmdLang(args); return true
    case "model":        cmdModel(); return true
    case "creative":     cmdCreative(); return true
    case "optimizer":    await cmdOptimizer(); return true
    case "parser":       await cmdParser(args); return true
    case "resume":       await cmdResume(); return true
    case "help":
    case "?":            printHelp(); return true
    default:             return false
  }
}

function printHelp() {
  const cmds = [
    ["/clear",            "сбросить контекст, начать заново"],
    ["/compact",          "вручную сжать контекст"],
    ["/context",          "показать занятость контекста"],
    ["/usage",            "то же что /context"],
    ["/export [file]",    "сохранить разговор в файл"],
    ["/recap",            "краткое резюме сессии"],
    ["/btw <вопрос>",     "быстрый вопрос без добавления в историю"],
    ["/diff",             "показать git diff"],
    ["/rewind",           "откатиться к чекпоинту"],
    ["/review [focus]",   "ревью изменений"],
    ["/security-review",  "анализ безопасности изменений"],
    ["/simplify [focus]", "параллельное ревью качества кода"],
    ["/batch <задача>",   "разбить задачу и выполнить параллельно"],
    ["/loop [N] <промпт>","запускать промпт каждые N минут (повтор — стоп)"],
    ["/lang [код|off]",   "язык ответов (ru/en/de/…) или авто-определение"],
    ["/model",            "информация о доступных моделях"],
    ["/creative",         "переключить точный (t=0) ↔ рассуждения (t=0.5)"],
    ["/optimizer",        "включить/выключить code optimizer (75+ языков)"],
    ["/parser [sub]",     "авто-генерация парсеров: status/ask/always/never/gen <file>"],
    ["/resume",           "восстановить предыдущую сессию"],
    ["/help",             "эта справка"],
  ]
  print(c.bold("\nКоманды:\n"))
  for (const [cmd, desc] of cmds) {
    print(`  ${c.cyan(cmd.padEnd(22))} ${desc}\n`)
  }
  print("\n")
}
