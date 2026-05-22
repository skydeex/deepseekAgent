import fg from "fast-glob"
import { getIgnorePatterns } from "../ignore.js"

export const globTool = {
  name: "glob",
  description: "Find files matching a glob pattern (e.g. src/**/*.js).",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern" },
      cwd: { type: "string", description: "Base directory (optional)" }
    },
    required: ["pattern"]
  },
  isReadOnly: true,
  async execute({ pattern, cwd }) {
    const files = await fg(pattern, { cwd, dot: true, ignore: getIgnorePatterns() })
    return files.join("\n")
  }
}
