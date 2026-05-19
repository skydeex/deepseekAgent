// Парсер Lean 4 (.lean)
// Outline: def, theorem, lemma, abbrev, structure, class, instance, inductive

import { esc } from "./utils.js"

const LEAN_DEFS = /^(?:private\s+|protected\s+|noncomputable\s+)?(?:@\[[^\]]*\]\s*)?(def|theorem|lemma|abbrev|structure|class|instance|inductive|opaque)\s+([a-zA-Z_][a-zA-Z0-9_.']*)/

export default {
  extensions: [".lean"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*--/.test(line)) continue
      const m = line.match(LEAN_DEFS)
      if (m) {
        const kind = m[1]
        const name = m[2]
        const suffix = (kind === 'def' || kind === 'theorem' || kind === 'lemma') ? '()' : ''
        results.push({ name: name + suffix, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '')
    const p = new RegExp(`(?:def|theorem|lemma|abbrev|structure|class|instance|inductive|opaque)\\s+${esc(clean)}\\b`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*--/.test(lines[i])) continue
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
