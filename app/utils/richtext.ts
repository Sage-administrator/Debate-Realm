/**
 * richtext.ts — 富文本（HTML）安全过滤与工具
 *
 * 用途：
 * - FormDesigner 的「问卷说明」改为富文本编辑后，存储的是一段受限 HTML。
 * - 编辑器在客户端（window 存在）用 DOMParser 做精细白名单过滤；
 *   服务端（SSR）无 DOMParser 时退化为正则粗过滤，避免脚本 / 事件处理器注入。
 * - 由于编辑时已经过客户端净化，存储值基本可信；SSR 仅作兜底防御。
 *
 * 允许的标签：段落 / 换行 / 强调 / 链接 / 列表 / 标题 / 行内样式 span。
 * 允许的样式：color / background-color / font-size / font-weight / text-align / text-decoration。
 * 链接仅允许 http(s): / mailto:，并强制 target=_blank rel=noopener noreferrer。
 */

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE',
  'SPAN', 'DIV', 'A', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'CODE',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(['HREF', 'TARGET', 'REL']),
  SPAN: new Set(['STYLE']),
}

const ALLOWED_STYLE = /^(color|background-color|font-size|font-weight|text-align|text-decoration)$/i

export function isRich(html: string): boolean {
  return /<[a-z][\s\S]*>/i.test(html || '')
}

export function escapeHtml(s: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  // c 是正则匹配的字符，一定是 map 中的 key
  return (s || '').replace(/[&<>"']/g, (c) => map[c]!)
}

/** 服务端兜底：移除危险标签与事件属性，不做结构级解析 */
function stripDangerousServer(html: string): string {
  return (html || '')
    .replace(/<\s*(script|iframe|object|embed|style|link|meta|form|input|button)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|style|link|meta|form|input|button)[^>]*\/?>/gi, '')
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
}

export function sanitizeHtml(input: string): string {
  const html = input || ''
  if (!html) return ''

  // 服务端：无 DOM 解析能力，使用正则粗过滤
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return stripDangerousServer(html)
  }

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  sanitizeNode(doc.body)
  return doc.body.innerHTML.trim()
}

function sanitizeNode(node: Node) {
  const children = Array.from(node.childNodes)
  for (const child of children) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.parentNode?.removeChild(child)
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const el = child as Element
    const tag = el.tagName.toUpperCase()

    // 不允许的标签：拆解（保留其子节点）后继续净化
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode!
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
      sanitizeNode(parent)
      continue
    }

    const allowed = ALLOWED_ATTRS[tag] || new Set<string>()
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toUpperCase()
      if (!allowed.has(name)) {
        el.removeAttribute(attr.name)
        continue
      }
      if (name === 'HREF') {
        const v = attr.value.trim()
        if (!/^(https?:|mailto:)/i.test(v)) {
          el.removeAttribute('href')
          el.removeAttribute('target')
          el.removeAttribute('rel')
          continue
        }
        el.setAttribute('target', '_blank')
        el.setAttribute('rel', 'noopener noreferrer')
      } else if (name === 'STYLE') {
        const filtered = attr.value
          .split(';')
          .map((s) => s.trim())
          .filter((s) => {
            const prop = s.split(':')[0]?.trim()
            return !!prop && ALLOWED_STYLE.test(prop)
          })
          .join('; ')
        if (filtered) el.setAttribute('style', filtered)
        else el.removeAttribute('style')
      }
    }
    sanitizeNode(el)
  }
}
