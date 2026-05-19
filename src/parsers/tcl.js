// Парсер Tcl (.tcl, .tk)
// Поддерживает: proc, method (oo::class), constructor, destructor

import { esc } from "./utils.js"

export default {
  extensions: [".tcl", ".tk"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      // proc name {args} {body}
      const procM = lines[i].match(/^\s*proc\s+([\w:]+)\s*\{/)
      if (procM) { results.push({ name: procM[1] + "()", line: i + 1 }); continue }
      // method name {args} {body}  (TclOO)
      const methM = lines[i].match(/^\s*method\s+([a-zA-Z_]\w*)\s*\{/)
      if (methM) { results.push({ name: methM[1] + "()", line: i + 1 }); continue }
      // constructor / destructor
      const ctorM = lines[i].match(/^\s*(constructor|destructor)\s*\{/)
      if (ctorM) results.push({ name: ctorM[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\(\)$/, '')
    const e = esc(name)
    const p = new RegExp(`(?:proc|method)\\s+${e}\\s*\\{|^\\s*${e}\\s*\\{`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(name)) return i + 1
    }
    return null
  }
}
