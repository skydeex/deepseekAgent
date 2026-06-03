import fs from "fs/promises"
import path from "path"
import { renderWriteDiff } from "../diff.js"
import { reset } from "../line_tracker.js"

export const writeTool = {
  name: "write_file",
  description: "Write content to a file, creating it if it doesn't exist.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file" },
      content: { type: "string", description: "Content to write" }
    },
    required: ["path", "content"]
  },
  isReadOnly: false,
  async execute({ path: filePath, content }) {
    let originalText = null
    let bom = Buffer.alloc(0)

    try {
      const buf = await fs.readFile(filePath)
      // Preserve BOM of existing file
      if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        bom = buf.slice(0, 3)
        originalText = buf.slice(3).toString("utf-8")
      } else {
        originalText = buf.toString("utf-8")
      }
    } catch {}

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.concat([bom, Buffer.from(content, "utf-8")]))

    reset(filePath)
    process.stdout.write(renderWriteDiff(originalText, content, filePath))
    return `Written to ${filePath}`
  }
}
