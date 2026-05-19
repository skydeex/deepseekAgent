// Парсер Nim (.nim, .nims)
// Поддерживает: proc, func, method, iterator, template, macro, converter
// * после имени = экспортируемый символ

import { esc } from "./utils.js"

const NIM_DEFS = "proc|func|method|iterator|template|macro|converter"

export default {
  extensions: [".nim", ".nims"],

  outline(lines) {
    const results = []
    const pattern = new RegExp(`^\\s*(?:${NIM_DEFS})\\s+([a-zA-Z_][a-zA-Z0-9_]*\\*?)\\s*[*(\\[]`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      const m = lines[i].match(pattern)
      if (m) {
        const name = m[1].replace(/\*$/, '')  // убрать маркер экспорта
        results.push({ name: name + "()", line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const e = esc(methodName)
    const p = new RegExp(`(?:${NIM_DEFS})\\s+${e}\\*?\\s*[*(\\[]`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
    }
    return null
  }
}
