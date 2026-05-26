import fs from "fs/promises"
import path from "path"

const DEFAULTS = {
  model: "deepseek-v4-flash",
  contextLimit: 100000,
  temperature: 0,
  alwaysAllow: ["read_file", "glob", "grep", "todo_read", "generate_parser"],
  neverAllow: [],
  disallowedTools: [],
  dangerouslyDisableSandbox: false,
  mcpServers: {},
  language: null,
  optimizer: true,
  generateParser: "ask"        // "ask" | "always" | "never"
}

let _config = null

export async function loadConfig() {
  if (_config) return _config

  const settingsPath = path.join(process.cwd(), ".agent", "settings.json")
  try {
    const raw = await fs.readFile(settingsPath, "utf-8")
    _config = { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    _config = { ...DEFAULTS }
  }

  return _config
}

export function getConfig() {
  return _config ?? DEFAULTS
}

export async function saveConfig() {
  if (!_config) return
  const settingsPath = path.join(process.cwd(), ".agent", "settings.json")
  try {
    await fs.mkdir(path.dirname(settingsPath), { recursive: true })
    await fs.writeFile(settingsPath, JSON.stringify(_config, null, 2), "utf-8")
  } catch {}
}
