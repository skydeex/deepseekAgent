// Парсер D (.d)
// Поддерживает: функции, методы классов/структур, шаблонные функции, unittest

import { strip, esc } from "./utils.js"

const D_KW = new Set([
  "if","while","for","foreach","switch","catch","do","else","return",
  "new","delete","assert","pragma","static","scope","version","debug"
])

const D_QUALS = "(?:(?:public|private|protected|package|static|final|override|abstract|pure|nothrow|@safe|@nogc|@property|@trusted|const|immutable|shared|inout|lazy|ref|auto|extern)\\s+)*"

export default {
  extensions: [".d"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      if (/^\s*\/\//.test(raw)) continue
      if (/^\s*unittest\s*\{/.test(raw)) { results.push({ name: "unittest", line: i + 1 }); continue }
      const clean = strip(raw)
      // class/struct/interface/enum/module/template Name
      const topM = clean.match(/^\s*(?:class|struct|interface|enum|module|template)\s+([A-Za-z_]\w*)/)
      if (topM) { results.push({ name: topM[1], line: i + 1 }); continue }

      // function: qualifiers type name( ... ) {
      const fnM = clean.match(
        new RegExp(`^\\s*${D_QUALS}(?:[\\w*\\[\\]]+\\s+)+([a-zA-Z_]\\w*)\\s*\\(`)
      )
      if (fnM) {
        const name = fnM[1]
        if (D_KW.has(name)) continue
        const lookahead = lines.slice(i, Math.min(i + 4, lines.length)).join(" ")
        const bodyOpen = lookahead.indexOf("{")
        const semi = lookahead.indexOf(";")
        if (bodyOpen >= 0 && (semi < 0 || semi > bodyOpen)) {
          results.push({ name: name + "()", line: i + 1 })
        }
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\(\)$/, '')
    const e = esc(name)
    const p = new RegExp(`(?:class|struct|interface|template)\\s+${e}\\b|${e}\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      const clean = strip(lines[i])
      if (p.test(clean) && clean.includes(name)) {
        const lookahead = lines.slice(i, Math.min(i + 4, lines.length)).join(" ")
        const bodyOpen = lookahead.indexOf("{")
        const semi = lookahead.indexOf(";")
        if (bodyOpen >= 0 && (semi < 0 || semi > bodyOpen)) return i + 1
      }
    }
    return null
  }
}
