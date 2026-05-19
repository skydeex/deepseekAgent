// Парсер C/C++ (.c, .h, .cpp, .hpp, .cc, .cxx)
// Поддерживает: функции, методы классов (ClassName::method), деструкторы (~Name)
// Ограничение: пропускает forward declarations (без тела), шаблоны могут быть неточны

import { strip, esc } from "./utils.js"

const CPP_KW = new Set([
  "if","while","for","switch","catch","do","else","return","new","delete",
  "operator","sizeof","alignof","decltype","throw","static_assert","requires",
  "co_await","co_return","co_yield","case","default"
])

export default {
  extensions: [".c", ".h", ".cpp", ".hpp", ".cc", ".cxx"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      if (/^\s*#/.test(raw)) continue         // препроцессор
      if (/^\s*\/\//.test(raw)) continue      // комментарий
      const clean = strip(raw)

      // Ищем: [qualifiers] [ClassName::] FunctionName(
      // qualifiers: static, inline, virtual, explicit, constexpr, [[nodiscard]], override, const, ~
      const m = clean.match(
        /^\s*(?:(?:static|inline|virtual|explicit|constexpr|extern|friend|[[nodiscard\]]*|override|final|auto)\s+)*(?:[\w:*&<>~\[\]]+\s+)+?((?:[\w:]+::)*~?[a-zA-Z_]\w*)\s*\(/
      )
      if (!m) continue
      const name = m[1].includes("::") ? m[1].split("::").pop() : m[1]
      if (!name || CPP_KW.has(name)) continue

      // Определение (имеет тело): { на этой или следующих 2-х строках,
      // и нет ; до {
      const lookahead = lines.slice(i, Math.min(i + 4, lines.length)).join(" ")
      const bodyOpen  = lookahead.indexOf("{")
      const semicolon = lookahead.indexOf(";")
      if (bodyOpen < 0) continue
      if (semicolon >= 0 && semicolon < bodyOpen) continue

      results.push({ name: name + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    // Ищем и ClassName::methodName, и просто methodName
    const patterns = [
      new RegExp(`(?:[\\w:]+::)?${esc(methodName)}\\s*\\(`),
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      const clean = strip(lines[i])
      for (const p of patterns) {
        if (!p.test(clean) || !clean.includes(methodName)) continue
        // Проверяем что это определение, а не declaration
        const lookahead = lines.slice(i, Math.min(i + 4, lines.length)).join(" ")
        const bodyOpen  = lookahead.indexOf("{")
        const semicolon = lookahead.indexOf(";")
        if (bodyOpen < 0) continue
        if (semicolon >= 0 && semicolon < bodyOpen) continue
        return i + 1
      }
    }
    return null
  }
}
