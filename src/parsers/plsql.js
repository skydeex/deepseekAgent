// Парсер PL/SQL (.pls, .pkb, .pks, .prc, .fnc)
// Поддерживает: CREATE PROCEDURE/FUNCTION/PACKAGE/TYPE,
//               PROCEDURE/FUNCTION внутри тела пакета

import { esc } from "./utils.js"

export default {
  extensions: [".pls", ".pkb", ".pks", ".prc", ".fnc"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*--/.test(line)) continue

      // CREATE [OR REPLACE] PROCEDURE/FUNCTION/PACKAGE name
      const createM = line.match(/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:EDITIONABLE\s+)?(?:NON-?EDITIONABLE\s+)?(PROCEDURE|FUNCTION|PACKAGE(?:\s+BODY)?|TYPE(?:\s+BODY)?)\s+([\w$.]+)/i)
      if (createM) {
        results.push({ name: `${createM[2]} (${createM[1].toUpperCase()})`, line: i + 1 })
        continue
      }

      // PROCEDURE name( / FUNCTION name( внутри пакета (с отступом)
      const innerM = line.match(/^\s+(PROCEDURE|FUNCTION)\s+([\w$]+)\s*(?:\(|IS\b|AS\b)/i)
      if (innerM) {
        results.push({ name: `${innerM[2]} (${innerM[1].toUpperCase()})`, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\s*\(.*\)$/, '')
    const e = esc(name)
    const patterns = [
      new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:\\w+\\s+)*(?:PROCEDURE|FUNCTION|PACKAGE(?:\\s+BODY)?)\\s+${e}\\b`, 'i'),
      new RegExp(`(?:PROCEDURE|FUNCTION)\\s+${e}\\s*(?:\\(|IS\\b|AS\\b)`, 'i')
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*--/.test(lines[i])) continue
      for (const p of patterns) {
        if (p.test(lines[i]) && lines[i].toLowerCase().includes(name.toLowerCase())) return i + 1
      }
    }
    return null
  }
}
