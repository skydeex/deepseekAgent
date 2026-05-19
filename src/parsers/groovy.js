// Парсер Groovy (.groovy, .gradle, .gvy)
// Поддерживает: def methods, typed methods, closures, Gradle tasks

import { esc } from "./utils.js"

const GROOVY_KW = new Set([
  "if","while","for","switch","catch","try","else","return","new","throw",
  "assert","in","with","each","collect","findAll","task"
])
const MODS = "(?:(?:public|private|protected|static|final|abstract|synchronized|def|override)\\s+)*"
const TYPE = "(?:[a-zA-Z_$][\\w$]*(?:<[^>]*>)?(?:\\[\\])*\\s+)?"

export default {
  extensions: [".groovy", ".gradle", ".gvy", ".gy"],

  outline(lines) {
    const results = []
    // def name( / void name( / String name( etc.
    const pattern = new RegExp(`^\\s*${MODS}${TYPE}([a-zA-Z_$][\\w$]*)\\s*\\(`)
    // Gradle task: task taskName { / task taskName(type: Type) {
    const taskPat = /^\s*task\s+([\w]+)\s*[\({]/

    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue

      let m = lines[i].match(taskPat)
      if (m) { results.push({ name: "task:" + m[1] + "()", line: i + 1 }); continue }

      m = lines[i].match(pattern)
      if (!m) continue
      const name = m[1]
      if (GROOVY_KW.has(name)) continue
      if (name === name.toUpperCase() && name.length > 2) continue
      results.push({ name: name + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`${MODS}${TYPE}${esc(methodName)}\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
    }
    return null
  }
}
