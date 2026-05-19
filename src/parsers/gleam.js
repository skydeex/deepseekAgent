// Парсер Gleam (.gleam)
// Outline: pub fn / fn / pub type / type / pub const / const

import { esc } from "./utils.js"

export default {
  extensions: [".gleam"],

  outline(lines) {
    const results = []
    const pat = /^(?:pub\s+)?(?:(fn|type|const|opaque\s+type))\s+([a-zA-Z_][a-zA-Z0-9_]*)/
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*\/\//.test(line)) continue
      const m = line.match(pat)
      if (m) {
        const kind = m[1].trim()
        const name = m[2]
        const suffix = kind === 'fn' ? '()' : kind === 'const' ? '' : ''
        results.push({ name: name + suffix, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '')
    const p = new RegExp(`^(?:pub\\s+)?(?:fn|type|const|opaque\\s+type)\\s+${esc(clean)}\\b`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
