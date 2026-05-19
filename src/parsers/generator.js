// Авто-генерация парсеров для неизвестных типов файлов
// Триггерится из src/tools/optimizer.js когда getParser(ext) === null
//
// Поведение задаётся в .agent/settings.json:
//   generateParser: "ask" | "always" | "never"  (default: "ask")
//   generateParserNever: [".ext", ...]           (никогда для конкретных расширений)

import OpenAI from "openai"
import fs from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"
import { getConfig, saveConfig } from "../config.js"
import { askKey } from "../rl.js"
import { c } from "../ui.js"
import { registerDynamic } from "./index.js"

const SAMPLE_LINES = 80   // строк файла отправляем в промпт
const MAX_RETRIES  = 2    // попыток генерации при 0 результатах

// Расширения, для которых пользователь нажал "n" — пропускаем до конца сессии
const _sessionSkipped = new Set()

// ─── Определение языка по расширению + содержимому ──────────────────

const EXT_NAMES = {
  ".wl": "Wolfram Language", ".nb": "Mathematica",
  ".clp": "CLIPS", ".apl": "APL", ".factor": "Factor",
  ".pony": "Pony", ".io": "Io", ".red": "Red",
  ".awk": "AWK", ".j": "J", ".q": "Q/KDB+", ".k": "K",
  ".dhall": "Dhall", ".cue": "CUE", ".pkl": "Pkl",
  ".bzl": "Starlark", ".star": "Starlark", ".sky": "Starlark",
  ".jsonnet": "Jsonnet", ".libsonnet": "Jsonnet",
  ".njk": "Nunjucks", ".jinja": "Jinja2", ".jinja2": "Jinja2", ".j2": "Jinja2",
  ".pug": "Pug", ".jade": "Jade", ".haml": "HAML",
  ".elm": "Elm", ".gleam": "Gleam", ".idr": "Idris",
  ".agda": "Agda", ".v": "Coq/Verilog", ".lean": "Lean",
  ".sml": "Standard ML", ".sig": "Standard ML",
  ".fst": "F*", ".fsti": "F*",
  ".roc": "Roc", ".kk": "Koka", ".eff": "Eff",
  ".mojo": "Mojo", ".🔥": "Mojo",
  ".chpl": "Chapel", ".sac": "SAC",
  ".mercury": "Mercury", ".m": "Mercury/Objective-C",
  ".p": "Pascal/Prolog", ".mod": "Modula-2",
  ".oberon": "Oberon", ".obn": "Oberon",
  ".e": "Eiffel", ".ex": "Elixir",
  ".abap": "ABAP", ".cbl": "COBOL",
  ".rpg": "RPG", ".cls": "Apex/VHDL",
  ".vb": "Visual Basic", ".vbs": "VBScript",
  ".bas": "BASIC", ".frm": "Visual Basic",
  ".au3": "AutoIt", ".ahk": "AutoHotkey",
  ".gd": "GDScript", ".gml": "GameMaker Script",
  ".fsx": "F# Script", ".csx": "C# Script",
  ".wren": "Wren", ".lobster": "Lobster",
  ".ante": "Ante", ".vale": "Vale",
  ".zig": "Zig", ".odin": "Odin",
  ".hx": "Haxe", ".hxml": "Haxe",
  ".jl": "Julia", ".cr": "Crystal",
  ".ml": "OCaml", ".mli": "OCaml",
  ".erl": "Erlang", ".hrl": "Erlang",
}

const SHEBANG_MAP = {
  python3: "Python", python: "Python",
  node: "JavaScript", nodejs: "JavaScript",
  ruby: "Ruby", perl: "Perl",
  bash: "Bash", sh: "Shell", zsh: "Zsh",
  lua: "Lua", php: "PHP", julia: "Julia",
  groovy: "Groovy", scala: "Scala",
  Rscript: "R", r: "R",
}

