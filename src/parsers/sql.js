// Парсер SQL (.sql)
// Поддерживает: CREATE FUNCTION/PROCEDURE/VIEW/TABLE/TRIGGER/INDEX/TYPE

import { esc } from "./utils.js"

const CREATE_RE = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?(?:UNIQUE\s+)?(FUNCTION|PROCEDURE|VIEW|TABLE|TRIGGER|INDEX|SEQUENCE|TYPE)\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[]?[\w$.]+[`"\]]?)/i

export default {
  extensions: [".sql"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*--/.test(lines[i])) continue
      const m = lines[i].match(CREATE_RE)
      if (m) {
        const kind = m[1].toUpperCase()
        const name = m[2].replace(/[`"[\]]/g, '')
        results.push({ name: `${name} (${kind})`, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    // methodName может быть "get_user (FUNCTION)" или просто "get_user"
    const bare = methodName.replace(/\s*\(.*\)$/, '').replace(/[`"[\]]/g, '').trim()
    const e = esc(bare)
    const p = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:\\w+\\s+)*["'\`]?${e}["'\`]?\\s*(?:\\(|AS\\b|IS\\b|$)`, 'i')
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*--/.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].toLowerCase().includes(bare.toLowerCase())) return i + 1
    }
    return null
  }
}
