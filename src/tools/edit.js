import fs from "fs/promises"
import { renderEditDiff } from "../diff.js"
import { trackEdit } from "../line_tracker.js"

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
    const original = await fs.readFile(filePath, "utf-8")

    // Direct match
    if (original.includes(old_string)) {
      const count = original.split(old_string).length - 1
      if (count > 1) {
        return `Error: old_string found ${count} times — make it more specific to ensure unique match`
      }
      const updated = original.replace(old_string, new_string)
      process.stdout.write(renderEditDiff(original, filePath, old_string, new_string))
      await fs.writeFile(filePath, updated, "utf-8")
      trackEdit(filePath, original, old_string, new_string)
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
      process.stdout.write(renderEditDiff(normalOrig, filePath, normalSearch, normalNew))
      await fs.writeFile(filePath, updated, "utf-8")
      trackEdit(filePath, normalOrig, normalSearch, normalNew)
      return `Edited ${filePath} (CRLF→LF normalized)`
    }

    return `Error: old_string not found in ${filePath}. Check that the text matches exactly (including indentation). Do NOT fall back to bash — report this error to the user.`
  }
}
