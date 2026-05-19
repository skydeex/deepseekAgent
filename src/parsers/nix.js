// Парсер Nix (.nix)
// Поддерживает: top-level атрибуты (особенно функции),
//               let-биндинги, inherit, pkgs.callPackage-паттерны

import { esc } from "./utils.js"

export default {
  extensions: [".nix"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*#/.test(line)) continue

      // Атрибут = значение (не вложенный — до 1 уровня отступа)
      // name = ... или "name" = ...
      // Приоритет: если RHS содержит : или { — скорее всего функция/attrset
      const attrM = line.match(/^([ ]{0,4})([a-zA-Z_"][a-zA-Z0-9_'"-]*(?:\.[a-zA-Z_][a-zA-Z0-9_']*)*)\s*=\s*(.*)/)
      if (attrM && attrM[1].length <= 2) {
        const name = attrM[2].replace(/"/g, '')
        const rhs = attrM[3].trim()
        // Пропускаем просто значения, показываем функции и attrset
        if (rhs.match(/^(?:[a-zA-Z_{]|\/\*)/)) {
          results.push({ name, line: i + 1 })
        }
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const e = esc(methodName.replace(/"/g, ''))
    const p = new RegExp(`^\\s{0,4}"?${e}"?\\s*=`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(methodName.replace(/"/g, ''))) return i + 1
    }
    return null
  }
}
