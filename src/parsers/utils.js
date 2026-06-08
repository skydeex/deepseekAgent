// Общие утилиты для парсеров

// Убрать строковые литералы и комментарии
// чтобы не считать {} и () внутри строк/комментариев
export function strip(line) {
  return line
    .replace(/`[^`]*`|"[^"]*"|'[^']*'/g, '""')  // строковые литералы
    .replace(/\/\*.*?\*\//g, '')                    // /* ... */ на одной строке
    .replace(/\/\*.*$/, '')                         // /* ... до конца строки (начало многострочного)
    .replace(/\/\/.*$/, "")                         // // до конца строки
}

// Баланс {} с учётом строк
export function bracketDepth(line) {
  const clean = strip(line)
  return (clean.match(/\{/g) || []).length - (clean.match(/\}/g) || []).length
}

// Баланс {} без учёта строк (для CSS/SCSS)
export function rawBracketDepth(line) {
  return (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
}

// Экранирование для RegExp
export function esc(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
