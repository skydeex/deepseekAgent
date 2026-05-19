// Парсер Makefile (.mk, .make, .mak)
// Outline: цели (targets), переменные верхнего уровня, define-блоки

import { esc } from "./utils.js"

export default {
  extensions: [".mk", ".make", ".mak"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*#/.test(line) || /^\t/.test(line)) continue
      // define блок
      const def = line.match(/^define\s+([a-zA-Z_][a-zA-Z0-9_\-.]*)/)
      if (def) { results.push({ name: 'define ' + def[1], line: i + 1 }); continue }
      // Target: name: / name:: (не переменная)
      const tgt = line.match(/^([a-zA-Z_][a-zA-Z0-9_\-./% ${}]*?)::?\s*(?:[^=]|$)/)
      if (tgt && !line.includes(':=') && !line.includes('?=') && !line.includes('!=')) {
        const name = tgt[1].trim()
        if (name && !name.includes(' ') || name.match(/^[a-zA-Z_][\w\-./%]*$/)) {
          results.push({ name: name + ':', line: i + 1 })
        }
        continue
      }
      // Переменные: NAME = / NAME := / NAME ?=
      const varr = line.match(/^([A-Z_][A-Z0-9_]*)\s*(?::=|\?=|!=|=)/)
      if (varr) results.push({ name: varr[1], line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/:$/, '').replace(/^define\s+/, '')
    const p = new RegExp(`^${esc(clean)}::?`)
    const pDef = new RegExp(`^define\\s+${esc(clean)}\\b`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i]) || pDef.test(lines[i])) return i + 1
    }
    return null
  }
}