export function detectLanguage(ext, lines) {
  // 1. Известное расширение — самый надёжный сигнал
  if (EXT_NAMES[ext]) return EXT_NAMES[ext]
  // 2. Shebang — если расширение неизвестно
  const shebang = lines[0]?.match(/^#!.*[\/ ](env\s+)?(\w+)/)
  if (shebang) {
    const interp = shebang[2]
    const name = SHEBANG_MAP[interp] || SHEBANG_MAP[interp.toLowerCase()]
    if (name) return name
  }
  // 3. Fallback: расширение без точки, uppercase
  return ext.slice(1).toUpperCase()
}

// ─── Диалог ─────────────────────────────────────────────────────────

export async function promptGenerate(ext, langName) {
  const config = getConfig()

  if (config.generateParser === "never") return "skip"
  if (_sessionSkipped.has(ext)) return "skip"
  if (config.generateParser === "always") return "yes"

  const nameHint = langName !== ext.slice(1).toUpperCase()
    ? c.dim(` — ${langName}`)
    : ""

  const prompt =
    c.yellow(`\n┌ [?] Неизвестный тип файла: `) + c.bold(ext) + nameHint + "\n" +
    c.yellow(`│     Сгенерировать парсер для optimizer?\n`) +
    c.yellow(`└ `) +
    c.dim(`[Enter] да  [a] всегда  [n] не сейчас  [Esc] пропустить: `)

  const key = await askKey(prompt)

  if (key === "\x03") return "interrupt"
  if (key === "\x1b") return "skip"
  if (key === "" || key === "y") return "yes"

  if (key === "a") {
    config.generateParser = "always"
    await saveConfig()
    process.stdout.write(c.dim("  [generateParser = always сохранено]\n"))
    return "yes"
  }

  if (key === "n") {
    // Пропускаем только до конца сессии — не сохраняем в конфиг
    _sessionSkipped.add(ext)
    process.stdout.write(c.dim(`  [${ext} пропущен до конца сессии]\n`))
    return "skip"
  }

  return "skip"
}

// ─── LLM-промпт ─────────────────────────────────────────────────────

// Примеры встроены чтобы не читать файлы каждый раз
const EXAMPLE_PHP = `\
import { strip, esc } from "./utils.js"
export default {
  extensions: [".php"],
  outline(lines) {
    const results = []
    const pat = /(?:public|protected|private|static|\\s)+function\\s+(\\w+)\\s*\\(/
    for (let i = 0; i < lines.length; i++) {
      const m = strip(lines[i]).match(pat)
      if (m) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },
  findMethodStart(lines, name) {
    const p = new RegExp(\`function\\\\s+\${esc(name)}\\\\s*\\\\(\`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(strip(lines[i]))) return i + 1
    }
    return null
  }
}`

const EXAMPLE_HASKELL = `\
import { esc } from "./utils.js"
export default {
  extensions: [".hs", ".lhs"],
  outline(lines) {
    const results = [], seen = new Set()
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^([a-z_'][a-zA-Z0-9_']*)\\s*::/)
      if (m && !seen.has(m[1])) {
        seen.add(m[1])
        results.push({ name: m[1] + "()", line: i + 1 })
      }
      const typ = lines[i].match(/^(data|newtype|type|class)\\s+([A-Z]\\w+)/)
      if (typ && !seen.has(typ[2])) {
        seen.add(typ[2])
        results.push({ name: typ[1] + " " + typ[2], line: i + 1 })
      }
    }
    return results
  },
  findMethodStart(lines, name) {
    const clean = name.replace(/\\(\\)$/, '').replace(/^\\w+ /, '')
    const p = new RegExp(\`^(?:\${esc(clean)}\\\\s|data\\\\s+\${esc(clean)}|class\\\\s+\${esc(clean)})\`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}`

function buildPrompt(langName, ext, sampleLines) {
  const sample = sampleLines.slice(0, SAMPLE_LINES).join("\n")
  const sampleLen = Math.min(sampleLines.length, SAMPLE_LINES)

  return `\
You are generating a JavaScript ES module parser for the "${langName}" language (${ext} files).
This parser will be used to extract function/method outlines from source files for a terminal AI assistant.

## Parser interface

\`\`\`js
import { strip, esc } from "./utils.js"
// strip(line) — removes string literals and comments from a line
// esc(s)      — escapes string for use in RegExp constructor

export default {
  extensions: ["${ext}"],   // all relevant extensions for this language

  // Return [{name, line}, ...] for all top-level definitions.
  // - name ends with "()" for functions/methods/procedures
  // - name has no suffix for types, classes, constants, structs
  // - line is 1-indexed
  // - skip duplicates (use a Set if needed)
  outline(lines) { ... },

  // Return the 1-indexed line number where the named definition starts.
  // Return null if not found.
  findMethodStart(lines, name) { ... }
}
\`\`\`

## Rules

1. **No external dependencies.** Only import from \`"./utils.js"\`: \`{ strip, esc }\`
2. **Skip comments** — use strip() or regex to detect and skip comment lines
3. **Top-level only** — avoid matching function calls, assignments, or indented code
4. **No false positives** — it is better to miss something than to match wrong things
5. **Robust** — handle empty files, minified code, and edge cases gracefully
6. **ES module format** — must use \`export default { ... }\`

## Example 1: PHP (simple, regex-based)

\`\`\`js
${EXAMPLE_PHP}
\`\`\`

## Example 2: Haskell (type-annotation based, handles multiple constructs)

\`\`\`js
${EXAMPLE_HASKELL}
\`\`\`

## File sample (first ${sampleLen} lines of a real ${langName} file):

\`\`\`
${sample}
\`\`\`

## Task

Write a complete, working parser for ${langName} (${ext} files) based on the patterns you see in the file sample.
Output ONLY the JavaScript code — no explanations, no markdown outside the code.
First line must be exactly: \`// Парсер ${langName} (${ext}) — auto-generated\`
`
}

// ─── Вызов LLM ──────────────────────────────────────────────────────

async function callLLM(langName, ext, sampleLines, prevAttempt = null) {
  const config = getConfig()
  const client = new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY,
  })

  const messages = [
    { role: "user", content: buildPrompt(langName, ext, sampleLines) }
  ]

  if (prevAttempt) {
    messages.push(
      { role: "assistant", content: prevAttempt.code },
      {
        role: "user",
        content:
          `Your parser was loaded but outline() returned 0 results on the sample file.\n` +
          `This means the regex patterns don't match the actual ${langName} syntax shown above.\n` +
          `Look carefully at the file sample and rewrite the parser with correct patterns.`
      }
    )
  }

  const res = await client.chat.completions.create({
    model: config.model ?? "deepseek-chat",
    messages,
    temperature: 0.1,
    max_tokens: 2048,
  })

  let code = res.choices[0].message.content.trim()
  // Убираем markdown-обёртку если модель её добавила
  code = code.replace(/^```(?:js|javascript|typescript)?\n?/i, "").replace(/\n?```\s*$/, "").trim()
  return code
}

