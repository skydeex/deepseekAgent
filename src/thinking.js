import { getConfig } from "./config.js"

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

