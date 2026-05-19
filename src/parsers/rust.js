// Парсер Rust (.rs)
// Поддерживает: fn, pub fn, async fn, pub(crate) fn, методы impl

import { strip, esc } from "./utils.js"

const VISIBILITY = "(?:pub(?:\\([^)]*\\))?\\s+)?"
const QUALIFIERS  = "(?:(?:async|unsafe|extern(?:\\s+\"[^\"]*\")?|const|default)\\s+)*"

export default {
  extensions: [".rs"],

  outline(lines) {
    const results = []
    const pattern = new RegExp(`^\\s*${VISIBILITY}${QUALIFIERS}fn\\s+([a-zA-Z_]\\w*)\\s*[<(]`)
    for (let i = 0; i < lines.length; i++) {
      const clean = strip(lines[i])
      const m = clean.match(pattern)
      if (m) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`${VISIBILITY}${QUALIFIERS}fn\\s+${esc(methodName)}\\s*[<(]`)
    for (let i = 0; i < lines.length; i++) {
      const clean = strip(lines[i])
      if (p.test(clean) && clean.includes(methodName)) return i + 1
    }
    return null
  }
}
