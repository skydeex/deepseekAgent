import fs from "fs/promises"
import path from "path"

const SESSIONS_FILE = path.join(process.cwd(), ".agent", "sessions.json")
const MAX_SESSIONS = 5

let _messages = []
let _checkpoints = []
let _turnCount = 0
let _sessionId = null  // уникальный ID текущей сессии, сбрасывается при /clear

export function getMessages() { return _messages }
export function setMessages(msgs) { _messages = msgs }
export function pushMessage(msg) { _messages.push(msg) }
export function clearMessages() { _messages = []; _turnCount = 0; _sessionId = null }
export function getTurnCount() { return _turnCount }
export function incrementTurn() { _turnCount++ }
export function setTurnCount(n) { _turnCount = n }

export async function saveSession() {
  if (_messages.length === 0) return
  if (!_sessionId) _sessionId = Date.now()

  const userMsgs = _messages.filter(m => m.role === "user")
  const firstMsg = typeof userMsgs[0]?.content === "string" ? userMsgs[0].content : ""
  const lastMsg  = typeof userMsgs.at(-1)?.content === "string" ? userMsgs.at(-1).content : ""

  const entry = {
    sessionId:    _sessionId,
    timestamp:    Date.now(),
    turnCount:    _turnCount,
    messageCount: _messages.length,
    firstMessage: firstMsg.slice(0, 300),
    lastMessage:  lastMsg.slice(0, 300),
    messages:     _messages
  }

  try {
    let sessions = []
    try { sessions = JSON.parse(await fs.readFile(SESSIONS_FILE, "utf-8")) } catch {}

    // Обновляем существующую запись той же сессии, иначе добавляем в начало
    const existingIdx = sessions.findIndex(s => s.sessionId === _sessionId)
    if (existingIdx >= 0) {
      sessions[existingIdx] = entry
    } else {
      sessions.unshift(entry)
    }

    sessions = sessions.slice(0, MAX_SESSIONS)

    await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true })
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), "utf-8")
  } catch {}
}

export async function loadSessions() {
  try {
    return JSON.parse(await fs.readFile(SESSIONS_FILE, "utf-8"))
  } catch {
    return []
  }
}

export function createCheckpoint() {
  const cp = {
    index: _checkpoints.length,
    turn: _turnCount,
    timestamp: Date.now(),
    messages: JSON.parse(JSON.stringify(_messages))
  }
  _checkpoints.push(cp)
  return cp.index
}

export function getCheckpoints() { return _checkpoints }

export function restoreCheckpoint(index) {
  const cp = _checkpoints[index]
  if (!cp) return false
  _messages = JSON.parse(JSON.stringify(cp.messages))
  _turnCount = cp.turn
  _checkpoints = _checkpoints.slice(0, index + 1)
  return true
}
