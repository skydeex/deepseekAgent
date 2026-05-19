// Парсер CMake (.cmake, CMakeLists.txt)
// Outline: function(), macro(), add_executable/library, project()

import { esc } from "./utils.js"

export default {
  extensions: [".cmake"],
  // Примечание: CMakeLists.txt не имеет расширения — обрабатывается через basename в optimizer.js

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*#/.test(line)) continue
      // function/macro definition
      const def = line.match(/^\s*(function|macro)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)/i)
      if (def) { results.push({ name: def[2] + "()", line: i + 1 }); continue }
      // project()
      const proj = line.match(/^\s*project\s*\(\s*([a-zA-Z_][a-zA-Z0-9_\-]*)/i)
      if (proj) { results.push({ name: 'project(' + proj[1] + ')', line: i + 1 }); continue }
      // add_executable / add_library
      const tgt = line.match(/^\s*(add_executable|add_library)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_\-]*)/i)
      if (tgt) results.push({ name: tgt[2], line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '').replace(/^project\((.+)\)$/, '$1').replace(/^add_\w+\((.+)\)$/, '$1')
    const p = new RegExp(`(?:function|macro)\\s*\\(\\s*${esc(clean)}\\b`, 'i')
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i]) || lines[i].match(new RegExp(`(?:add_executable|add_library|project)\\s*\\(\\s*${esc(clean)}\\b`, 'i'))) return i + 1
    }
    return null
  }
}
