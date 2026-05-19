// Парсер VHDL (.vhd, .vhdl)
// Поддерживает: entity, architecture, process, procedure, function, package

import { esc } from "./utils.js"

export default {
  extensions: [".vhd", ".vhdl"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*--/.test(line)) continue

      // entity Name is / architecture Name of Entity is
      const entityM = line.match(/^\s*entity\s+([A-Za-z_]\w*)\s+is\b/i)
      if (entityM) { results.push({ name: `${entityM[1]} (entity)`, line: i + 1 }); continue }

      const archM = line.match(/^\s*architecture\s+([A-Za-z_]\w*)\s+of\s+([A-Za-z_]\w*)\s+is\b/i)
      if (archM) { results.push({ name: `${archM[1]} of ${archM[2]}`, line: i + 1 }); continue }

      // package Name is / package body Name is
      const pkgM = line.match(/^\s*package\s+(?:body\s+)?([A-Za-z_]\w*)\s+is\b/i)
      if (pkgM) { results.push({ name: `${pkgM[1]} (package)`, line: i + 1 }); continue }

      // procedure Name / function Name
      const subM = line.match(/^\s*(procedure|function)\s+([A-Za-z_]\w*)\s*(?:\(|is\b|return\b)/i)
      if (subM) { results.push({ name: subM[2] + "()", line: i + 1 }); continue }

      // process (sensitivity_list) — анонимный, показываем с номером строки
      if (/^\s*(?:[A-Za-z_]\w*\s*:\s*)?process\s*(?:\(|$)/i.test(line)) {
        results.push({ name: `process_L${i + 1}`, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\(\)$/, '').replace(/\s*\(.*\)$/, '')
    const e = esc(name)
    const patterns = [
      new RegExp(`entity\\s+${e}\\s+is\\b`, 'i'),
      new RegExp(`architecture\\s+${e}\\s+of\\b`, 'i'),
      new RegExp(`package\\s+(?:body\\s+)?${e}\\s+is\\b`, 'i'),
      new RegExp(`(?:procedure|function)\\s+${e}\\s*(?:\\(|is\\b|return\\b)`, 'i'),
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*--/.test(lines[i])) continue
      for (const p of patterns) {
        if (p.test(lines[i]) && lines[i].toLowerCase().includes(name.toLowerCase())) return i + 1
      }
    }
    return null
  }
}
