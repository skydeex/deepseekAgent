// Парсер F# (.fs, .fsx, .fsi)
// Поддерживает: let/let rec, member, override, abstract member, static member

import { esc } from "./utils.js"

const SKIP_NAMES = new Set(['open', 'module', 'type', 'namespace', 'do', '_', 'rec'])

export default {
  extensions: [".fs", ".fsx", ".fsi"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*\/\//.test(line)) continue
      // top-level let [rec] name (без отступа)
      const letM = line.match(/^let\s+(?:rec\s+)?(?:private\s+|internal\s+|public\s+|inline\s+)*([a-zA-Z_][a-zA-Z0-9_']*)/)
      if (letM && !SKIP_NAMES.has(letM[1])) {
        results.push({ name: letM[1] + "()", line: i + 1 })
        continue
      }
      // member self.Name / static member self.Name (instance member)
      const memM = line.match(/^\s*(?:static\s+)?member\s+\w+\.([a-zA-Z_][a-zA-Z0-9_']*)/)
      if (memM) {
        results.push({ name: memM[1] + "()", line: i + 1 })
        continue
      }
      // override this.Name / default this.Name (без ключевого слова member)
      const ovM = line.match(/^\s*(?:override|default)\s+\w+\.([a-zA-Z_][a-zA-Z0-9_']*)/)
      if (ovM) {
        results.push({ name: ovM[1] + "()", line: i + 1 })
        continue
      }
      // abstract member Name (без self.)
      const absM = line.match(/^\s*(?:abstract|static)\s+member\s+([a-zA-Z_][a-zA-Z0-9_']*)/)
      if (absM) {
        results.push({ name: absM[1] + "()", line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const e = esc(methodName)
    const patterns = [
      new RegExp(`^let\\s+(?:rec\\s+)?(?:\\w+\\s+)*${e}\\b`),
      new RegExp(`(?:static\\s+)?member\\s+\\w+\\.${e}\\b`),
      new RegExp(`(?:override|default)\\s+\\w+\\.${e}\\b`),
      new RegExp(`(?:abstract|static)\\s+member\\s+${e}\\b`)
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      for (const p of patterns) {
        if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
      }
    }
    return null
  }
}
