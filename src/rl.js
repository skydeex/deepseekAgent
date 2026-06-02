import readline from "readline"

export const rl = readline.createInterface({ input: process.stdin, output: process.stdout, historySize: 200 })

export function ask(prompt) {
  if (rl.closed) return Promise.resolve("")
  return new Promise(resolve => rl.question(prompt, resolve))
}

// Ввод с автодополнением /команд по стрелке вниз / Tab.
// commands: массив [cmd, desc] из SLASH_COMMANDS
export function askWithComplete(prompt, commands) {
  if (rl.closed) return Promise.resolve("")
  // Git Bash на Windows не выставляет isTTY, но setRawMode есть — проверяем по нему
  if (typeof process.stdin.setRawMode !== 'function') {
    return new Promise(resolve => rl.question(prompt, resolve))
  }

  return new Promise((resolve) => {
    let buffer = ''
    let cursorPos = 0         // позиция курсора внутри buffer
    let historyIdx = -1
    let suggestionsShown = 0  // сколько строк подсказок сейчас на экране
    let selectedIdx = -1      // выбранная подсказка (-1 = нет)
    let pasting = false       // bracketed paste mode: идёт вставка
    let lineCount = 1         // сколько строк терминала занимает текущий ввод
    let prevCursorRow = 0     // строка курсора после последнего redraw

    // Видимая длина промпта (без ANSI-кодов)
    const promptLen = prompt.replace(/\x1b\[[0-9;]*m/g, '').length

    readline.emitKeypressEvents(process.stdin)
    try { rl.pause() } catch { resolve(""); return }
    const origWriteToOutput = rl._writeToOutput
    rl._writeToOutput = () => {}

    try {
      process.stdin.setRawMode(true)
    } catch {
      // Терминал не поддерживает raw mode — откат к обычному вводу
      rl._writeToOutput = origWriteToOutput
      rl.resume()
      rl.question(prompt, resolve)
      return
    }

    process.stdin.resume()
    // Включить bracketed paste mode: терминал оборачивает вставку в \x1b[200~ ... \x1b[201~
    process.stdout.write('\x1b[?2004h')
    process.stdout.write(prompt)

    // Команды, начинающиеся с текущего буфера
    function match() {
      if (!buffer.startsWith('/')) return []
      const q = buffer.toLowerCase()
      return commands.filter(([cmd]) => cmd.split(' ')[0].toLowerCase().startsWith(q)).slice(0, 7)
    }

    // Перерисовать строку ввода и поставить курсор на cursorPos
    function redraw() {
      const cols = process.stdout.columns || 80

      // Переместиться на первую строку области ввода
      if (prevCursorRow > 0) readline.moveCursor(process.stdout, 0, -prevCursorRow)
      readline.cursorTo(process.stdout, 0)

      // Стереть все строки, занятые предыдущим вводом
      for (let i = 0; i < lineCount; i++) {
        readline.clearLine(process.stdout, 0)
        if (i < lineCount - 1) readline.moveCursor(process.stdout, 0, 1)
      }
      if (lineCount > 1) readline.moveCursor(process.stdout, 0, -(lineCount - 1))
      readline.cursorTo(process.stdout, 0)

      // Записать актуальный prompt + buffer
      process.stdout.write(prompt + buffer)

      // Обновить lineCount
      const totalLen = promptLen + buffer.length
      lineCount = Math.max(1, Math.ceil(totalLen / cols))

      // Поставить курсор на cursorPos (с учётом переноса строк)
      const cursorAbsPos = promptLen + cursorPos
      const endRow    = Math.floor(totalLen / cols)
      const cursorRow = Math.floor(cursorAbsPos / cols)
      const cursorCol = cursorAbsPos % cols
      if (endRow > cursorRow) readline.moveCursor(process.stdout, 0, -(endRow - cursorRow))
      readline.cursorTo(process.stdout, cursorCol)

      prevCursorRow = cursorRow
    }

    // Убрать строки подсказок, вернуть курсор на cursorPos
    function clearSugs() {
      if (suggestionsShown === 0) return
      for (let i = 0; i < suggestionsShown; i++) {
        readline.moveCursor(process.stdout, 0, 1)
        readline.clearLine(process.stdout, 0)
      }
      readline.moveCursor(process.stdout, 0, -suggestionsShown)
      readline.cursorTo(process.stdout, promptLen + cursorPos)
      suggestionsShown = 0
    }

    // Нарисовать/обновить подсказки под строкой ввода
    function drawSugs(sugs) {
      // Стереть старые
      if (suggestionsShown > 0) {
        for (let i = 0; i < suggestionsShown; i++) {
          readline.moveCursor(process.stdout, 0, 1)
          readline.clearLine(process.stdout, 0)
        }
        readline.moveCursor(process.stdout, 0, -suggestionsShown)
        suggestionsShown = 0
      }
      // Вернуть курсор на cursorPos (не на конец буфера)
      readline.cursorTo(process.stdout, promptLen + cursorPos)
      if (sugs.length === 0) return
      for (let i = 0; i < sugs.length; i++) {
        const [cmd, desc] = sugs[i]
        const name = cmd.split(' ')[0]
        const text = `  ${name.padEnd(22)}${desc}`
        // \n создаёт строку даже если её нет (в отличие от \x1b[1B)
        process.stdout.write('\n')
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        process.stdout.write(i === selectedIdx ? `\x1b[7m${text}\x1b[0m` : `\x1b[2m${text}\x1b[0m`)
      }
      readline.moveCursor(process.stdout, 0, -sugs.length)
      readline.cursorTo(process.stdout, promptLen + cursorPos)
      suggestionsShown = sugs.length
    }

    function finish(result) {
      clearSugs()
      process.stdout.write('\x1b[?2004l')  // выключить bracketed paste mode
      // Переместить курсор на конец ввода перед переводом строки
      const cols = process.stdout.columns || 80
      const totalLen = promptLen + buffer.length
      const endRow = Math.floor(totalLen / cols)
      const endCol = totalLen % cols
      if (endRow > prevCursorRow) readline.moveCursor(process.stdout, 0, endRow - prevCursorRow)
      readline.cursorTo(process.stdout, endCol)
      process.stdout.write('\n')
      process.stdin.setRawMode(false)
      process.stdin.removeListener('keypress', onKeypress)
      rl._writeToOutput = origWriteToOutput
      if (!rl.closed) rl.resume()
      resolve(result)
    }

    function onKeypress(str, key) {
      if (!key) return

      // Bracketed paste: начало вставки
      if (key.sequence === '\x1b[200~') { pasting = true; return }
      // Bracketed paste: конец вставки
      if (key.sequence === '\x1b[201~') { pasting = false; redraw(); return }

      // Во время вставки Enter добавляем как \n в буфер, а не отправляем
      if (pasting && (key.name === 'return' || key.name === 'enter')) {
        buffer += '\n'
        return
      }

      // Ctrl+C
      if (key.sequence === '\x03') {
        clearSugs()
        process.stdout.write('\x1b[?2004l')  // выключить bracketed paste mode
        process.stdout.write('^C\n')
        process.stdin.setRawMode(false)
        process.stdin.removeListener('keypress', onKeypress)
        rl._writeToOutput = origWriteToOutput
        if (!rl.closed) rl.resume()
        resolve('\x03')
        return
      }

      // Enter — если выбрана подсказка, применить её
      if (key.name === 'return' || key.name === 'enter') {
        if (selectedIdx >= 0 && suggestionsShown > 0) {
          const sugs = match()
          if (sugs[selectedIdx]) {
            buffer = sugs[selectedIdx][0].split(' ')[0]
            cursorPos = buffer.length
            redraw()
          }
        }
        finish(buffer)
        return
      }

      // Escape — закрыть подсказки
      if (key.name === 'escape') {
        selectedIdx = -1
        clearSugs()
        return
      }

      // Tab — автодополнение первой/выбранной подсказки
      if (key.name === 'tab') {
        const sugs = match()
        if (sugs.length > 0) {
          buffer = sugs[selectedIdx >= 0 ? selectedIdx : 0][0].split(' ')[0]
          cursorPos = buffer.length
          selectedIdx = -1
          redraw()
          drawSugs(match())
        }
        return
      }

      // Стрелка влево
      if (key.name === 'left') {
        if (cursorPos > 0) {
          cursorPos--
          readline.cursorTo(process.stdout, promptLen + cursorPos)
        }
        return
      }

      // Стрелка вправо
      if (key.name === 'right') {
        if (cursorPos < buffer.length) {
          cursorPos++
          readline.cursorTo(process.stdout, promptLen + cursorPos)
        }
        return
      }

      // Home / Ctrl+A
      if (key.name === 'home' || (key.ctrl && key.name === 'a')) {
        cursorPos = 0
        readline.cursorTo(process.stdout, promptLen)
        return
      }

      // End / Ctrl+E
      if (key.name === 'end' || (key.ctrl && key.name === 'e')) {
        cursorPos = buffer.length
        readline.cursorTo(process.stdout, promptLen + cursorPos)
        return
      }

      // Стрелка вверх
      if (key.name === 'up') {
        const sugs = match()
        if (sugs.length > 0 && suggestionsShown > 0) {
          // Навигация по подсказкам
          selectedIdx = selectedIdx <= 0 ? sugs.length - 1 : selectedIdx - 1
          drawSugs(sugs)
        } else {
          // Навигация по истории
          historyIdx = Math.min(historyIdx + 1, rl.history.length - 1)
          if (historyIdx >= 0 && rl.history[historyIdx] !== undefined) {
            buffer = rl.history[historyIdx]
            cursorPos = buffer.length
            clearSugs()
            redraw()
          }
        }
        return
      }

      // Стрелка вниз
      if (key.name === 'down') {
        const sugs = match()
        if (sugs.length > 0 && suggestionsShown > 0) {
          // Навигация по подсказкам
          selectedIdx = selectedIdx >= sugs.length - 1 ? 0 : selectedIdx + 1
          drawSugs(sugs)
        } else {
          // Навигация по истории
          if (historyIdx > 0) {
            historyIdx--
            buffer = rl.history[historyIdx] ?? ''
          } else {
            historyIdx = -1
            buffer = ''
          }
          cursorPos = buffer.length
          clearSugs()
          redraw()
        }
        return
      }

      // Backspace — удалить символ слева от курсора
      if (key.name === 'backspace') {
        if (cursorPos > 0) {
          buffer = buffer.slice(0, cursorPos - 1) + buffer.slice(cursorPos)
          cursorPos--
          selectedIdx = -1
          redraw()
          drawSugs(match())
        }
        return
      }

      // Delete — удалить символ справа от курсора
      if (key.name === 'delete') {
        if (cursorPos < buffer.length) {
          buffer = buffer.slice(0, cursorPos) + buffer.slice(cursorPos + 1)
          selectedIdx = -1
          redraw()
          drawSugs(match())
        }
        return
      }

      // Игнорировать управляющие комбинации (кроме уже обработанных Ctrl+A/E)
      if (key.ctrl || key.meta) return

      // Обычный символ — вставить в позицию курсора
      if (str && str.length === 1 && str.charCodeAt(0) >= 32) {
        buffer = buffer.slice(0, cursorPos) + str + buffer.slice(cursorPos)
        cursorPos++
        selectedIdx = -1
        redraw()
        drawSugs(match())
      }
    }

    process.stdin.on('keypress', onKeypress)
  })
}

// Читает один keypress без Enter. Возвращает:
//   ''     — Enter/Return
//   '\x1b' — Escape
//   '\x03' — Ctrl+C
//   str    — любой другой символ
export function askKey(prompt) {
  return new Promise((resolve) => {
    if (typeof process.stdin.setRawMode !== 'function') {
      process.stdout.write(prompt + '\n')
      resolve('')
      return
    }

    process.stdout.write(prompt)
    readline.emitKeypressEvents(process.stdin)
    try { rl.pause() } catch { resolve(""); return }
    // Suppress readline's own echo during raw mode to avoid duplicate output
    const origWriteToOutput = rl._writeToOutput
    rl._writeToOutput = () => {}
    process.stdin.setRawMode(true)
    process.stdin.resume()

    function onKeypress(str, key) {
      process.stdin.setRawMode(false)
      process.stdin.removeListener('keypress', onKeypress)
      rl._writeToOutput = origWriteToOutput
      if (!rl.closed) rl.resume()

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

      if (key.name === 'escape' || key.sequence === '\x1b' || key.meta) {
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
