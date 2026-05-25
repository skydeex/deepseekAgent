// Инструменты оптимизатора — экономят токены при работе с кодом
// Вместо чтения целых файлов: outline + точечное чтение методов
//
// Для неизвестных типов файлов предлагает сгенерировать парсер через LLM.

import path from "path"
import { outline, definition, codeContext } from "../optimizer.js"
import { getParser } from "../parsers/index.js"
import { tryGenerateParser } from "../parsers/generator.js"
import { adjust, reset } from "../line_tracker.js"

// Возвращает parser-объект или null.
// Если парсер не зарегистрирован — предлагает сгенерировать.
async function ensureParser(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const existing = getParser(ext)
  if (existing) return existing
  return tryGenerateParser(filePath)
}

export const codeOutlineTool = {
  name: "code_outline",
  description:
    "List all functions, methods, and classes in a file with line numbers. " +
    "Returns only names and line numbers — much more efficient than reading the entire file. " +
    "Use this first to explore file structure, then code_definition to read specific methods. " +
    "Supports 75+ languages. For unknown file types, will offer to auto-generate a parser. " +
    "If the user declines, use read_file instead.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file" }
    },
    required: ["path"]
  },
  isReadOnly: true,
  async execute({ path: filePath }) {
    const parser = await ensureParser(filePath)
    if (!parser) {
      return `File type not supported by optimizer. Use read_file to read "${filePath}".`
    }
    const results = await outline(filePath)
    if (!results || results.length === 0) return "No functions/methods found."
    // Сброс трекера: LLM получает свежие номера строк, старые сдвиги больше не актуальны
    reset(filePath)
    return results.map(r => `${r.name.padEnd(40)} line ${r.line}`).join("\n")
  }
}

export const codeDefinitionTool = {
  name: "code_definition",
  description:
    "Extract a specific function or method body from a file by name. " +
    "Returns the function's code with 3 lines of context — much more efficient than reading the entire file. " +
    "Use after code_outline to read specific functions. " +
    "Supports 75+ languages. For unknown file types, will offer to auto-generate a parser. " +
    "If the user declines, use read_file instead.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file" },
      name: { type: "string", description: "Function/method/class name to extract" }
    },
    required: ["path", "name"]
  },
  isReadOnly: true,
  async execute({ path: filePath, name: targetName }) {
    const parser = await ensureParser(filePath)
    if (!parser) {
      return `File type not supported by optimizer. Use read_file to read "${filePath}".`
    }
    const result = await definition(filePath, targetName)
    if (!result) return `Could not extract definition. Use read_file to read "${filePath}".`
    if (!result.found) return `Method not found: ${targetName}`

    let output = ""
    if (result.context) {
      output += `=== context (lines ${result.contextStart}-${result.startLine - 1}) ===\n${result.context}\n`
    }
    output += `=== ${targetName} (lines ${result.startLine}-${result.endLine}) ===\n${result.body}`
    return output
  }
}

export const codeContextTool = {
  name: "code_context",
  description:
    "Show N lines around a specific line number in a file. " +
    "The target line is marked with '>>>'. " +
    "Useful for investigating errors and stack traces at specific line numbers. " +
    "Works with any file type.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file" },
      line: { type: "integer", description: "Center line number" },
      radius: { type: "integer", description: "Number of lines above and below (default: 10)" }
    },
    required: ["path", "line"]
  },
  isReadOnly: true,
  async execute({ path: filePath, line, radius = 10 }) {
    const actualLine = adjust(filePath, line)
    const result = await codeContext(filePath, actualLine, radius)
    const note = actualLine !== line ? ` (adjusted from ${line})` : ""
    return `=== ${filePath} lines ${result.from}-${result.to}${note} ===\n${result.content}`
  }
}
