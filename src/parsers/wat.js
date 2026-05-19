// Парсер WebAssembly Text Format (.wat, .wast)
// Outline: (func $name ...) + (export "name" ...) + (module)

import { esc } from "./utils.js"

export default {
  extensions: [".wat", ".wast"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*;;/.test(line)) continue
      // Пропускаем строки-экспорты (не определения): (export "name" ...)
      if (/^\s*\(\s*export\s+"/.test(line)) continue
      // (func $name или (func (export "name"
      const named = line.match(/^\s*\(\s*func\s+\$([a-zA-Z_][a-zA-Z0-9_$.]*)/)
      if (named) { results.push({ name: named[1] + "()", line: i + 1 }); continue }
      const exported = line.match(/^\s*\(\s*func\s+\(export\s+"([^"]+)"/)
      if (exported) { results.push({ name: exported[1] + "()", line: i + 1 }); continue }
      // (module $name)
      const mod = line.match(/^\s*\(\s*module(?:\s+\$([a-zA-Z_]\w*))?/)
      if (mod) results.push({ name: mod[1] ? '$' + mod[1] : 'module', line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '').replace(/^\$/, '')
    const p = new RegExp(`\\(\\s*func\\s+(?:\\$${esc(clean)}|\\(export\\s+"${esc(clean)}")`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
