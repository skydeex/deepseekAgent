// Парсер Lua (.lua)
// Поддерживает: function, local function, Class:method, Class.method = function

import { esc } from "./utils.js"

export default {
  extensions: [".lua"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*--/.test(line)) continue

      // function name(  /  local function name(  /  function Class:method(  /  function Class.method(
      let m = line.match(/^\s*(?:local\s+)?function\s+([\w.:]+)\s*\(/)
      if (m) { results.push({ name: m[1] + "()", line: i + 1 }); continue }

      // name = function(  /  Class.method = function(  /  M["key"] = function(
      m = line.match(/^\s*([\w.]+)\s*=\s*function\s*\(/)
      if (m) { results.push({ name: m[1] + "()", line: i + 1 }); continue }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const me = esc(methodName)
    const patterns = [
      new RegExp(`(?:local\\s+)?function\\s+${me}\\s*\\(`),
      new RegExp(`${me}\\s*=\\s*function\\s*\\(`)
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*--/.test(lines[i])) continue
      for (const p of patterns) {
        if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
      }
    }
    return null
  }
}
