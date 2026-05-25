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
    let original = null
    try { original = await fs.readFile(filePath, "utf-8") } catch {}

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, "utf-8")

    reset(filePath)
    process.stdout.write(renderWriteDiff(original, content, filePath))
    return `Written to ${filePath}`
  }
}
