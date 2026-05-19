// Парсер Carbon (.carbon) — преемник C++ от Google
// Outline: fn, class, interface, impl, namespace, var, let

import { esc } from "./utils.js"

export default {
  extensions: [".carbon"],

  outline(lines) {
    const results = []
    const pat = /^\s*(?:(fn|class|interface|impl|namespace|abstract\s+class))\s+([a-zA-Z_][a-zA-Z0-9_]*)/
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*\/\//.test(line)) continue
      const m = line.match(pat)
      if (m) {
        const kind = m[1].trim()
        const name = m[2]
        const suffix = kind === 'fn' ? '()' : ''
        results.push({ name: name + suffix, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '')
    const p = new RegExp(`(?:fn|class|interface|impl|namespace)\\s+${esc(clean)}\\b`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
