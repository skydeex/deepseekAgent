import { getConfig, saveConfig } from "./config.js"

// "none" | "high" | "max"
let _thinkingMode = "high"  // default: модели думают по умолчанию

export function setThinkingMode(mode) { _thinkingMode = mode }
export function getThinkingMode() { return _thinkingMode }
export function isThinkingEnabled() { return _thinkingMode !== "none" }

// Устаревший хелпер — оставлен для совместимости с --think флагом
export function enableThinking() { _thinkingMode = "high" }
export function disableThinking() { _thinkingMode = "none" }

export function getModel() {
  return getConfig().model
}

export function getThinkingParams() {
  return { thinking: _thinkingMode }
}
