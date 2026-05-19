// Парсер C# (.cs)
// Поддерживает: методы, async методы, свойства (get/set), конструкторы

import { esc } from "./utils.js"

const CS_KW = new Set([
  "if","while","for","foreach","switch","catch","try","else","return","new",
  "lock","using","throw","await","yield","where","select","from","let",
  "orderby","join","group","into","on","equals","by"
])
const MODS = "(?:(?:public|private|protected|internal|static|virtual|override|abstract|sealed|async|extern|partial|readonly|new|unsafe|volatile)\\s+)*"
const TYPE = "(?:~?[a-zA-Z_@][\\w.]*(?:<[^>]*>)?(?:\\[,*\\])*(?:\\?)?\\s+)"

export default {
  extensions: [".cs"],

  outline(lines) {
    const results = []
    const pattern = new RegExp(`^\\s*(?:\\[[^\\]]+\\]\\s*)*${MODS}${TYPE}([a-zA-Z_@][\\w]*)\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(pattern)
      if (!m) continue
      const name = m[1]
      if (CS_KW.has(name.toLowerCase())) continue
      if (name === name.toUpperCase() && name.length > 2) continue  // CONSTANT
      results.push({ name: name + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`${MODS}${TYPE}${esc(methodName)}\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
    }
    return null
  }
}
