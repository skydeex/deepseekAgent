import { getConfig } from "./config.js"
import { c } from "./ui.js"

let _thinkingEnabled = false

export function enableThinking() { _thinkingEnabled = true }
export function disableThinking() { _thinkingEnabled = false }
export function isThinkingEnabled() { return _thinkingEnabled }

export function getModel() {
  return getConfig().model
}

export function getThinkingParams() {
  if (!_thinkingEnabled) return {}
  return { thinking: { type: "enabled" } }
}

// DeepSeek возвращает reasoning_content отдельно от content
// Эта функция печатает его в dim-стиле
export function printReasoning(chunk) {
  const delta = chunk.choices[0]?.delta
  if (delta?.reasoning_content) {
    process.stdout.write(c.dim(delta.reasoning_content))
    return true
  }
  return false
}
