// Парсер Dart (.dart)
// Поддерживает: методы, конструкторы, factory, async, get/set, @override

import { esc } from "./utils.js"

const DART_KW = new Set([
  "if","while","for","switch","catch","try","else","return","new","throw",
  "assert","rethrow","await","yield","super","this","get","set"
])
const MODS = "(?:(?:static|abstract|external|covariant|required|late|@\\w+(?:\\.\\w+)*)\\s+)*"
const TYPE = "(?:(?:Future|Stream|List|Map|Set|Iterable|[A-Za-z_$][\\w$]*(?:<[^>]*>)?)(?:\\?)?\\s+)?"

export default {
  extensions: [".dart"],

  outline(lines) {
    const results = []
    const pattern = new RegExp(
      `^\\s*(?:factory\\s+)?${MODS}(?:async\\s+)?${TYPE}([a-zA-Z_$][\\w$]*)\\s*[(<]`
    )
    // Also: get propertyName / set propertyName
    const getset = /^\s*(?:static\s+)?(?:[\w<>?[\]]+\s+)?(?:get|set)\s+([a-zA-Z_$]\w*)\s*[({=>]/

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*\/\//.test(line)) continue

      let m = line.match(getset)
      if (m) { results.push({ name: m[1] + "()", line: i + 1 }); continue }

      m = line.match(pattern)
      if (!m) continue
      const name = m[1]
      if (DART_KW.has(name)) continue
      if (name === name.toUpperCase() && name.length > 2) continue
      results.push({ name: name + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`(?:factory\\s+)?${MODS}${TYPE}${esc(methodName)}\\s*[(<]`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
    }
    return null
  }
}
