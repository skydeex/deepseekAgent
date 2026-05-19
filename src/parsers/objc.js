// Парсер Objective-C (.m, .mm)
// Поддерживает: - (type)method, + (type)classMethod, C-функции,
//               @interface/@implementation

import { strip, esc } from "./utils.js"

const CPP_KW = new Set(["if","while","for","switch","catch","return","new","delete"])

export default {
  extensions: [".m", ".mm"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*\/\//.test(line)) continue

      // @interface ClassName / @implementation ClassName
      const ifaceM = line.match(/^\s*@(?:interface|implementation)\s+([A-Za-z_]\w*)/)
      if (ifaceM) { results.push({ name: `@${ifaceM[1]}`, line: i + 1 }); continue }

      // Obj-C instance method: - (type)methodName:param
      // Obj-C class method:    + (type)methodName
      const objcM = line.match(/^\s*[+-]\s*\([^)]+\)\s*([a-zA-Z_]\w*)/)
      if (objcM) { results.push({ name: objcM[1] + "()", line: i + 1 }); continue }

      // C function: type name(  (в .m файлах тоже встречаются)
      if (/^\s*#/.test(line)) continue
      const clean = strip(line)
      const fnM = clean.match(
        /^\s*(?:(?:static|inline|extern|const)\s+)*(?:[\w*]+\s+)+\**([a-zA-Z_]\w*)\s*\(/
      )
      if (fnM && !CPP_KW.has(fnM[1])) {
        const lookahead = lines.slice(i, Math.min(i + 3, lines.length)).join(" ")
        const bodyOpen = lookahead.indexOf("{")
        const semi = lookahead.indexOf(";")
        if (bodyOpen >= 0 && (semi < 0 || semi > bodyOpen)) {
          results.push({ name: fnM[1] + "()", line: i + 1 })
        }
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\(\)$/, '')
    const e = esc(name)
    const objcP = new RegExp(`^\\s*[+-]\\s*\\([^)]+\\)\\s*${e}\\b`)
    const classP = new RegExp(`^\\s*@(?:interface|implementation)\\s+${e}\\b`)
    const cFnP   = new RegExp(`\\*?${e}\\s*\\(`)
    // Для Obj-C методов предпочитаем имплементацию (с телом {})
    let fallback = null
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i]) || /^\s*#/.test(lines[i])) continue
      if (classP.test(lines[i]) && lines[i].includes(name)) return i + 1
      if (objcP.test(lines[i]) && lines[i].includes(name)) {
        const lookahead = lines.slice(i, Math.min(i + 3, lines.length)).join(" ")
        if (lookahead.includes('{')) return i + 1
        if (!fallback) fallback = i + 1
      }
      const clean = strip(lines[i])
      if (cFnP.test(clean) && clean.includes(name)) {
        const lookahead = lines.slice(i, Math.min(i + 3, lines.length)).join(" ")
        const bodyOpen = lookahead.indexOf("{")
        const semi = lookahead.indexOf(";")
        if (bodyOpen >= 0 && (semi < 0 || semi > bodyOpen)) return i + 1
      }
    }
    return fallback
  }
}
