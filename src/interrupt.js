let _controller = null

// Вызывается в начале agentLoop — создаёт AbortController и возвращает signal
export function arm() {
  _controller = new AbortController()
  return _controller.signal
}

// Вызывается в finally agentLoop — сбрасывает контроллер
export function disarm() {
  _controller = null
}

// Прерывает текущий agent loop (Ctrl+C во время промпта или SIGINT)
export function interrupt() {
  _controller?.abort()
}

// true пока agentLoop активен (используется в SIGINT-обработчике index.js)
export function isArmed() {
  return _controller !== null
}
