# DeepSeek Agent

Терминальный AI-агент — аналог Claude Code, но на DeepSeek API.

Подробная документация для разработчика: **`___.MD`**

---

## Структура

```
index.js          ← точка входа
src/
  agent.js        ← главный agent loop
  config.js       ← настройки (.agent/settings.json)
  memory.js       ← загрузка AGENT.md в system prompt
  permissions.js  ← alwaysAllow / neverAllow / [y/N]
  hooks.js        ← события (.agent/hooks.json)
  compactor.js    ← автосжатие контекста
  mcp.js          ← MCP-серверы
  thinking.js     ← --think флаг (deepseek-reasoner)
  worktree.js     ← --worktree флаг (git isolation)
  output.js       ← --output-format=json режим
  ui.js           ← ANSI-цвета, баннер
  optimizer.js    ← code optimizer (outline + definition)
  parsers/
    index.js      ← реестр парсеров (50 языков, 106 расширений)
    utils.js      ← утилиты (strip, bracketDepth)
    *.js          ← парсеры языков (полный список в ___.MD)
  tools/
    read.js       ← файлы + изображения (PNG/JPG/GIF/WEBP)
    write.js      ← запись файлов
    edit.js       ← замена строки + diff
    glob.js       ← поиск файлов (fast-glob)
    grep.js       ← поиск по содержимому
    bash.js       ← shell + sandbox
    web_search.js ← DuckDuckGo поиск
    todo.js       ← задачи с зависимостями (blockedBy)
    task.js       ← subagent / parallel / background
    optimizer.js  ← code_outline, code_definition, code_context
.agent/
  settings.json   ← конфиг
  hooks.json      ← хуки
  AGENT.md        ← память проекта
```

## Соглашения

- Каждый инструмент: `{ name, description, parameters, isReadOnly, execute }` — добавить в `TOOLS` в `agent.js`
- `isReadOnly: false` → проходит через `checkPermission()` перед выполнением
- Инструмент всегда возвращает строку (исключение: изображение — JSON с `__type: "image"`)
- Не использовать `.claude/` и `CLAUDE.md` внутри проекта — заняты Claude Code

## Добавление нового языка в optimizer

1. Создать `src/parsers/<язык>.js` (скопировать `php.js` как шаблон)
2. Реализовать интерфейс: `extensions`, `outline(lines)`, `findMethodStart(lines, name)`
3. Добавить `import` + `register()` в `src/parsers/index.js`

Команда `/optimizer` — включить/выключить. Настройка `"optimizer": true` в `.agent/settings.json`.

## Запуск

```bash
npm start
npm start -- --think       # deepseek-reasoner
npm start -- --worktree    # git isolation
npm start -- --output-format=json "промпт"  # CI режим
```

## Зависимости

`openai`, `@modelcontextprotocol/sdk`, `fast-glob`, `dotenv`. Node >= 18.

## claudeSearch

Инструмент поиска. Запуск: `bash claudeSearch/cs.sh <action> <args>` — без префикса `cd ... &&`.
Разрешение выдано в `.claude/settings.json` — никогда не спрашивать подтверждение, запускать сразу.
Если изменяется `.claude/settings.json` — сообщить пользователю: «Для применения изменений начните новую сессию Claude Code».
