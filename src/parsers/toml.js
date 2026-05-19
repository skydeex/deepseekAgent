// Парсер TOML (.toml)
// Outline: секции [[array]] / [table] + top-level ключи

export default {
  extensions: [".toml"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith('#')) continue
      // Секции: [table] или [[array]]
      const sec = line.match(/^\[{1,2}([^\]]+)\]{1,2}/)
      if (sec) {
        results.push({ name: '[' + sec[1] + ']', line: i + 1 })
        continue
      }
      // Top-level ключи (не внутри секций — без вложенности)
      const kv = line.match(/^([a-zA-Z_][\w\-.]*)\s*=/)
      if (kv) results.push({ name: kv[1], line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, name) {
    // Ищем секцию или ключ
    const secPat = new RegExp(`^\\[{1,2}\\s*${name.replace(/[[\]]/g, '')}\\s*\\]{1,2}`)
    const kvPat  = new RegExp(`^${name}\\s*=`)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (secPat.test(line) || kvPat.test(line)) return i + 1
    }
    return null
  }
}
