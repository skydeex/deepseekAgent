// Парсер Java (.java)
// Поддерживает: public/private/protected методы, конструкторы, generics

import { esc } from "./utils.js"

const JAVA_KW = new Set([
  "if","while","for","switch","catch","try","else","return","new","throw",
  "synchronized","assert","instanceof","class","interface","enum","record"
])
const MODS = "(?:(?:public|private|protected|static|final|abstract|synchronized|native|default|strictfp|transient|volatile|override)\\s+)*"
const TYPE = "[a-zA-Z_$][\\w$]*(?:<[^>]*>)?(?:\\[\\])*"

export default {
  extensions: [".java"],

  outline(lines) {
    const results = []
    // Matches: [modifiers] ReturnType methodName(
    const pattern = new RegExp(`^\\s*(?:@\\w+\\s+)*${MODS}${TYPE}\\s+([a-zA-Z_$][\\w$]*)\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(pattern)
      if (!m) continue
      const name = m[1]
      if (JAVA_KW.has(name)) continue
      if (name === name.toUpperCase() && name.length > 2) continue  // CONSTANT
      results.push({ name: name + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`${MODS}${TYPE}\\s+${esc(methodName)}\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
    }
    return null
  }
}
