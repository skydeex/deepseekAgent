// Парсер Pascal/Delphi/Object Pascal (.pas, .pp, .dpr, .lpr, .inc)
// Outline: procedure, function, constructor, destructor, unit, program

import { esc } from "./utils.js"

const PASCAL_DEFS = /^\s*(?:(procedure|function|constructor|destructor|unit|program|library|package))\s+([a-zA-Z_][a-zA-Z0-9_.]*)/i

export default {
  extensions: [".pas", ".pp", ".dpr", ".lpr"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*(?:\/\/|\{|\(\*)/.test(line)) continue
      const m = line.match(PASCAL_DEFS)
      if (m) {
        const kind = m[1].toLowerCase()
        const name = m[2]
        const suffix = ['procedure','function','constructor','destructor'].includes(kind) ? '()' : ''
        results.push({ name: name + suffix, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '')
    const p = new RegExp(`(?:procedure|function|constructor|destructor)\\s+${esc(clean)}\\b`, 'i')
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*(?:\/\/|\{|\(\*)/.test(lines[i])) continue
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
