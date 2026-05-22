import fs from "fs/promises"
import path from "path"
import fg from "fast-glob"
import { BINARY_EXTS } from "../binary.js"
import { getIgnorePatterns } from "../ignore.js"

export const grepTool = {
  name: "grep",
  description: "Search for a pattern (string or regex) in files. Returns matching lines with file paths and line numbers.",
  parameters: {
    type: "object",
    properties: {
      pattern:    { type: "string",  description: "Search pattern (string or regex)" },
      dir:        { type: "string",  description: "Directory to search in (default: current dir)" },
      glob:       { type: "string",  description: "File glob filter, e.g. '**/*.js' (default: all files)" },
      ignoreCase: { type: "boolean", description: "Case-insensitive search (default: false)" },
      context:    { type: "integer", description: "Lines of context before and after each match (like grep -C)" },
      outputMode: { type: "string",  enum: ["content", "files"], description: "content (default): matching lines; files: only file paths" }
    },
    required: ["pattern"]
  },
  isReadOnly: true,
  async execute({ pattern, dir = ".", glob: globPattern = "**/*", ignoreCase = false, context = 0, outputMode = "content" }) {
    const files = await fg(globPattern, {
      cwd: dir,
      dot: true,
      ignore: getIgnorePatterns()
    })

    const regex = new RegExp(pattern, ignoreCase ? "i" : "")
    const LIMIT = 200

    if (outputMode === "files") {
      const matched = []
      for (const file of files) {
        if (BINARY_EXTS.has(path.extname(file).toLowerCase())) continue
        const filePath = path.join(dir, file)
        let content
        try { content = await fs.readFile(filePath, "utf-8") } catch { continue }
        if (regex.test(content)) matched.push(file)
        if (matched.length >= LIMIT) { matched.push(`[... more files omitted]`); break }
      }
      return matched.length === 0 ? "No matches found." : matched.join("\n")
    }

    // content mode
    const results = []
    for (const file of files) {
      if (BINARY_EXTS.has(path.extname(file).toLowerCase())) continue
      const filePath = path.join(dir, file)
      let content
      try { content = await fs.readFile(filePath, "utf-8") } catch { continue }

      const lines = content.split("\n")
      const matchLines = new Set()
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) matchLines.add(i)
      }
      if (matchLines.size === 0) continue

      // Expand with context, merge overlapping ranges into blocks
      const blocks = []
      let block = null
      for (const idx of [...matchLines].sort((a, b) => a - b)) {
        const from = Math.max(0, idx - context)
        const to   = Math.min(lines.length - 1, idx + context)
        if (!block) { block = { from, to }; continue }
        if (from <= block.to + 1) { block.to = Math.max(block.to, to) }
        else { blocks.push(block); block = { from, to } }
      }
      if (block) blocks.push(block)

      const fileLines = []
      for (let b = 0; b < blocks.length; b++) {
        if (b > 0) fileLines.push("--")
        const { from, to } = blocks[b]
        for (let i = from; i <= to; i++) {
          const marker = matchLines.has(i) ? ":" : "-"
          fileLines.push(`${file}:${i + 1}${marker} ${lines[i]}`)
        }
      }
      results.push(...fileLines)
      if (results.length >= LIMIT) { results.push(`[... more matches omitted]`); break }
    }

    return results.length === 0 ? "No matches found." : results.join("\n")
  }
}
