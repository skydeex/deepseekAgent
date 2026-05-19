// Парсер Swift (.swift)
// Поддерживает: func, init, deinit, subscript, static/class func

import { strip, esc } from "./utils.js"

const MODS = "(?:(?:public|private|internal|fileprivate|open|static|class|override|final|required|convenience|weak|lazy|mutating|nonmutating|dynamic|optional|indirect|nonisolated|isolated)\\s+)*"

export default {
  extensions: [".swift"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const clean = strip(lines[i])

      // func methodName<...>(
      let m = clean.match(new RegExp(`^\\s*${MODS}func\\s+([a-zA-Z_]\\w*)\\s*[<(]`))
      if (m) { results.push({ name: m[1] + "()", line: i + 1 }); continue }

      // init / init? / init!
      m = clean.match(/^\s*(?:(?:required|convenience|public|private|fileprivate|internal|override)\s+)*init[?!]?\s*[(<]/)
      if (m) { results.push({ name: "init()", line: i + 1 }); continue }

      // deinit
      if (/^\s*deinit\s*\{/.test(clean)) {
        results.push({ name: "deinit()", line: i + 1 }); continue
      }

      // subscript
      m = clean.match(/^\s*(?:static\s+)?subscript\s*[\[(]/)
      if (m) { results.push({ name: "subscript()", line: i + 1 }); continue }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    if (methodName === "init") {
      for (let i = 0; i < lines.length; i++) {
        const clean = strip(lines[i])
        if (/(?:required|convenience)?\s*init[?!]?\s*[(<]/.test(clean)) return i + 1
      }
    }
    const p = new RegExp(`${MODS}func\\s+${esc(methodName)}\\s*[<(]`)
    for (let i = 0; i < lines.length; i++) {
      const clean = strip(lines[i])
      if (p.test(clean) && clean.includes(methodName)) return i + 1
    }
    return null
  }
}
