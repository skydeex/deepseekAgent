// Парсер PL/M-80 (.plm, .PLM)
// Язык Intel для 8080/8085, Pascal-образный блочный стиль
//
// Процедура: NAME: PROCEDURE [(params)] [type];
//              ...тело...
//            END NAME;

import { esc } from "./utils.js"

export default {
  extensions: [".plm"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\*/.test(lines[i])) continue  // /* комментарий */
      // NAME: PROCEDURE ... ;
      const m = lines[i].match(/^\s*([A-Za-z][A-Za-z0-9$]*)\s*:\s*PROCEDURE\b/i)
      if (m) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\(\)$/, '')
    const e = esc(name)
    const p = new RegExp(`^\\s*${e}\\s*:\\s*PROCEDURE\\b`, 'i')
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i]) && lines[i].toLowerCase().includes(name.toLowerCase())) return i + 1
    }
    return null
  }
}
