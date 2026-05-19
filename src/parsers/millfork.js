// Парсер Millfork (.mfk)
// Язык для ретро-ЭВМ: 6502, Z80, 8080, 6809
// Синтаксис: [модификаторы] тип имя(параметры) { тело }
//
// Модификаторы: asm, macro, inline, noinline, interrupt,
//               kernal_interrupt, const, extern, segment(x)

import { esc } from "./utils.js"

// Встроенные типы Millfork
const MFK_TYPES = "void|byte|ubyte|sbyte|word|uword|long|ulong|pointer|bool|int"
// Модификаторы (могут стоять перед типом, несколько штук)
const MFK_MODS  = `(?:(?:asm|macro|inline|noinline|interrupt|kernal_interrupt|const|extern|segment\\s*\\([^)]*\\))\\s+)*`

const FN_RE = new RegExp(
  `^\\s*${MFK_MODS}(?:${MFK_TYPES}|[A-Z][a-zA-Z0-9_]*)\\s+([a-z_][a-zA-Z0-9_]*)\\s*\\(`
)

export default {
  extensions: [".mfk"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      const m = lines[i].match(FN_RE)
      if (m) {
        // Убеждаемся что это определение (есть { на этой или следующих строках)
        const look = lines.slice(i, Math.min(i + 4, lines.length)).join(" ")
        const brace = look.indexOf("{")
        const semi  = look.indexOf(";")
        if (brace >= 0 && (semi < 0 || semi > brace)) {
          results.push({ name: m[1] + "()", line: i + 1 })
        }
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\(\)$/, '')
    const e = esc(name)
    const p = new RegExp(`${MFK_MODS}(?:${MFK_TYPES}|[A-Z][a-zA-Z0-9_]*)\\s+${e}\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(name)) {
        const look = lines.slice(i, Math.min(i + 4, lines.length)).join(" ")
        const brace = look.indexOf("{")
        const semi  = look.indexOf(";")
        if (brace >= 0 && (semi < 0 || semi > brace)) return i + 1
      }
    }
    return null
  }
}
