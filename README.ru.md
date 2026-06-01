# DeepSeek Agent

Терминальный AI-агент на базе [DeepSeek API](https://platform.deepseek.com/) — аналог Claude Code, но с открытым исходным кодом и минимальными зависимостями.

Агент читает файлы, пишет и редактирует код, выполняет команды, ищет по файлам, делает веб-поиск и умеет запускать параллельные подзадачи — всё из терминала.

## Быстрый старт

```bash
git clone https://github.com/skydeex/deepseekAgent.git
cd deepseekAgent
npm install
npm install -g .          # зарегистрировать команду agent глобально
copy .env.example .env   # Windows
# cp .env.example .env  # Linux / macOS
# вставить DEEPSEEK_API_KEY в .env
agent
```

Получить API-ключ: [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)

## Обновление

```bash
agent update
```

## Code Optimizer (встроенный)

В агент встроен оптимизатор кода (порт [claudeSearch](https://github.com/skydeex/claudeSearch)). Вместо чтения файлов целиком извлекает только нужные части — список функций, тело конкретного метода, контекст вокруг строки. Экономия — 60–70% токенов по сравнению с полным чтением файлов.

Чтение файлов дедуплицируется: если модель повторно запрашивает тот же файл, а файл не изменился (проверка по mtime), содержимое не добавляется в контекст второй раз. Это предотвращает раздувание контекста в длинных сессиях, особенно после compaction.

Включается командой `/optimizer` в чате или настройкой `"optimizer": true` в `.agent/settings.json`. Повторный `/optimizer` — выключает.

| Инструмент | Описание |
|---|---|
| `code_outline` | Список всех функций/методов файла с номерами строк |
| `code_definition` | Извлечь тело конкретной функции (с 3 строками контекста выше) |
| `code_context` | Показать N строк вокруг номера строки (целевая отмечена `>>>`) |

**74 парсера, 169 расширений:** PHP, JS/JSX/TS/TSX, Go, CSS/SCSS/SASS/LESS, Astro, Python, Ruby, Rust, Java, C#, Swift, Kotlin, Bash, C/C++, Objective-C, Lua, Dart, Scala, Elixir, Perl, PowerShell, Groovy, Zig, Haskell, R, OCaml, F#, Clojure, Erlang, Crystal, Nim, Julia, Vue, Svelte, HCL/Terraform, SQL, GraphQL, Prisma, PL/SQL, Cypher, Solidity, D, Fortran, Common Lisp, Racket, Tcl, Nix, VHDL, Millfork, PL/M-80, YAML, TOML, INI, LaTeX, Elm, Gleam, PureScript, Scheme, Lean, Idris, Assembly, Ada, Odin, Pascal, COBOL, Carbon, GLSL, Verilog, WAT, CMake, Makefile, CoffeeScript, Prolog, Smalltalk. Для неподдерживаемых типов автоматически переключается на `read_file`.

### Авто-генерация поддержки нового языка

Когда `code_outline` встречает неизвестный тип файла, он предлагает сгенерировать поддержку автоматически:

```
Научить агента читать структуру Wren-файлов? [Enter] да  [a] всегда  [n] не сейчас  [Esc] пропустить:
```

- **Enter** — сгенерировать, показать результат, затем подтвердить сохранение
- **a** — всегда генерировать без вопросов (сохраняет `"generateParser": "always"` в настройки)
- **n** — пропустить в этой сессии
- **Esc** — пропустить молча

Можно попросить агента напрямую: *«добавь поддержку .wren файлов»* — он вызовет `generate_parser` автоматически.

Управление через `/parser` или `"generateParser"` в `.agent/settings.json` (`"ask"` / `"always"` / `"never"`).

### Добавить поддержку языка вручную

1. Создать `src/parsers/mylang.js` (за основу взять `php.js`):

```js
import { strip, esc } from "./utils.js"

export default {
  extensions: [".wren"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*(?:\w+\s+)?(\w+)\s*\(/)
      if (m) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const pattern = new RegExp(`^\\s*(?:\\w+\\s+)?${esc(methodName)}\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) return i + 1
    }
    return null
  }
}
```

2. Зарегистрировать в `src/parsers/index.js`:

```js
import mylangParser from "./mylang.js"
register(mylangParser)
```

Готово — `code_outline` и `code_definition` сразу начнут работать с `.wren` файлами.

## Требования

- Node.js >= 18
- DeepSeek API ключ

## Запуск

```bash
agent                                          # обычный режим (thinking включён по умолчанию)
agent --think                                  # принудительно включить thinking (перекрывает конфиг)
agent --worktree                               # git-изоляция в отдельном worktree
agent --output-format=json "промпт"           # CI/скрипты — вывод в JSON
```

## Slash-команды

Вводятся прямо в чат:

| Команда | Описание |
|---|---|
| `/help` | Список всех команд |
| `/clear` | Сбросить контекст (= `/reset`, `/new`) |
| `/compact` | Принудительно сжать контекст через LLM |
| `/context` | Прогресс-бар заполненности контекста (= `/usage`) |
| `/export [файл]` | Сохранить историю в файл |
| `/recap` | Краткое резюме текущей сессии |
| `/btw <вопрос>` | Вопрос к модели без добавления в историю |
| `/diff` | Показать `git diff HEAD` |
| `/rewind` | Откат к одному из чекпоинтов (= `/undo`, `/checkpoint`) |
| `/review [фокус]` | Передать `git diff HEAD` агенту для код-ревью |
| `/security-review` | Ревью на уязвимости (SQLi, XSS, command injection и др.) |
| `/simplify [фокус]` | Три параллельных агента: DRY, качество кода, производительность |
| `/batch <задача>` | Агент декомпозирует задачу и запускает подзадачи параллельно |
| `/loop [N] <промпт>` | Запускать промпт каждые N секунд/минут/часов; повторный `/loop` останавливает |
| `/resume` | Восстановить предыдущую сессию (сессия сохраняется автоматически при выходе) |
| `/optimizer` | Включить/выключить code optimizer |
| `/parser [sub]` | Управление авто-генерацией поддержки языков: `ask`/`always`/`never`/`gen <файл>` |
| `/creative` | Переключить точный режим (temperature=0) ↔ режим рассуждений (temperature=0.5) |
| `/lang [код\|off]` | Язык ответов (`ru`, `en`, `de`, …) или сброс на авто-определение |
| `/model [N]` | Интерактивный выбор модели: flash/pro × режим думания none/high/max |

## Инструменты агента

| Инструмент | Описание |
|---|---|
| `read_file` | Читает текстовый файл. Бинарные файлы (exe, zip, png, mp4 и др.) блокируются автоматически |
| `write_file` | Создаёт или перезаписывает файл. Показывает цветной diff: удалённые строки — на тёмно-красном фоне, добавленные — на зелёном |
| `edit_file` | Точечная замена строки. Показывает diff с 3 строками контекста вокруг изменения |
| `glob` | Поиск файлов по паттерну (`src/**/*.js`). Бинарные файлы и пути из ignore-правил исключаются |
| `grep` | Поиск по содержимому файлов с поддержкой regex. Бинарные файлы пропускаются, ignore-правила применяются, лимит — 200 совпадений |
| `bash` | Выполнение shell-команд (с sandbox по умолчанию). Вывод обрезается до 8 000 символов |
| `web_search` | Поиск через DuckDuckGo без API-ключа |
| `web_fetch` | Загрузить URL и вернуть текстовое содержимое. GitHub-страницы релизов, репозиториев и raw-файлы обрабатываются автоматически |
| `todo_write` / `todo_read` | Список задач с зависимостями внутри сессии |
| `task` | Запуск подагентов: синхронно, параллельно или в фоне |
| `code_outline` | Список функций/методов с номерами строк (optimizer) |
| `code_definition` | Извлечь тело одной функции из файла (optimizer) |
| `code_context` | Показать строки вокруг указанного номера строки (optimizer) |
| `generate_parser` | Сгенерировать и установить поддержку неизвестного языка через LLM (optimizer) |

## Фильтрация поиска (.agentignore)

При первом запуске агент создаёт `.agentignore` в корне проекта. Инструменты `glob` и `grep` учитывают его — совпадающие пути исключаются до того, как результаты передаются модели.

Читаются и объединяются следующие файлы (каждый последующий дополняет предыдущий):

| Файл | Источник |
|---|---|
| `.agentignore` | Агент-специфичный (основной, создаётся автоматически) |
| `.claudeignore` | Claude Code |
| `.cursorignore` | Cursor |
| `.aiderignore` | Aider |
| `.copilotignore` | GitHub Copilot |

`node_modules/` и `.git/` исключаются всегда, независимо от ignore-файлов.

`.gitignore` намеренно не читается — он часто содержит сгенерированные файлы (`dist/`, `build/` и т.п.), которые агенту может понадобиться просматривать.

Синтаксис — как в `.gitignore`: `node_modules/`, `*.log`, `/dist/` и т.д. Паттерны загружаются один раз при старте и кэшируются на сессию.

## Разрешения

Инструменты с побочными эффектами (`write_file`, `edit_file`, `bash`) требуют подтверждения перед выполнением.

**Для файловых операций** (`write_file`, `edit_file`):
```
┌ [?] write_file → /project/src/utils.js
└ [y/Enter] один раз  [d] запомнить папку "/project/src"  [N] отклонить:
```
- `Enter` или `y` — разрешить один раз
- `d` — сохранить папку в `.agent/settings.json`, при следующих запусках спрашивать не будет

**Для bash и других инструментов**:
```
┌ [?] bash: {"command":"npm install"}
└ [y/Enter] один раз  [a] запомнить для этого проекта  [N] отклонить:
```
- `a` — добавить инструмент в `alwaysAllow` в `.agent/settings.json`, больше не спрашивает

Разрешения сохраняются в `.agent/settings.json` текущего проекта:
```json
{
  "alwaysAllow": ["read_file", "glob", "grep", "todo_read", "bash"],
  "approvedDirs": ["src", "tests"]
}
```

## Конфигурация

Создаётся автоматически при первом запуске в `.agent/settings.json`:

```json
{
  "model": "deepseek-v4-flash",
  "thinkingMode": "high",
  "contextLimit": 100000,
  "alwaysAllow": ["read_file", "glob", "grep", "todo_read", "generate_parser"],
  "neverAllow": [],
  "disallowedTools": [],
  "dangerouslyDisableSandbox": false,
  "mcpServers": {},
  "language": null,
  "optimizer": true,
  "generateParser": "ask"
}
```

| Поле | Описание |
|---|---|
| `model` | Модель: `"deepseek-v4-flash"` (по умолчанию) или `"deepseek-v4-pro"` |
| `thinkingMode` | Уровень thinking: `"high"` (по умолчанию), `"max"` (бюджет 16k токенов), `"none"` |
| `alwaysAllow` | Инструменты без запроса подтверждения |
| `neverAllow` | Инструменты, которые всегда блокируются |
| `disallowedTools` | Инструменты, скрытые от модели полностью |
| `dangerouslyDisableSandbox` | Снять ограничения sandbox в bash |
| `mcpServers` | Подключение MCP-серверов |
| `language` | Язык ответов агента (например `"Russian"`, `"English"`). Если не задан — агент подстраивается под язык пользователя |
| `optimizer` | Включить инструменты оптимизатора (`code_outline`, `code_definition`, `code_context`, `generate_parser`) |
| `generateParser` | Когда генерировать поддержку неизвестных языков: `"ask"` (по умолчанию), `"always"`, `"never"` |

## Память (AGENT.md)

Агент автоматически читает эти файлы и добавляет в системный промпт:

| Файл | Назначение |
|---|---|
| `~/.agent/AGENT.md` | Глобальные настройки для всех проектов |
| `.agent/AGENT.md` | Настройки текущего проекта |
| `AGENT.md` | Инструкции в корне репозитория |

## MCP-серверы

Любой MCP-сервер подключается через `.agent/settings.json`:

```json
"mcpServers": {
  "fs": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
  }
}
```

Инструменты сервера регистрируются автоматически как `mcp__fs__<tool>`.

## Хуки

Shell-команды, запускаемые на события агента (`.agent/hooks.json`):

```json
{
  "PreToolUse": [{ "command": "cat >> agent.log" }],
  "PostToolUse": [],
  "UserPromptSubmit": [],
  "PreCompact": [],
  "Stop": []
}
```

`PreToolUse` может заблокировать выполнение инструмента (exit code != 0).

## Смена модели

По умолчанию используется DeepSeek. В `src/agent.js` можно поменять `baseURL`, в `.agent/settings.json` — `model`. Уровень thinking управляется отдельно через `thinkingMode` в настройках или командой `/model`.

```
DeepSeek (по умолчанию)  baseURL: https://api.deepseek.com       model: deepseek-v4-flash
DeepSeek Pro             baseURL: https://api.deepseek.com       model: deepseek-v4-pro
OpenAI                   без baseURL                              model: gpt-4o
Ollama (локально)        baseURL: http://localhost:11434/v1       model: qwen2.5-coder
Groq                     baseURL: https://api.groq.com/openai/v1  model: llama-3.3-70b-versatile
```

## JSON-режим (CI/скрипты)

```bash
agent --output-format=json "что делает index.js?"
echo "напиши hello world" | agent --output-format=json
```

Каждое событие — отдельная строка JSON:

```json
{ "type": "text", "text": "фрагмент ответа" }
{ "type": "tool_call", "tool": "bash", "args": { "command": "ls" } }
{ "type": "tool_result", "tool": "bash", "result": "file1.js\nfile2.js" }
```

## Зависимости

| Пакет | Зачем |
|---|---|
| `openai` | Клиент DeepSeek API (OpenAI-совместимый) |
| `@modelcontextprotocol/sdk` | MCP-клиент |
| `fast-glob` | Поиск файлов в `glob` и `grep` |
| `dotenv` | Загрузка `.env` |

## Лицензия

[Смотри LICENSE](./LICENSE) — только личное использование.
