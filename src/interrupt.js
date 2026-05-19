let _controller = null

export function arm() {
  _controller = new AbortController()
  return _controller.signal
}

export function disarm() {
  _controller = null
}

export function interrupt() {
  _controller?.abort()
}

export function isArmed() {
  return _controller !== null
}
