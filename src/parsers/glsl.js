// Парсер GLSL/HLSL/WGSL (.glsl, .vert, .frag, .geom, .comp, .tesc, .tese, .hlsl, .wgsl)
// Outline: функции (тип имя(...))

import { esc } from "./utils.js"

export default {
  extensions: [".glsl", ".vert", ".frag", ".geom", ".comp", ".tesc", ".tese", ".hlsl", ".wgsl"],

  outline(lines) {
    const results = []
    // Ключевые слова, которые нельзя принять за тип возврата
    const SKIP = /^\s*(?:return|if|else|for|while|do|switch|case|break|continue|discard|struct)\b/
    // GLSL/HLSL: строго известный тип + имя + ( — только на top-level (нет отступа или 1 уровень)
    const TYPES = /^(?:void|bool|int|uint|float|double|half|[biud]?vec[2-4]|[biud]?mat[2-4](?:x[2-4])?|sampler\w*|[A-Z][a-zA-Z0-9_]*)/
    const pat = /^(?:(?:inline|static|const|flat|smooth|centroid|sample|patch|layout\([^)]*\)\s+)?)((?:void|bool|int|uint|float|double|half|[biud]?vec[2-4]|[biud]?mat[2-4](?:x[2-4])?|sampler\w*)[*\s]+)([a-zA-Z_]\w*)\s*\(/
    // WGSL: fn name(
    const wgslPat = /^(?:\s*@[a-z_]+(?:\([^)]*\))?\s*)*fn\s+([a-zA-Z_]\w*)\s*\(/
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*\/\//.test(line) || /^\s*#/.test(line)) continue
      if (SKIP.test(line)) continue
      // WGSL
      let m = line.match(wgslPat)
      if (m) { results.push({ name: m[1] + "()", line: i + 1 }); continue }
      // GLSL/HLSL — только если нет больших отступов (функции на top-level)
      if (/^\s{4,}/.test(line)) continue
      m = line.match(pat)
      if (m) results.push({ name: m[2] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '')
    const p = new RegExp(`\\b${esc(clean)}\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