// ─── Валидация — запускаем outline() на реальном файле ───────────────

async function validateParser(code, sampleLines) {
  const tmpFile = path.join(
    process.cwd(), "src", "parsers",
    `__gentmp_${Date.now()}.js`
  )
  try {
    await fs.writeFile(tmpFile, code, "utf-8")
    const url = pathToFileURL(tmpFile).href + "?t=" + Date.now()
    const mod = await import(url)
    const parser = mod?.default
    if (!parser || typeof parser.outline !== "function") {
      return { ok: false, count: 0, items: [], error: "no default export or outline()" }
    }
    const items = parser.outline(sampleLines)
    return { ok: true, count: items.length, items, parser }
  } catch (e) {
    return { ok: false, count: 0, items: [], error: e.message }
  } finally {
    await fs.unlink(tmpFile).catch(() => {})
  }
}

// ─── Установка: запись файла + патч index.js + hot-reload ────────────

async function installParser(langName, ext, code) {
  // Имя файла: расширение без точки, безопасное
  const baseName = ext.slice(1).replace(/[^a-z0-9]/gi, "_").toLowerCase()
  const filePath = path.join(process.cwd(), "src", "parsers", `${baseName}.js`)
  const varName  = `_gen_${baseName}`

  // Записываем файл парсера
  await fs.writeFile(filePath, code, "utf-8")

  // Патчим index.js: добавляем import + register перед маркером
  const indexPath = path.join(process.cwd(), "src", "parsers", "index.js")
  let src = await fs.readFile(indexPath, "utf-8")

  if (!src.includes(`./${baseName}.js`)) {
    const importLine   = `import ${varName} from "./${baseName}.js" // ${langName} auto-generated\n`
    const registerLine = `register(${varName}) // ${langName} auto-generated\n`
    const MARKER = "// register(yourParser)  ← добавить новый язык здесь"
    src = src.replace(MARKER, importLine + registerLine + MARKER)
    await fs.writeFile(indexPath, src, "utf-8")
  }

  // Hot-reload: динамический импорт с cache-busting + регистрация
  const url = pathToFileURL(filePath).href + "?t=" + Date.now()
  const mod  = await import(url)
  registerDynamic(mod.default)

  return path.relative(process.cwd(), filePath)
}

