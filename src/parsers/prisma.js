// Парсер Prisma (.prisma)
// Поддерживает: model, enum, datasource, generator, type (composite)

import { esc } from "./utils.js"

const PRISMA_RE = /^\s*(model|enum|datasource|generator|type)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/

export default {
  extensions: [".prisma"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      const m = lines[i].match(PRISMA_RE)
      if (m) results.push({ name: `${m[2]} (${m[1]})`, line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\s*\(.*\)$/, '')
    const e = esc(name)
    const p = new RegExp(`(?:model|enum|datasource|generator|type)\\s+${e}\\s*\\{`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(name)) return i + 1
    }
    return null
  }
}
