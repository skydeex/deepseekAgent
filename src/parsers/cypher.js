// Парсер Cypher (.cypher)
// Поддерживает: CALL, CREATE CONSTRAINT/INDEX, именованные блоки запросов

import { esc } from "./utils.js"

export default {
  extensions: [".cypher"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith('//') || line.startsWith('/*')) continue

      // CREATE CONSTRAINT name / CREATE INDEX name
      const schemaM = line.match(/^CREATE\s+(?:CONSTRAINT|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][\w]*)/i)
      if (schemaM) {
        results.push({ name: schemaM[1] + " (schema)", line: i + 1 })
        continue
      }

      // CALL procedure.name(
      const callM = line.match(/^CALL\s+([\w.]+)\s*\(/i)
      if (callM) {
        results.push({ name: callM[1] + " (call)", line: i + 1 })
        continue
      }

      // Начало нового запроса (MATCH/MERGE/CREATE/WITH на нулевой строке после пустой)
      const stmtM = line.match(/^(MATCH|MERGE|CREATE|WITH|UNWIND|FOREACH)\b/i)
      if (stmtM && (i === 0 || !lines[i - 1].trim())) {
        const preview = line.slice(0, 50).replace(/\s+/g, ' ')
        results.push({ name: preview, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\s*\(.*\)$/, '').trim()
    const e = esc(name)
    const patterns = [
      new RegExp(`CREATE\\s+(?:CONSTRAINT|INDEX)\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${e}\\b`, 'i'),
      new RegExp(`CALL\\s+${e}\\s*\\(`, 'i')
    ]
    for (let i = 0; i < lines.length; i++) {
      for (const p of patterns) {
        if (p.test(lines[i].trim()) && lines[i].includes(name)) return i + 1
      }
    }
    return null
  }
}
