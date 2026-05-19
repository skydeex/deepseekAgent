// Парсер Zig (.zig)
// Поддерживает: fn, pub fn, export fn, inline fn, comptime fn

import { strip, esc } from "./utils.js"

const MODS = "(?:(?:pub|export|extern(?:\\s+\"[^\"]*\")?|inline|noinline|comptime)\\s+)*"

export default {
  extensions: [".zig"],

  outline(lines) {
    const results = []
    const pattern = new RegExp(`^\\s*${MODS}fn\\s+([a-zA-Z_]\\w*)\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      const clean = strip(lines[i])
      const m = clean.match(pattern)
      if (m) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`${MODS}fn\\s+${esc(methodName)}\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      const clean = strip(lines[i])
      if (p.test(clean) && clean.includes(methodName)) return i + 1
    }
    return null
  }
}
