// Парсер R (.r, .R, .Rmd)
// Поддерживает: name <- function(args), name = function(args)
// Также: setGeneric, setMethod (S4 OOP)

import { esc } from "./utils.js"

export default {
  extensions: [".r", ".R", ".Rmd"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*#/.test(line)) continue

      // name <- function(  /  name = function(
      let m = line.match(/^\s*([a-zA-Z_.][a-zA-Z0-9._]*)\s*(?:<-|=)\s*function\s*\(/)
      if (m) { results.push({ name: m[1] + "()", line: i + 1 }); continue }

      // setGeneric("name", ...)  /  setMethod("name", ...)
      m = line.match(/^\s*set(?:Generic|Method|RefClass)\s*\(\s*["']([a-zA-Z_.]\w*)["']/)
      if (m) { results.push({ name: m[1] + "()", line: i + 1 }); continue }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const me = esc(methodName)
    const patterns = [
      new RegExp(`${me}\\s*(?:<-|=)\\s*function\\s*\\(`),
      new RegExp(`set(?:Generic|Method)\\s*\\(\\s*["']${me}["']`)
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      for (const p of patterns) {
        if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
      }
    }
    return null
  }
}
