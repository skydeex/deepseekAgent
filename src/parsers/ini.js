// Парсер INI/CFG/Properties (.ini, .cfg, .conf, .properties, .env)
// Outline: секции [section] + ключи верхнего уровня

export default {
  extensions: [".ini", ".cfg", ".conf", ".properties", ".env"],

  outline(lines) {
    const results = []
    let inSection = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith('#') || line.startsWith(';')) continue
      // Секция
      const sec = line.match(/^\[([^\]]+)\]/)
      if (sec) {
        results.push({ name: '[' + sec[1] + ']', line: i + 1 })
        inSection = true
        continue
      }
      // Ключи вне секций (только top-level)
      if (!inSection) {
        const kv = line.match(/^([a-zA-Z_][\w.\-]*)\s*[=:]/)
        if (kv) results.push({ name: kv[1], line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const secPat = new RegExp(`^\\[\\s*${name.replace(/[[\]]/g, '')}\\s*\\]`)
    const kvPat  = new RegExp(`^${name}\\s*[=:]`)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (secPat.test(line) || kvPat.test(line)) return i + 1
    }
    return null
  }
}
