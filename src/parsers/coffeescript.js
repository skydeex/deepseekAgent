// Парсер CoffeeScript (.coffee, .litcoffee)
// Outline: функции (name = -> / name: ->), классы

import { esc } from "./utils.js"

export default {
  extensions: [".coffee", ".litcoffee"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*#/.test(line)) continue
      // class definition
      const cls = line.match(/^\s*class\s+([A-Z][a-zA-Z0-9_]*)/)
      if (cls) { results.push({ name: 'class ' + cls[1], line: i + 1 }); continue }
      // Метод класса: name: (args) ->
      const method = line.match(/^\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?::|=)\s*(?:\([^)]*\)\s*)?(?:->|=>)/)
      if (method) { results.push({ name: method[1] + "()", line: i + 1 }); continue }
      // Top-level функция: name = (args) -> или name = ->
      const fn = line.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:\([^)]*\)\s*)?(?:->|=>)/)
      if (fn) results.push({ name: fn[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '').replace(/^class\s+/, '')
    const p = new RegExp(`(?:^|\\s+)${esc(clean)}\\s*(?::|=)\\s*(?:\\([^)]*\\)\\s*)?(?:->|=>)|^class\\s+${esc(clean)}\\b`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
