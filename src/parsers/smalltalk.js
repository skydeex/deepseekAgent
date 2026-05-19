// Парсер Smalltalk (.st, .gst)
// Outline: методы (! Class >> methodName) + классы (Class subclass: #Name)

import { esc } from "./utils.js"

export default {
  extensions: [".st", ".gst"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*"/.test(line)) continue  // строковые комментарии
      // Pharo/Squeak chunk format: ClassName >> methodName
      const meth = line.match(/([A-Z][a-zA-Z0-9_]*)\s*>>\s*([a-zA-Z_][a-zA-Z0-9_:]*)/)
      if (meth) { results.push({ name: meth[1] + '>>' + meth[2], line: i + 1 }); continue }
      // Class definition: ClassName subclass: #NewClass
      const cls = line.match(/([A-Z][a-zA-Z0-9_]*)\s+(?:subclass|variableSubclass|variableWordSubclass|variableByteSubclass):\s*#([A-Z][a-zA-Z0-9_]*)/)
      if (cls) { results.push({ name: 'class ' + cls[2], line: i + 1 }); continue }
      // GNU Smalltalk method: methodName [
      const gst = line.match(/^([a-zA-Z_][a-zA-Z0-9_:]*)\s+\[/)
      if (gst) results.push({ name: gst[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '')
    const p = new RegExp(`>>${esc(clean)}|${esc(clean)}\\s+\\[`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
