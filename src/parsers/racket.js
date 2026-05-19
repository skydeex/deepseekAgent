// Парсер Racket (.rkt, .rktl, .scrbl)
// Поддерживает: define, define/contract, define-syntax, define-values,
//               module, struct, class, interface

import { esc } from "./utils.js"

// Матчит: (define (name / (define name / (define-syntax name / etc.
const DEFINE_RE = /^\s*\((define[\w/\-]*)\s+\(?([a-zA-Z_!?<>.*+\-/][a-zA-Z0-9_!?<>.*+\-/:']*)/

export default {
  extensions: [".rkt", ".rktl", ".scrbl"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*;/.test(lines[i])) continue
      // (define (name args) body) или (define name value)
      const m = lines[i].match(DEFINE_RE)
      if (m) {
        const name = m[2]
        if (name) results.push({ name: name + "()", line: i + 1 })
        continue
      }
      // (module name ...) / (struct name ...) / (class name ...)
      const topM = lines[i].match(/^\s*\((module|struct|class|interface)\s+([a-zA-Z_]\w*)/)
      if (topM) results.push({ name: `${topM[2]} (${topM[1]})`, line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\(\)$/, '')
    const e = esc(name)
    const p = new RegExp(`\\(define[\\w/\\-]*\\s+\\(?${e}\\b`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*;/.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(name)) return i + 1
    }
    return null
  }
}