// ─── Общая логика генерации ─────────────────────────────────────────

async function runGeneration(filePath, lines, langName, { silent = false } = {}) {
  const ext = path.extname(filePath).toLowerCase()

  process.stdout.write(c.dim(`  ⟳ Генерирую парсер для ${langName}...`))

  let code        = null
  let validation  = null
  let prevAttempt = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      code = await callLLM(langName, ext, lines, prevAttempt)
    } catch (e) {
      process.stdout.write(` ${c.red("✗ ошибка API: " + e.message)}\n`)
      return null
    }

    validation = await validateParser(code, lines)
    if (validation.count > 0) break

    process.stdout.write(
      validation.ok
        ? c.dim(` [0 результатов, повтор...]`)
        : c.dim(` [ошибка: ${validation.error}, повтор...]`)
    )
    prevAttempt = { code }
  }

  process.stdout.write("\n")

  if (!validation.ok) {
    console.log(c.red(`  ✗ Парсер не загрузился: ${validation.error ?? "неизвестная ошибка"}`))
    return null
  }

  if (validation.count === 0) {
    console.log(c.yellow(`  ⚠ Парсер не обнаружил элементов в файле.`))
    return null
  }

  // Preview
  console.log(c.dim(`\n  Найдено ${validation.count} элемент${validation.count === 1 ? "" : "а"}:`))
  validation.items.slice(0, 12).forEach(it => {
    console.log(`    ${c.dim("L" + String(it.line).padEnd(5))} ${it.name}`)
  })
  if (validation.count > 12) {
    console.log(c.dim(`    ... и ещё ${validation.count - 12}`))
  }

  // В silent-режиме (вызов от агента) — сохраняем сразу без вопросов
  if (silent) {
    try {
      const relPath = await installParser(langName, ext, code)
      console.log(c.green(`  ✓ Парсер сохранён: ${relPath}`))
    } catch (e) {
      console.log(c.yellow(`  ⚠ Не удалось записать файл (${e.message}), работает в памяти.`))
      registerDynamic(validation.parser)
    }
    return validation.parser
  }

  // Интерактивный режим — спрашиваем
  const saveKey = await askKey(
    c.yellow(`\n  Сохранить парсер? `) +
    c.dim(`[Enter] да  [Esc] нет: `)
  )
  if (saveKey !== "" && saveKey !== "y") {
    console.log(c.dim("  Парсер не сохранён (работает только в этой сессии)."))
    registerDynamic(validation.parser)
    return validation.parser
  }

  try {
    const relPath = await installParser(langName, ext, code)
    console.log(c.green(`  ✓ Парсер сохранён: ${relPath}`))
    return validation.parser
  } catch (e) {
    console.log(c.red(`  ✗ Не удалось сохранить: ${e.message}`))
    return validation.parser
  }
}

// ─── Публичные функции ───────────────────────────────────────────────

/**
 * Интерактивная генерация: спрашивает пользователя, показывает preview,
 * предлагает сохранить. Вызывается автоматически из optimizer tools.
 */
export async function tryGenerateParser(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (!ext) return null

  let lines
  try {
    lines = (await fs.readFile(filePath, "utf-8")).split("\n")
  } catch {
    return null
  }

  const langName = detectLanguage(ext, lines)
  const decision = await promptGenerate(ext, langName)
  if (decision !== "yes") return null

  return runGeneration(filePath, lines, langName, { silent: false })
}

/**
 * Тихая генерация без диалога: для вызова агентом по просьбе пользователя.
 * Возвращает { parser, ext, langName, items } или null при ошибке.
 */
export async function generateParserSilent(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (!ext) return null

  let lines
  try {
    lines = (await fs.readFile(filePath, "utf-8")).split("\n")
  } catch (e) {
    throw new Error(`Не удалось прочитать файл: ${e.message}`)
  }

  const langName = detectLanguage(ext, lines)
  const parser   = await runGeneration(filePath, lines, langName, { silent: true })
  if (!parser) return null

  return { parser, ext, langName }
}
