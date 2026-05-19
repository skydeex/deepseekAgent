// Парсер Kotlin (.kt, .kts)
// Поддерживает: fun, suspend fun, companion object fun, extension fun

import { strip, esc } from "./utils.js"

const MODS = "(?:(?:public|private|protected|internal|open|final|abstract|override|inline|infix|operator|tailrec|external|suspend|actual|expect|data|sealed|inner|companion|reified|crossinline|noinline|vararg)\\s+)*"

export default {
  extensions: [".kt", ".kts"],

  outline(lines) {
    const results = []
    // fun name( — optionally preceded by type params <T>
    const pattern = new RegExp(`^\\s*${MODS}fun\\s+(?:<[^>]+>\\s+)?(?:[\\w.]+\\.)?([a-zA-Z_]\\w*)\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      const clean = strip(lines[i])
      const m = clean.match(pattern)
      if (m) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`${MODS}fun\\s+(?:<[^>]+>\\s+)?(?:[\\w.]+\\.)?${esc(methodName)}\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      const clean = strip(lines[i])
      if (p.test(clean) && clean.includes(methodName)) return i + 1
    }
    return null
  }
}
