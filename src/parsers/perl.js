// Парсер Perl (.pl, .pm, .t)
// Поддерживает: sub name, sub name($args), my $name = sub

import { esc } from "./utils.js"

export default {
  extensions: [".pl", ".pm", ".t"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*#/.test(line)) continue

      // sub name  /  sub name($args)  /  sub name :attrs
      let m = line.match(/^\s*sub\s+([a-zA-Z_]\w*)\s*[\{(:]/)
      if (m) { results.push({ name: m[1] + "()", line: i + 1 }); continue }

      // my $name = sub  /  our $name = sub
      m = line.match(/^\s*(?:my|our|local)\s+\$([a-zA-Z_]\w*)\s*=\s*sub\s*[\{(]/)
      if (m) { results.push({ name: "$" + m[1] + "()", line: i + 1 }); continue }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.startsWith("$") ? "\\" + methodName : methodName
    const patterns = [
      new RegExp(`sub\\s+${esc(name)}\\s*[\\{(:]`),
      new RegExp(`\\$${esc(name.replace(/^\$/, ""))}\\s*=\\s*sub\\s*[\\{(]`)
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      for (const p of patterns) {
        if (p.test(lines[i]) && lines[i].includes(methodName.replace(/^\$/, ""))) return i + 1
      }
    }
    return null
  }
}
