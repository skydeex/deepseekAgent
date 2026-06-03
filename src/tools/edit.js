import fs from "fs/promises"
import { renderEditDiff } from "../diff.js"
import { trackEdit } from "../line_tracker.js"

// Detect encoding from BOM and decode buffer to string.
// Returns { text, bom, encoding } where bom is a Buffer (possibly empty)
// and encoding is "utf-8" | "utf-8-bom" | "utf16le" | "utf16be".
// Returns null if the file is not valid UTF-8 (non-UTF-8 bytes detected).
function decodeBuffer(buf) {
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return { text: buf.slice(3).toString("utf-8"), bom: buf.slice(0, 3), encoding: "utf-8-bom" }
  }
  if (buf[0] === 0xFF && buf[1] === 0xFE) {
    return { text: buf.slice(2).toString("utf16le"), bom: buf.slice(0, 2), encoding: "utf16le" }
  }
  if (buf[0] === 0xFE && buf[1] === 0xFF) {
    const swapped = Buffer.from(buf.slice(2))
    swapped.swap16()
    return { text: swapped.toString("utf16le"), bom: buf.slice(0, 2), encoding: "utf16be" }
  }
  const text = buf.toString("utf-8")
  if (text.includes("\uFFFD")) return null
  return { text, bom: Buffer.alloc(0), encoding: "utf-8" }
}

// Encode text back to buffer with original BOM/encoding.
function encodeText(text, bom, encoding) {
  if (encoding === "utf-8" || encoding === "utf-8-bom") {
    return Buffer.concat([bom, Buffer.from(text, "utf-8")])
  }
  if (encoding === "utf16le") {
    return Buffer.concat([bom, Buffer.from(text, "utf16le")])
  }
  if (encoding === "utf16be") {
    const content = Buffer.from(text, "utf16le")
    content.swap16()
    return Buffer.concat([bom, content])
  }
  return Buffer.from(text, "utf-8")
}

export const editTool = {
  name: "edit_file",
  description: "Replace an exact string in a file with new content. The old_string must match exactly (including whitespace).",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file" },
      old_string: { type: "string", description: "Exact string to find and replace" },
      new_string: { type: "string", description: "String to replace it with" }
    },
    required: ["path", "old_string", "new_string"]
  },
  isReadOnly: false,
  async execute({ path: filePath, old_string, new_string }) {
    const buf = await fs.readFile(filePath)
    const decoded = decodeBuffer(buf)

    if (!decoded) {
      return `Error: "${filePath}" uses a non-UTF-8 encoding (e.g. Windows-1251). Editing it would corrupt the file. Convert it to UTF-8 first (e.g. with iconv or your editor), then retry.`
    }

    const { bom, encoding } = decoded
    let original = decoded.text

    const writeBack = async (text, origForDiff, searchForDiff, replaceForDiff) => {
      process.stdout.write(renderEditDiff(origForDiff, filePath, searchForDiff, replaceForDiff))
      await fs.writeFile(filePath, encodeText(text, bom, encoding))
      trackEdit(filePath, origForDiff, searchForDiff, replaceForDiff)
    }

    // Direct match
    if (original.includes(old_string)) {
      const count = original.split(old_string).length - 1
      if (count > 1) {
        return `Error: old_string found ${count} times — make it more specific to ensure unique match`
      }
      const updated = original.replace(old_string, new_string)
      await writeBack(updated, original, old_string, new_string)
      return `Edited ${filePath}`
    }

    // Fallback: try with CRLF normalization (Windows files)
    const normalOrig = original.replace(/\r\n/g, "\n")
    const normalSearch = old_string.replace(/\r\n/g, "\n")
    if (normalOrig.includes(normalSearch)) {
      const count = normalOrig.split(normalSearch).length - 1
      if (count > 1) {
        return `Error: old_string found ${count} times (after CRLF normalization) — make it more specific`
      }
      const normalNew = new_string.replace(/\r\n/g, "\n")
      const updated = normalOrig.replace(normalSearch, normalNew)
      await writeBack(updated, normalOrig, normalSearch, normalNew)
      return `Edited ${filePath} (CRLF→LF normalized)`
    }

    return `Error: old_string not found in ${filePath}. Check that the text matches exactly (including indentation). Do NOT fall back to bash — report this error to the user.`
  }
}
