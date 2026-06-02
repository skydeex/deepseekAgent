import path from "path"
import { getConfig, saveConfig } from "./config.js"
import { askKey } from "./rl.js"
import { interrupt } from "./interrupt.js"
import { c } from "./ui.js"

// Директории, одобренные на запись в текущей сессии (абсолютные пути)
const _approvedDirs = new Set()
// Инструменты, одобренные на всю сессию
const _approvedTools = new Set()

let _dirsLoaded = false

function ensureDirsLoaded() {
  if (_dirsLoaded) return
  _dirsLoaded = true
  const { approvedDirs = [] } = getConfig()
  for (const d of approvedDirs) {
    _approvedDirs.add(path.resolve(d))
  }
}

const FILE_TOOLS = new Set(["write_file", "edit_file"])

function getFilePath(toolName, args) {
  if (FILE_TOOLS.has(toolName)) return args.path ?? null
  return null
}

function isInsideCwd(filePath) {
  const abs = path.resolve(filePath)
  const cwd = process.cwd()
  return abs === cwd || abs.startsWith(cwd + path.sep)
}

function isDirApproved(filePath) {
  ensureDirsLoaded()
  const dir = path.resolve(path.dirname(filePath))
  for (const approved of _approvedDirs) {
    if (dir === approved || dir.startsWith(approved + path.sep)) return true
  }
  return false
}

async function persistDir(dir) {
  const config = getConfig()
  const rel = path.relative(process.cwd(), dir) || "."
  const existing = config.approvedDirs ?? []
  if (!existing.includes(rel)) {
    config.approvedDirs = [...existing, rel]
    await saveConfig()
  }
}

async function persistTool(toolName) {
  const config = getConfig()
  if (!config.alwaysAllow.includes(toolName)) {
    config.alwaysAllow = [...config.alwaysAllow, toolName]
    await saveConfig()
  }
}

export async function checkPermission(toolName, args) {
  const { alwaysAllow, neverAllow } = getConfig()

  if (neverAllow.includes(toolName)) {
    return { allowed: false, reason: "neverAllow" }
  }

  if (alwaysAllow.includes(toolName)) {
    return { allowed: true }
  }

  if (_approvedTools.has(toolName)) {
    return { allowed: true }
  }

  const filePath = getFilePath(toolName, args)

  if (filePath && isInsideCwd(filePath)) {
    return { allowed: true }
  }

  if (filePath && isDirApproved(filePath)) {
    return { allowed: true }
  }

  let prompt
  if (filePath) {
    const dir = path.dirname(path.resolve(filePath))
    prompt =
      c.yellow(`\n┌ [?] ${toolName} → ${filePath}\n`) +
      c.yellow(`└ `) + c.dim(`[Enter] один раз  [s] папку на сессию  [d] папку навсегда  [n/Esc] отклонить: `)
  } else {
    prompt =
      c.yellow(`\n┌ [?] ${toolName}: ${JSON.stringify(args)}\n`) +
      c.yellow(`└ `) + c.dim(`[Enter] один раз  [s] на сессию  [a] навсегда  [n/Esc] отклонить: `)
  }

  const answer = await askKey(prompt)

  if (answer === '\x03') {  // Ctrl+C — прерываем агента
    interrupt()
    return { allowed: false, reason: "interrupted" }
  }

  if (answer === '\x1b' || answer === 'n') {  // Escape/n — отклонить
    return { allowed: false, reason: "user rejected" }
  }

  if (answer === "s" && filePath) {
    const dir = path.dirname(path.resolve(filePath))
    _approvedDirs.add(dir)
    return { allowed: true }
  }

  if (answer === "d" && filePath) {
    const dir = path.dirname(path.resolve(filePath))
    _approvedDirs.add(dir)
    await persistDir(dir)
    return { allowed: true }
  }

  if (answer === "s" && !filePath) {
    _approvedTools.add(toolName)
    return { allowed: true }
  }

  if (answer === "a" && !filePath) {
    _approvedTools.add(toolName)
    await persistTool(toolName)
    return { allowed: true }
  }

  if (answer === "") {  // Enter — разрешить один раз
    return { allowed: true }
  }

  return { allowed: false, reason: "user rejected" }
}
