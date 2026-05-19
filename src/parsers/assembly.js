// Парсер Assembly (.asm, .s, .S, .nasm, .inc)
// Outline: метки (label:) + proc/procedure/function директивы

import { esc } from "./utils.js"

export default {
  extensions: [".asm", ".s", ".S", ".nasm", ".inc"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Пропускаем комментарии
      if (/^\s*[;#]/.test(line)) continue
      // PROC/proc директива (MASM/TASM)
      const proc = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_@$?.]*)\s+(?:PROC|proc)\b/)
      if (proc) { results.push({ name: proc[1] + "()", line: i + 1 }); continue }
      // .func / .type name, @function (GAS)
      const gas = line.match(/^\s*\.(?:func|type)\s+([a-zA-Z_][a-zA-Z0-9_@$?.]*)/)
      if (gas) { results.push({ name: gas[1] + "()", line: i + 1 }); continue }
      // Метки: name: (не внутри строки, начинается с 0 или пробела)
      const lbl = line.match(/^([a-zA-Z_][a-zA-Z0-9_@$?.]*):(?!\s*=)/)
      if (lbl && !lbl[1].startsWith('.')) {
        results.push({ name: lbl[1] + ':', line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/[:()\s].*$/, '')
    const p = new RegExp(`^\\s*${esc(clean)}(?:\\s+(?:PROC|proc)|:)`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
