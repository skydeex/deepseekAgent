// Парсер LaTeX (.tex, .sty, .cls)
// Outline: \chapter, \section, \subsection, \newcommand, \begin{document}

import { esc } from "./utils.js"

export default {
  extensions: [".tex", ".sty", ".cls", ".bib"],

  outline(lines) {
    const results = []
    const sectPat = /\\(chapter|section|subsection|subsubsection|paragraph)\*?\{([^}]+)\}/
    const cmdPat  = /\\(?:new|renew)command\{?\\([a-zA-Z@]+)\}?/
    const envPat  = /\\begin\{([a-zA-Z*]+)\}/
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*%/.test(line)) continue
      let m
      m = line.match(sectPat)
      if (m) { results.push({ name: '\\' + m[1] + '{' + m[2] + '}', line: i + 1 }); continue }
      m = line.match(cmdPat)
      if (m) { results.push({ name: '\\' + m[1], line: i + 1 }); continue }
      m = line.match(envPat)
      if (m && m[1] === 'document') results.push({ name: '\\begin{' + m[1] + '}', line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, name) {
    // name может быть \section{Foo} или \myCmd
    const clean = name.replace(/^\\/, '')
    const p = new RegExp(`\\\\(?:[a-z]+(?:command)?)(?:\\{\\\\${esc(clean)}\\}|\\*?\\{${esc(clean)}\\})`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*%/.test(lines[i])) continue
      if (p.test(lines[i]) || lines[i].includes(name)) return i + 1
    }
    return null
  }
}
