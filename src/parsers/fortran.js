// Парсер Fortran (.f90, .f95, .f03, .f08, .for, .f)
// Поддерживает: SUBROUTINE, FUNCTION, MODULE, PROGRAM, INTERFACE (case-insensitive)

import { esc } from "./utils.js"

export default {
  extensions: [".f90", ".f95", ".f03", ".f08", ".for", ".f"],

  outline(lines) {
    const results = []
    // Паттерн: [PREFIX] SUBROUTINE/FUNCTION name( или MODULE/PROGRAM name
    const pattern = /^\s*(?:(?:PURE|ELEMENTAL|RECURSIVE|IMPURE)\s+)?(?:(SUBROUTINE|FUNCTION)\s+([A-Za-z_]\w*)|(MODULE|PROGRAM|SUBMODULE)\s+([A-Za-z_]\w*))/i
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*!/.test(lines[i])) continue  // комментарий Fortran
      const m = lines[i].match(pattern)
      if (m) {
        if (m[1]) results.push({ name: m[2] + "()", line: i + 1 })
        else      results.push({ name: m[4], line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\(\)$/, '')
    const e = esc(name)
    const p = new RegExp(`(?:SUBROUTINE|FUNCTION|MODULE|PROGRAM|SUBMODULE)\\s+${e}\\b`, 'i')
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*!/.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].toLowerCase().includes(name.toLowerCase())) return i + 1
    }
    return null
  }
}
