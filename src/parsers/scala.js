// Парсер Scala (.scala, .sc)
// Поддерживает: def, val/var с функциями, given, extension (Scala 3)

import { strip, esc } from "./utils.js"

const MODS = "(?:(?:override|protected|private(?:\\[\\w+\\])?|abstract|final|sealed|implicit|lazy|inline|transparent|opaque|open|infix|erased)\\s+)*"

export default {
  extensions: [".scala", ".sc"],

  outline(lines) {
    const results = []
    const defPat = new RegExp(`^\\s*${MODS}def\\s+([a-zA-Z_$][\\w$]*)\\s*(?:[\\[(=:{]|$)`)
    for (let i = 0; i < lines.length; i++) {
      const clean = strip(lines[i])
      const m = clean.match(defPat)
      if (m) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`${MODS}def\\s+${esc(methodName)}\\s*(?:[\\[(=:{]|$)`)
    for (let i = 0; i < lines.length; i++) {
      const clean = strip(lines[i])
      if (p.test(clean) && clean.includes(methodName)) return i + 1
    }
    return null
  }
}
