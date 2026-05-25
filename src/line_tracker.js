// Отслеживает сдвиги номеров строк после edit_file.
//
// Проблема: агент делает code_outline → видит "foo at line 342" → делает
// edit_file (вставляет 5 строк выше) → вызывает code_context(342) → промах.
//
// Решение: после каждого edit_file записываем {cutoff, delta}.
// adjust(file, line) прогоняет все записанные правки и возвращает
// актуальный номер строки без повторного чтения файла.
//
// Сброс (reset) происходит при:
//   - write_file (файл перезаписан целиком)
//   - code_outline (LLM получил свежие номера — старые записи больше не нужны)

const _edits = new Map() // filePath → [{cutoff, delta}]

const countNL = s => (s.match(/\n/g) ?? []).length

/**
 * Вызывается из edit_file после успешной замены.
 * @param {string} filePath
 * @param {string} contentBefore  - содержимое файла ДО правки (или нормализованное)
 * @param {string} oldString      - заменяемый текст
 * @param {string} newString      - новый текст
 */
export function trackEdit(filePath, contentBefore, oldString, newString) {
  const delta = countNL(newString) - countNL(oldString)
  if (delta === 0) return

  const editLine = countNL(contentBefore.slice(0, contentBefore.indexOf(oldString))) + 1
  const cutoff   = editLine + countNL(oldString)

  if (!_edits.has(filePath)) _edits.set(filePath, [])
  _edits.get(filePath).push({ cutoff, delta })
}

/**
 * Возвращает актуальный номер строки с учётом всех правок после последнего reset.
 */
export function adjust(filePath, line) {
  let result = line
  for (const { cutoff, delta } of _edits.get(filePath) ?? []) {
    if (result >= cutoff) result += delta
  }
  return result
}

/**
 * Сбрасывает историю правок для файла.
 * Вызывать при write_file и после code_outline.
 */
export function reset(filePath) {
  _edits.delete(filePath)
}
