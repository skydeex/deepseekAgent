// Парсер YAML (.yaml, .yml)
// Outline: top-level ключи и ключи первого уровня вложенности

export default {
  extensions: [".yaml", ".yml"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Пропускаем комментарии, пустые строки, list items
      if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue
      if (/^\s*-\s/.test(line)) continue
      // Top-level ключ (без отступа) или первый уровень (2 пробела)
      const m = line.match(/^( {0,2})([a-zA-Z_$][\w\-.$]*)\s*:/)
      if (m) {
        const indent = m[1].length
        const name = m[2]
        // Пропускаем слишком глубокие ключи
        if (indent <= 2) results.push({ name, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      const m = lines[i].match(/^( {0,2})(\S[\w\-.$]*):(?:\s|$)/)
      if (m && m[2] === name) return i + 1
    }
    return null
  }
}
