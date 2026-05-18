import readline from "readline"

export const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

export function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve))
}

// Читает один keypress без Enter. Возвращает:
//   ''     — Enter/Return
//   '\x1b' — Escape
//   '\x03' — Ctrl+C
//   str    — любой другой символ
export function askKey(prompt) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      process.stdout.write(prompt + '\n')
      resolve('')
      return
    }

    process.stdout.write(prompt)
    readline.emitKeypressEvents(process.stdin)
    rl.pause()
    process.stdin.setRawMode(true)
    process.stdin.resume()

    function onKeypress(str, key) {
      process.stdin.setRawMode(false)
      process.stdin.removeListener('keypress', onKeypress)
      rl.resume()

      if (!key) {
        process.stdout.write('\n')
        resolve(str ?? '')
        return
      }

      if (key.sequence === '\x03') {       // Ctrl+C
        process.stdout.write('^C\n')
        resolve('\x03')
        return
      }

      if (key.name === 'escape') {
        process.stdout.write('Esc\n')
        resolve('\x1b')
        return
      }

      if (key.name === 'return' || key.name === 'enter') {
        process.stdout.write('\n')
        resolve('')
        return
      }

      const ch = str ?? key.sequence ?? ''
      process.stdout.write(ch + '\n')
      resolve(ch.toLowerCase())
    }

    process.stdin.on('keypress', onKeypress)
  })
}
