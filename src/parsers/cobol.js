// Парсер COBOL (.cob, .cbl, .cpy)
// Outline: DIVISION, SECTION, параграфы процедур

import { esc } from "./utils.js"

export default {
  extensions: [".cob", ".cbl", ".cpy"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // COBOL комментарии: * в 7-й позиции или строка начинается с *>
      if (/^\*>|^.{6}\*/.test(line)) continue
      const trimmed = line.trim().toUpperCase()
      // DIVISION
      const div = trimmed.match(/^([A-Z][A-Z\-]*)\s+DIVISION\./)
      if (div) { results.push({ name: div[1] + ' DIVISION', line: i + 1 }); continue }
      // SECTION
      const sec = trimmed.match(/^([A-Z][A-Z0-9\-]*)\s+SECTION\./)
      if (sec) { results.push({ name: sec[1] + ' SECTION', line: i + 1 }); continue }
      // Параграф (PROCEDURE DIVISION): метка без DIVISION/SECTION
      // Только в PROCEDURE: строка начинается с буквы, заканчивается на .
      if (/^[A-Z][A-Z0-9\-]*\.$/.test(trimmed) && !trimmed.includes('DIVISION') && !trimmed.includes('SECTION')) {
        results.push({ name: trimmed.replace(/\.$/, ''), line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const isDivSec = /\s*(DIVISION|SECTION)$/.test(name)
    const clean = name.replace(/\s*(DIVISION|SECTION)$/, '').trim()
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim().toUpperCase()
      if (isDivSec) {
        // Ищем: NAME DIVISION. или NAME SECTION.
        const suffix = /DIVISION/.test(name) ? 'DIVISION' : 'SECTION'
        if (trimmed.startsWith(clean.toUpperCase() + ' ' + suffix)) return i + 1
      } else {
        // Параграф: NAME. в конце строки
        if (trimmed === clean.toUpperCase() + '.') return i + 1
      }
    }
    return null
  }
}
