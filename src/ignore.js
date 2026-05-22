import fs from "fs/promises"
import path from "path"

// Файлы, которые читаем (в порядке приоритета — последний перекрывает предыдущий).
// .gitignore намеренно не включён: он исключает генерируемые файлы (dist/, build/ и т.п.),
// которые агенту может понадобиться просматривать.
const IGNORE_FILES = [
  ".agentignore",
  ".claudeignore",
  ".cursorignore",
  ".aiderignore",
  ".copilotignore",
]

// Паттерны, которые всегда применяются независимо от ignore-файлов
const DEFAULT_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
]

// Содержимое .agentignore по умолчанию
const DEFAULT_AGENTIGNORE = `# Agent ignore patterns — auto-created by deepseek-agent
# Add paths/patterns to exclude from file search tools (glob, grep)
# Syntax is the same as .gitignore

# Dependencies
node_modules/

# Build outputs
dist/
build/
out/
.next/
.nuxt/
.output/

# Coverage & cache
coverage/
.nyc_output/
.cache/
.parcel-cache/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS artifacts
.DS_Store
Thumbs.db

# Compiled binaries
*.exe
*.dll
*.so
*.dylib

# Archives
*.zip
*.tar
*.tar.gz
*.tgz
*.rar
`

let cachedPatterns = null

/**
 * Конвертирует строку из gitignore-формата в minimatch-паттерн для fast-glob.
 * Возвращает null для строк, которые нужно пропустить.
 */
function toGlobPattern(line) {
  const p = line.trim()
  if (!p || p.startsWith("#")) return null   // пустая строка или комментарий
  if (p.startsWith("!"))       return null   // негативные паттерны не поддерживаются в ignore

  // Уже содержит ** — используем как есть
  if (p.includes("**")) return p

  // Паттерн привязан к корню (начинается с /)
  if (p.startsWith("/")) {
    const rest = p.slice(1)
    if (rest.endsWith("/")) return rest + "**"     // /dist/ → dist/**
    return rest                                     // /file.txt → file.txt
  }

  // Директория (заканчивается на /)
  if (p.endsWith("/")) {
    const name = p.slice(0, -1)
    return `**/${name}/**`                          // node_modules/ → **/node_modules/**
  }

  // Содержит / внутри (но не в начале/конце) — относительный путь от корня
  if (p.includes("/")) return p                     // src/generated/*.js → src/generated/*.js

  // Простое имя или паттерн — совпадает где угодно
  return `**/${p}`                                  // *.log → **/*.log
}

/**
 * Читает один ignore-файл и возвращает массив glob-паттернов.
 */
async function readIgnoreFile(filePath) {
  let content
  try {
    content = await fs.readFile(filePath, "utf-8")
  } catch {
    return []  // файл не существует или недоступен
  }

  const patterns = []
  for (const line of content.split("\n")) {
    const glob = toGlobPattern(line)
    if (glob) patterns.push(glob)
  }
  return patterns
}

/**
 * Инициализирует модуль: создаёт .agentignore если нет, загружает и кэширует паттерны.
 * @param {string} cwd - директория проекта (process.cwd())
 */
export async function initIgnore(cwd = process.cwd()) {
  const agentIgnorePath = path.join(cwd, ".agentignore")

  // Создаём .agentignore если не существует
  try {
    await fs.access(agentIgnorePath)
  } catch {
    await fs.writeFile(agentIgnorePath, DEFAULT_AGENTIGNORE, "utf-8")
  }

  // Загружаем и объединяем все ignore-файлы
  const patterns = [...DEFAULT_PATTERNS]
  for (const file of IGNORE_FILES) {
    const filePatterns = await readIgnoreFile(path.join(cwd, file))
    patterns.push(...filePatterns)
  }

  // Дедупликация
  cachedPatterns = [...new Set(patterns)]
}

/**
 * Возвращает кэшированные паттерны. Если initIgnore() ещё не вызывался — возвращает дефолты.
 */
export function getIgnorePatterns() {
  return cachedPatterns ?? DEFAULT_PATTERNS
}

/**
 * Сбрасывает кэш (для тестов или перезагрузки).
 */
export function resetIgnoreCache() {
  cachedPatterns = null
}
