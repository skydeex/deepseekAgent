// Парсер Ada (.ada, .adb, .ads)
// Outline: procedure, function, package, task, protected, entry

import { esc } from "./utils.js"

const ADA_DEFS = /^\s*(?:overriding\s+)?(?:(procedure|function|package|task|protected|entry))\s+(?:body\s+)?([a-zA-Z_][a-zA-Z0-9_.]*)/i

export default {
  extensions: [".ada", ".adb", ".ads"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*--/.test(line)) continue
      const m = line.match(ADA_DEFS)
      if (m) {
        const kind = m[1].toLowerCase()
        const name = m[2]
        const suffix = (kind === 'procedure' || kind === 'function' || kind === 'entry') ? '()' : ''
        results.push({ name: name + suffix, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '')
    const p = new RegExp(`(?:procedure|function|package|task|protected|entry)\\s+${esc(clean)}\\b`, 'i')
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*--/.test(lines[i])) continue
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
