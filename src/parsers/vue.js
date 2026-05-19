// Парсер Vue (.vue)
// Извлекает содержимое <script>...</script>, затем парсит как JS
// Поддерживает: Composition API (function/arrow), Options API (method shorthand)

import { strip, esc } from "./utils.js"

const JS_KW = "if|for|while|switch|catch|else|return|typeof|instanceof|new|delete|void|throw"
const EP = "(?:export\\s+(?:default\\s+)?)?"

const PATTERNS = [
  new RegExp(`^\\s*${EP}(?:async\\s+)?function\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\(`),
  new RegExp(`^\\s*${EP}(?:const|let|var)\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=\\s*(?:async\\s+)?function\\s*\\(`),
  new RegExp(`^\\s*${EP}(?:const|let|var)\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=\\s*(?:async\\s+)?\\([^)]*\\)\\s*=>`),
  new RegExp(`^\\s*(?:async\\s+)?(?!(?:${JS_KW}|export|const|let|var|import|from)\\b)([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\([^)]*\\)\\s*\\{`),
]

function scriptLines(lines) {
  const result = []
  let inScript = false
  for (let i = 0; i < lines.length; i++) {
    if (!inScript && /^<script[\s>]/.test(lines[i])) { inScript = true; continue }
    if (inScript && /^<\/script>/.test(lines[i])) { inScript = false; continue }
    if (inScript) result.push({ idx: i, content: lines[i] })
  }
  return result
}

export default {
  extensions: [".vue"],

  outline(lines) {
    const results = []
    const seen = new Set()
    for (const { idx, content } of scriptLines(lines)) {
      const clean = strip(content)
      for (const p of PATTERNS) {
        const m = clean.match(p)
        if (m) {
          const name = m[m.length - 1]
          if (!seen.has(name)) {
            seen.add(name)
            results.push({ name: name + "()", line: idx + 1 })
          }
          break
        }
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const e = esc(methodName)
    const patterns = [
      new RegExp(`${EP}(?:async\\s+)?function\\s+${e}\\s*\\(`),
      new RegExp(`(?:const|let|var)\\s+${e}\\s*=\\s*(?:async\\s+)?(?:function|\\()`),
      new RegExp(`(?!(?:${JS_KW})\\b)${e}\\s*\\([^)]*\\)\\s*\\{`),
    ]
    for (let i = 0; i < lines.length; i++) {
      const clean = strip(lines[i])
      for (const p of patterns) {
        if (p.test(clean) && lines[i].includes(methodName)) return i + 1
      }
    }
    return null
  }
}
