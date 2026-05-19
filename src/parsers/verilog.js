// Парсер Verilog / SystemVerilog (.v, .sv, .svh, .vh)
// Outline: module, function, task, class, interface, package, program

import { esc } from "./utils.js"

// function/task могут иметь: automatic, return type ([N:0] / integer / real / signed), потом имя
const VLG_DEFS = /^\s*(module|function|task|class|interface|package|program|checker)\s+(?:automatic\s+)?(?:(?:signed|unsigned|integer|real|realtime|time|reg|logic|bit|byte|shortint|int|longint|shortreal)\s+)?(?:\[[^\]]*\]\s+)?([a-zA-Z_][a-zA-Z0-9_$]*)/

export default {
  extensions: [".v", ".sv", ".svh", ".vh"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*\/\//.test(line)) continue
      const m = line.match(VLG_DEFS)
      if (m) {
        const kind = m[1].split(/\s/)[0]
        const name = m[2]
        const suffix = ['function','task'].includes(kind) ? '()' : ''
        results.push({ name: name + suffix, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '')
    const p = new RegExp(`(?:module|function|task|class|interface|package|program)\\s+(?:automatic\\s+)?(?:(?:signed|unsigned|integer|real|time|reg|logic|bit)\\s+)?(?:\\[[^\\]]*\\]\\s+)?${esc(clean)}\\b`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
