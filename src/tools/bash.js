import { exec } from "child_process"
import { promisify } from "util"
import { getConfig } from "../config.js"
import { getSignal, interrupt } from "../interrupt.js"
import { askKey } from "../rl.js"
import { c } from "../ui.js"

const execAsync = promisify(exec)

// Sandbox: жёсткий блок — команды которые никогда не должны выполняться
const SANDBOX_BLOCKED = [
  /\bcurl\b/, /\bwget\b/, /\bfetch\b/,           // сетевые утилиты
  /\brm\s+-rf\s+\//, /\bdd\b.*of=\/dev/,          // деструктивные операции
  /\bchmod\s+777/, /\bsudo\b/, /\bsu\b/           // привилегии
]

// Установщики ПО — спрашиваем пользователя перед запуском
// ВАЖНО: паттерны должны совпадать только с командами, но не с путями (напр. C:\Users\...\scoop\...)
const INSTALLER_PATTERNS = [
  /\bwinget\s+install\b/, /\bchoco\s+install\b/, /\bscoop\s+install\b/, /\bmsiexec\b/,
  /\bapt(?:-get)?\s+install\b/, /\bbrew\s+install\b/,
  /\bpip\s+install\b/, /\bnpm\s+install\s+-g\b/, /\byarn\s+global\s+add\b/
]

function sandboxCheck(command) {
  for (const pattern of SANDBOX_BLOCKED) {
    if (pattern.test(command)) {
      return `Sandbox: command blocked (${pattern}). Tell the user that this command is blocked and ask them what to do.`
    }
  }
  return null
}

function isInstaller(command) {
  return INSTALLER_PATTERNS.some(p => p.test(command))
}

async function confirmInstall(command) {
  const prompt =
    c.yellow(`\n┌ [?] Агент хочет установить ПО:\n`) +
    c.yellow(`│ `) + c.dim(`${command.slice(0, 120)}\n`) +
    c.yellow(`└ `) + c.dim(`[Enter] разрешить  [n/Esc] отклонить: `)
  const answer = await askKey(prompt)
  if (answer === '\x03') { interrupt(); return false }
  return answer === ''  // Enter = разрешить
}

const IS_WIN = process.platform === "win32"

export const bashTool = {
  name: "bash",
  description: IS_WIN
    ? [
        "Run a Windows CMD command. Use CMD syntax: mkdir, dir, copy, del, move, echo %CD%, etc.",
        "Do NOT use bash/unix commands (pwd, ls, rm, head).",
        "IMPORTANT Windows gotchas:",
        "- 'dir <folder>' on an EMPTY folder prints 'File Not Found' — this means no files inside, NOT that the folder is missing. To check folder existence use: if exist <path> (echo EXISTS) else (echo NOT FOUND).",
        "- 'cd X && command' works within one call but does NOT persist to the next tool call.",
        "- Prefer PowerShell for complex operations: powershell -Command \"...\"",
        "Do NOT add redundant verification after a successful command.",
        "NEVER use winget, choco, scoop, msiexec or any installer to install software unless the user explicitly asked to install something.",
      ].join(" ")
    : [
        "Run a bash shell command and return stdout and stderr. Do NOT add redundant verification steps — trust the result of each command.",
        "NEVER use apt, brew, pip, npm install -g, or any package manager to install software unless the user explicitly asked to install something.",
      ].join(" "),
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "The shell command to execute" },
      timeout: { type: "number", description: "Timeout in ms (default: 30000)" }
    },
    required: ["command"]
  },
  isReadOnly: false,
  async execute({ command, timeout = 30000 }) {
    const { dangerouslyDisableSandbox } = getConfig()

    if (!dangerouslyDisableSandbox) {
      const blocked = sandboxCheck(command)
      if (blocked) return blocked
    }

    const LIMIT = 8000
    const cmd = command
    if (isInstaller(command)) {
      const allowed = await confirmInstall(command)
      if (!allowed) return `Установка отклонена пользователем. Сообщи об этом и спроси что делать дальше.`
    }

    const signal = getSignal()
    try {
      const opts = { timeout, maxBuffer: 10 * 1024 * 1024, encoding: "utf8" }
      if (signal) opts.signal = signal
      const { stdout, stderr } = await execAsync(cmd, opts)
      let out = stdout + (stderr ? `\nSTDERR: ${stderr}` : "")
      if (out.length > LIMIT) out = out.slice(0, LIMIT) + `\n[... truncated, ${out.length - LIMIT} chars omitted]`
      return out
    } catch (err) {
      if (signal?.aborted || err.name === "AbortError") return `[прервано]`
      if (err.killed) return `Error: command timed out after ${timeout}ms`
      return `Error: ${err.message}`
    }
  }
}
