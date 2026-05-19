import { exec } from "child_process"
import { promisify } from "util"
import { getConfig } from "../config.js"

const execAsync = promisify(exec)

// Sandbox: ограничиваем команды — запрещаем сеть и запись вне cwd
const SANDBOX_BLOCKED = [
  /\bcurl\b/, /\bwget\b/, /\bfetch\b/,           // сетевые утилиты
  /\brm\s+-rf\s+\//, /\bdd\b.*of=\/dev/,          // деструктивные операции
  /\bchmod\s+777/, /\bsudo\b/, /\bsu\b/           // привилегии
]

function sandboxCheck(command) {
  for (const pattern of SANDBOX_BLOCKED) {
    if (pattern.test(command)) {
      return `Sandbox: command blocked by pattern ${pattern}. Set dangerouslyDisableSandbox:true in .agent/settings.json to allow.`
    }
  }
  return null
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
      ].join(" ")
    : "Run a bash shell command and return stdout and stderr. Do NOT add redundant verification steps — trust the result of each command.",
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
    // На Windows переключаем консоль в UTF-8 перед командой
    const cmd = process.platform === "win32"
      ? `chcp 65001 >nul 2>&1 & ${command}`
      : command
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout, maxBuffer: 10 * 1024 * 1024, encoding: "utf8" })
      let out = stdout + (stderr ? `\nSTDERR: ${stderr}` : "")
      if (out.length > LIMIT) out = out.slice(0, LIMIT) + `\n[... truncated, ${out.length - LIMIT} chars omitted]`
      return out
    } catch (err) {
      if (err.killed) return `Error: command timed out after ${timeout}ms`
      return `Error: ${err.message}`
    }
  }
}
