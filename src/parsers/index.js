// Реестр парсеров
//
// Чтобы добавить новый язык:
// 1. Создать файл src/parsers/<язык>.js (скопировать php.js как шаблон)
// 2. Реализовать: extensions, outline(lines), findMethodStart(lines, name)
// 3. Добавить import + вызов register() ниже
//
// Интерфейс парсера:
// {
//   extensions: string[]         — расширения файлов, напр. [".py", ".pyw"]
//   outline(lines): {name, line}[]  — список функций/методов с номерами строк
//   findMethodStart(lines, name): number|null — номер строки начала метода
//   rawBrackets?: boolean        — true = не убирать строки при подсчёте {} (для CSS)
// }

import phpParser    from "./php.js"
import jsParser     from "./js.js"
import goParser     from "./go.js"
import cssParser    from "./css.js"
import astroParser  from "./astro.js"
import pythonParser from "./python.js"
import rubyParser   from "./ruby.js"
import rustParser   from "./rust.js"
import javaParser   from "./java.js"
import csharpParser from "./csharp.js"
import swiftParser  from "./swift.js"
import kotlinParser from "./kotlin.js"
import bashParser   from "./bash.js"
import cppParser    from "./cpp.js"

const parsers = new Map()

function register(parser) {
  for (const ext of parser.extensions) {
    parsers.set(ext, parser)
  }
}

// ─── Регистрация парсеров ───
register(phpParser)
register(jsParser)
register(goParser)
register(cssParser)
register(astroParser)
register(pythonParser)
register(rubyParser)
register(rustParser)
register(javaParser)
register(csharpParser)
register(swiftParser)
register(kotlinParser)
register(bashParser)
register(cppParser)
// register(yourParser)  ← добавить новый язык здесь

export function getParser(ext) {
  return parsers.get(ext.toLowerCase()) || null
}

export function getSupportedExtensions() {
  return [...parsers.keys()]
}
