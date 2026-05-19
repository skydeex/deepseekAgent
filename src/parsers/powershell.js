// Парсер PowerShell (.ps1, .psm1, .psd1)
// Поддерживает: function, filter, workflow, class methods

import { esc } from "./utils.js"

export default {
  extensions: [".ps1", ".psm1", ".psd1"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*#/.test(line)) continue

      // function Verb-Noun / function FunctionName
      let m = line.match(/^\s*function\s+([\w-]+)\s*[\{(]?/i)
      if (m) { results.push({ name: m[1] + "()", line: i + 1 }); continue }

      // filter FilterName
      m = line.match(/^\s*filter\s+([\w-]+)\s*\{/i)
      if (m) { results.push({ name: m[1] + "()", line: i + 1 }); continue }

      // [ReturnType] MethodName([args]) — class method
      m = line.match(/^\s*(?:\[[\w.[\]]+\]\s+)?([A-Z][a-zA-Z0-9_]*)\s*\(/)
      if (m && m[1] !== "If" && m[1] !== "While" && m[1] !== "For") {
        results.push({ name: m[1] + "()", line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const patterns = [
      new RegExp(`function\\s+${esc(methodName)}\\s*[\\{(]?`, "i"),
      new RegExp(`filter\\s+${esc(methodName)}\\s*\\{`, "i"),
      new RegExp(`${esc(methodName)}\\s*\\(`)
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      for (const p of patterns) {
        if (p.test(lines[i]) && lines[i].toLowerCase().includes(methodName.toLowerCase())) return i + 1
      }
    }
    return null
  }
}
