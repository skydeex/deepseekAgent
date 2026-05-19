// Парсер Bash/Shell (.sh, .bash, .zsh)
// Поддерживает: function foo {, foo() {, foo () {

import { esc } from "./utils.js"

const SHELL_KW = new Set(["if","then","else","elif","fi","for","while","do","done","case","esac","in"])

export default {
  extensions: [".sh", ".bash", ".zsh"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*#/.test(line)) continue  // комментарий

      // function foo() { или function foo {
      let m = line.match(/^\s*function\s+([a-zA-Z_]\w*)\s*(?:\(\s*\))?\s*[\{(]/)
      if (m) { results.push({ name: m[1] + "()", line: i + 1 }); continue }

      // foo() { — без слова function
      m = line.match(/^\s*([a-zA-Z_]\w*)\s*\(\s*\)\s*[\{(]/)
      if (m && !SHELL_KW.has(m[1])) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const patterns = [
      new RegExp(`^\\s*function\\s+${esc(methodName)}\\s*(?:\\(\\s*\\))?\\s*[\\{(]`),
      new RegExp(`^\\s*${esc(methodName)}\\s*\\(\\s*\\)\\s*[\\{(]`)
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      for (const p of patterns) {
        if (p.test(lines[i])) return i + 1
      }
    }
    return null
  }
}
