const MAX_CHARS = 20000

// Убирает HTML-теги и возвращает читаемый текст
function htmlToText(html) {
  // Удалить <script>, <style>, <head> целиком
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")

  // Заменить блочные теги на переносы
  text = text.replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|main|nav|aside|blockquote)>/gi, "\n")
  text = text.replace(/<br\s*\/?>/gi, "\n")
  text = text.replace(/<hr\s*\/?>/gi, "\n---\n")

  // Убрать оставшиеся теги
  text = text.replace(/<[^>]+>/g, "")

  // Декодировать HTML-энтити
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))

  // Убрать множественные пустые строки
  text = text.replace(/\n{3,}/g, "\n\n").trim()

  return text
}

// Конвертирует GitHub URL в API-URL, если применимо.
// Возвращает { apiUrl, headers } или null если не GitHub.
function resolveGitHubUrl(url) {
  // https://github.com/{owner}/{repo}/releases/tag/{tag}
  let m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/([^/?#]+)/)
  if (m) {
    return {
      apiUrl: `https://api.github.com/repos/${m[1]}/${m[2]}/releases/tags/${m[3]}`,
      headers: { Accept: "application/vnd.github+json" }
    }
  }

  // https://github.com/{owner}/{repo}/releases  (список)
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/?$/)
  if (m) {
    return {
      apiUrl: `https://api.github.com/repos/${m[1]}/${m[2]}/releases?per_page=10`,
      headers: { Accept: "application/vnd.github+json" }
    }
  }

  // https://github.com/{owner}/{repo}/blob/{branch}/{path}  →  raw
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/)
  if (m) {
    return {
      apiUrl: `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`,
      headers: {}
    }
  }

  // https://github.com/{owner}/{repo}  (репозиторий)
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/)
  if (m) {
    return {
      apiUrl: `https://api.github.com/repos/${m[1]}/${m[2]}`,
      headers: { Accept: "application/vnd.github+json" }
    }
  }

  return null
}

// Форматирует GitHub API-ответ в человекочитаемый текст
function formatGitHubRelease(data) {
  if (Array.isArray(data)) {
    // Список релизов
    return data.map(r =>
      `## ${r.tag_name}${r.prerelease ? " [pre-release]" : ""}${r.draft ? " [draft]" : ""}\n` +
      `Published: ${r.published_at}\n` +
      (r.body ? r.body.trim() + "\n" : "") +
      `Assets: ${r.assets.map(a => a.name).join(", ") || "none"}`
    ).join("\n\n---\n\n")
  }

  if (data.tag_name) {
    // Один релиз
    const lines = [
      `# ${data.name || data.tag_name}`,
      `Tag: ${data.tag_name}`,
      `Published: ${data.published_at}`,
      data.prerelease ? "Pre-release: yes" : "",
      "",
      data.body ? data.body.trim() : "(no description)",
      "",
      `Assets (${data.assets.length}):`,
      ...data.assets.map(a =>
        `  - ${a.name}  (${(a.size / 1024).toFixed(0)} KB)  ${a.browser_download_url}`
      )
    ]
    return lines.filter(l => l !== undefined).join("\n")
  }

  if (data.full_name) {
    // Репозиторий
    return [
      `# ${data.full_name}`,
      data.description || "",
      `Stars: ${data.stargazers_count}  Forks: ${data.forks_count}`,
      `Language: ${data.language}`,
      `Default branch: ${data.default_branch}`,
      `URL: ${data.html_url}`
    ].join("\n")
  }

  return JSON.stringify(data, null, 2)
}

export const webFetchTool = {
  name: "web_fetch",
  description: "Fetch a URL and return its text content. Use this when the user provides a URL and asks to read, check, or analyze it. Supports GitHub release pages, repo pages, and raw files automatically.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to fetch" }
    },
    required: ["url"]
  },
  isReadOnly: true,
  async execute({ url }) {
    // Специальная обработка GitHub URL
    const gh = resolveGitHubUrl(url)
    if (gh) {
      let res
      try {
        res = await fetch(gh.apiUrl, {
          headers: {
            "User-Agent": "deepseek-agent/0.1",
            ...gh.headers
          }
        })
      } catch (err) {
        return `Fetch failed: ${err.message}`
      }

      if (!res.ok) return `GitHub API: HTTP ${res.status} ${res.statusText}`

      const contentType = res.headers.get("content-type") ?? ""
      if (contentType.includes("application/json")) {
        const data = await res.json()
        const text = formatGitHubRelease(data)
        return text.length > MAX_CHARS
          ? text.slice(0, MAX_CHARS) + `\n[... truncated]`
          : text
      }

      // Raw файл
      const text = await res.text()
      return text.length > MAX_CHARS
        ? text.slice(0, MAX_CHARS) + `\n[... truncated, ${text.length - MAX_CHARS} chars omitted]`
        : text
    }

    // Обычный URL
    let res
    try {
      res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; deepseek-agent/0.1)",
          "Accept": "text/html,application/xhtml+xml,*/*"
        },
        redirect: "follow"
      })
    } catch (err) {
      return `Fetch failed: ${err.message}`
    }

    if (!res.ok) return `HTTP ${res.status} ${res.statusText}`

    const contentType = res.headers.get("content-type") ?? ""

    // JSON — вернуть как есть
    if (contentType.includes("application/json")) {
      const text = await res.text()
      return text.length > MAX_CHARS
        ? text.slice(0, MAX_CHARS) + `\n[... truncated, ${text.length - MAX_CHARS} chars omitted]`
        : text
    }

    // Текст/HTML — конвертировать в plain text
    if (contentType.includes("text/")) {
      const html = await res.text()
      const text = contentType.includes("html") ? htmlToText(html) : html.trim()
      return text.length > MAX_CHARS
        ? text.slice(0, MAX_CHARS) + `\n[... truncated, ${text.length - MAX_CHARS} chars omitted]`
        : text
    }

    return `Unsupported content type: ${contentType}`
  }
}
