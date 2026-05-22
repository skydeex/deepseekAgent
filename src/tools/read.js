import fs from "fs/promises"
import path from "path"
import { BINARY_EXTS } from "../binary.js"

export const readTool = {
  name: "read_file",
  description: "Read the contents of a text file. For large files use offset+limit to read specific line ranges instead of the whole file.",
  parameters: {
    type: "object",
    properties: {
      path:   { type: "string",  description: "Absolute or relative path to the file" },
      offset: { type: "integer", description: "First line to read (1-based). Omit to start from the beginning." },
      limit:  { type: "integer", description: "Number of lines to read. Omit to read until end of file." }
    },
    required: ["path"]
  },
  isReadOnly: true,
  async execute({ path: filePath, offset, limit }) {
    const ext = path.extname(filePath).toLowerCase()

    if (BINARY_EXTS.has(ext)) {
      return `Error: "${filePath}" is a binary file (${ext}). Use bash to inspect it if needed.`
    }

    const buf = await fs.readFile(filePath)

    // Определяем кодировку по BOM
    let text
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      text = buf.slice(3).toString("utf-8")
    } else if (buf[0] === 0xFF && buf[1] === 0xFE) {
      text = buf.slice(2).toString("utf16le")
    } else if (buf[0] === 0xFE && buf[1] === 0xFF) {
      text = buf.slice(2).swap16().toString("utf16le")
    } else {
      text = buf.toString("utf-8")
      if (text.includes("\uFFFD")) {
        return `Warning: "${filePath}" contains non-UTF-8 bytes, some characters may be garbled.\n\n${text}`
      }
    }

    if (offset == null && limit == null) return text

    const lines = text.split("\n")
    const total = lines.length
    const start = Math.max(0, (offset ?? 1) - 1)
    const end   = limit != null ? Math.min(start + limit, total) : total
    const slice = lines.slice(start, end)

    const header = `[Lines ${start + 1}–${end} of ${total}]\n`
    return header + slice.join("\n")
  }
}
