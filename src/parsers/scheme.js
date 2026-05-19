// Парсер Scheme (.scm, .ss, .sld)
// Outline: define / define-syntax / define-record-type

import { esc } from "./utils.js"

export default {
  extensions: [".scm", ".ss", ".sld"],

  outline(lines) {
    const results = []
    // (define (name ...) или (define name
    const pat = /^\s*\(\s*define(?:-syntax|-record-type)?\s+(?:\(?\s*([a-zA-Z!$%&*+\-./:<=>?@^_~][a-zA-Z0-9!$%&*+\-./:<=>?@^_~]*))/
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*;/.test(line)) continue
      const m = line.match(pat)
      if (m && m[1]) {
        const name = m[1]
        const isFunc = /\(\s*define\s+\(/.test(line)
        results.push({ name: isFunc ? name + '()' : name, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '')
    const p = new RegExp(`^\\s*\\(\\s*define(?:-syntax|-record-type)?\\s+\\(?\\s*${esc(clean)}\\b`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
