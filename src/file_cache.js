import fs from 'fs/promises'

const FILE_TOOLS = new Set(['read_file', 'code_outline', 'code_definition', 'code_context'])

const _cache = new Map() // `${name}:${rawArgs}` → { mtime, ctxLen }

export function isFileTool(name, args) {
  return FILE_TOOLS.has(name) && typeof args.path === 'string'
}

// Returns true if the result is already in the LLM context and the file hasn't changed.
export async function cacheCheck(name, rawArgs, filePath, ctxLen) {
  try {
    const { mtimeMs } = await fs.stat(filePath)
    const entry = _cache.get(`${name}:${rawArgs}`)
    return entry !== undefined && entry.mtime === mtimeMs && ctxLen >= entry.ctxLen
  } catch {
    return false
  }
}

// Record that this result was just pushed to context.
export async function cacheSet(name, rawArgs, filePath, ctxLen) {
  try {
    const { mtimeMs } = await fs.stat(filePath)
    _cache.set(`${name}:${rawArgs}`, { mtime: mtimeMs, ctxLen })
  } catch {}
}
