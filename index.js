#!/usr/bin/env node
import { createRequire } from "module"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

// UTF-8 на stdout/stderr (важно для Windows)
if (process.stdout.isTTY) process.stdout.setDefaultEncoding("utf8")
if (process.stderr.isTTY) process.stderr.setDefaultEncoding("utf8")

// Грузим .env из директории самого агента, а не из cwd
const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
require("dotenv").config({ path: join(__dirname, ".env") })

// agent update — обновить агент из репозитория
if (process.argv[2] === "update") {
  const { execSync } = require("child_process")
  const run = cmd => execSync(cmd, { cwd: __dirname, stdio: "inherit" })
  console.log("Updating deepseek-agent...")
  try {
    run("git stash")
    run("git pull")
    run("git stash pop")
    run("npm install")
    console.log("Done. Restart agent to apply changes.")
  } catch (e) {
    console.error("Update failed:", e.message)
    process.exit(1)
  }
  process.exit(0)
}
import fs from "fs/promises"
import path from "path"
import { agentLoop } from "./src/agent.js"
import { loadConfig } from "./src/config.js"
import { enableThinking } from "./src/thinking.js"
import { createWorktree, removeWorktree, isInWorktree } from "./src/worktree.js"
import { disconnectMcp } from "./src/mcp.js"
import { printBanner, c } from "./src/ui.js"
import { setOutputFormat, isJson } from "./src/output.js"
import { handleCommand, SLASH_COMMANDS } from "./src/commands.js"
import { rl, ask, askKey, askWithComplete } from "./src/rl.js"
import { interrupt, isArmed } from "./src/interrupt.js"
import { saveSession } from "./src/session.js"

if (!process.env.DEEPSEEK_API_KEY) {
  console.error(c.red("Error: DEEPSEEK_API_KEY is not set. Copy .env.example to .env and add your key."))
  process.exit(1)
}

const args = process.argv.slice(2)
const useThinking = args.includes("--think")
const useWorktree = args.includes("--worktree")
const outputFormat = args.find(a => a.startsWith("--output-format="))?.split("=")[1] ?? "text"
setOutputFormat(outputFormat)

async function shutdown() {
  await saveSession()
  if (isInWorktree()) await removeWorktree()
  await disconnectMcp()
  console.log(c.dim("\nBye."))
  process.exit(0)
}

process.on("SIGINT", () => {
  if (isArmed()) {
    process.stdout.write(c.yellow(" [Ctrl+C]\n"))
    interrupt()
  } else {
    shutdown()
  }
})
process.on("SIGTERM", shutdown)


async function maybeInit() {
  const agentDir = path.join(process.cwd(), ".agent")
  const settingsFile = path.join(agentDir, "settings.json")
  const agentMd = path.join(agentDir, "AGENT.md")

  // Проверяем есть ли уже .agent/
  try { await fs.access(agentDir); return } catch {}

  // Папка не существует — предлагаем инициализацию
  const answer = await askKey(
    c.yellow(`\n┌ Папка не инициализирована для работы с агентом.\n`) +
    c.yellow(`└ `) + c.dim(`Создать .agent/settings.json и .agent/AGENT.md? [Enter] да  [Esc] нет  `)
  )

  if (answer === "\x1b") { console.log(); return }

  await fs.mkdir(agentDir, { recursive: true })

  await fs.writeFile(settingsFile, JSON.stringify({
    model: "deepseek-chat",
    alwaysAllow: ["read_file", "glob", "grep", "todo_read"],
    language: null
  }, null, 2), "utf-8")

  await fs.writeFile(agentMd, `# Project Instructions\n\nDescribe the project here so the agent understands the context.\n`, "utf-8")

  console.log(c.dim(`\n[init] Created .agent/settings.json`))
  console.log(c.dim(`[init] Created .agent/AGENT.md — edit it to add project instructions\n`))
}

async function main() {
  await loadConfig()

  if (useThinking) {
    enableThinking()
    console.log(c.dim("[mode] Extended thinking (deepseek-reasoner)"))
  }

  if (useWorktree) {
    try {
      const wt = await createWorktree()
      process.chdir(wt.path)
      console.log(c.dim(`[worktree] Branch: ${wt.branch}`))
    } catch (err) {
      console.error(c.red(`[worktree] ${err.message}`))
    }
  }

  // json-режим — одиночный запрос без REPL
  if (isJson()) {
    const prompt = args.find(a => !a.startsWith("--"))
    if (prompt) {
      await agentLoop(prompt)
    } else {
      const chunks = []
      for await (const chunk of process.stdin) chunks.push(chunk)
      const input = chunks.join("").trim()
      if (input) await agentLoop(input)
    }
    rl.close()
    await shutdown()
    return
  }

  printBanner()
  await maybeInit()

  while (true) {
    const input = await askWithComplete(c.bold("You: "), SLASH_COMMANDS)
    const trimmed = input.trim()
    if (!trimmed || trimmed === "exit" || trimmed === "/exit" || trimmed === "/quit") break

    // Команды начинаются с /
    if (trimmed.startsWith("/")) {
      const handled = await handleCommand(trimmed)
      if (!handled) console.log(c.dim(`Unknown command: ${trimmed.split(" ")[0]}. Type /help for list.\n`))
      continue
    }

    // Добавить задачу в историю стрелок (только пользовательские задания, не /команды)
    rl.history.unshift(trimmed)
    if (rl.history.length > 200) rl.history.pop()

    try {
      await agentLoop(trimmed)
      await saveSession()
      console.log()
    } catch (err) {
      console.error(c.red(`\nError: ${err.message}\n`))
    }
  }

  rl.close()
  await shutdown()
}

main()
