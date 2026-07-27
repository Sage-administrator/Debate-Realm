/**
 * useCertificate.ts — 荣誉证书状态管理 + 导出 + 自动填充
 *  - config 为 reactive 单一数据源，编辑器与纸张共用
 *  - 配置按赛事持久化到 localStorage（防抖）
 *  - 导出：PNG（html-to-image 截图 #cert-paper）/ PDF（同图在新窗口打印）
 *  - 字体：导出前 await document.fonts.ready，避免 Web 字体未嵌入导致回退
 */
import { reactive, ref, watch } from 'vue'
// html-to-image 体积不小且仅在导出证书时使用，改为导出动作内动态 import()，避免随 composable 常驻打包
import {
  type CertificateConfig,
  type FillKind,
  defaultConfig,
  CONFIG_VERSION,
  SIZE_PRESETS,
  TEMPLATES,
  applyTemplate,
} from '~/utils/certificateTemplates'

export function useCertificate(tournamentId: string) {
  const KEY = `cert:${tournamentId}`

  function load(): CertificateConfig | null {
    if (typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      // 版本不符（无版本 / 旧版本）→ 视为不兼容缓存，回退到默认（横向 A4）
      // 这同时清掉历史可能残留的竖向(a4-portrait)配置
      if (parsed.version !== CONFIG_VERSION) return null
      // 合并默认值，防止旧配置缺字段
      return { ...defaultConfig(), ...parsed, style: { ...defaultConfig().style, ...(parsed.style || {}) } }
    } catch {
      return null
    }
  }

  const config = reactive<CertificateConfig>(load() ?? defaultConfig())

  const standings = ref<any[]>([])
  const bestDebaters = ref<any[]>([])
  const tournamentName = ref('')
  const issuer = ref('')

  // —— 持久化（防抖） ——
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(config))
    } catch {
      /* 忽略写入失败（隐私模式等） */
    }
  }
  watch(
    config,
    () => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(persist, 400)
    },
    { deep: true },
  )

  // —— 赛事信息 / 排名数据 ——
  function setTournamentInfo(name: string, organizer: string) {
    tournamentName.value = name
    issuer.value = organizer
    if (!config.tournamentName) config.tournamentName = name
    if (!config.issuer) config.issuer = organizer
  }

  function setStandings(s: any[], b: any[]) {
    standings.value = s || []
    bestDebaters.value = b || []
  }

  // —— 模板套用 ——
  function applyTpl(key: string) {
    applyTemplate(config, key)
  }

  // —— 从赛事数据自动填充获得者 ——
  function fill(kind: FillKind) {
    const tName = config.tournamentName || '本次比赛'
    if (kind === 'best-debater') {
      const d = bestDebaters.value[0]
      if (!d) return
      config.recipientType = 'person'
      config.recipientName = d.name
      config.recipientLogo = ''
      config.template = 'best-debater'
      const tpl = TEMPLATES.find(t => t.key === 'best-debater')!
      config.awardText = (tpl.apply.awardText || '').replace('{tournament}', tName)
      if (tpl.apply.style) Object.assign(config.style, tpl.apply.style)
      return
    }
    const idx = kind === 'champion' ? 0 : kind === 'runnerup' ? 1 : kind === 'third' ? 2 : 0
    const team = standings.value[idx]
    if (!team) return
    const tplKey = kind === 'champion' ? 'champion' : kind === 'runnerup' ? 'runnerup' : kind === 'third' ? 'third' : 'participant'
    config.recipientType = 'team'
    config.recipientName = team.name
    config.recipientLogo = ''
    config.template = tplKey
    const tpl = TEMPLATES.find(t => t.key === tplKey)!
    config.awardText = (tpl.apply.awardText || '').replace('{tournament}', tName)
    if (tpl.apply.style) Object.assign(config.style, tpl.apply.style)
  }

  function reset() {
    Object.assign(config, defaultConfig())
  }

  // —— 导出 PNG ——
  async function exportPng(scale = 2) {
    const node = document.getElementById('cert-paper')
    if (!node) return
    await document.fonts.ready
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(node, {
      pixelRatio: scale,
      cacheBust: true,
      // 不强制 backgroundColor，纸张自身有背景
    })
    const a = document.createElement('a')
    const safe = (config.recipientName || config.title || 'certificate').replace(/[\\/:*?"<>|]/g, '_')
    a.href = dataUrl
    a.download = `${safe}.png`
    a.click()
  }

  // —— 导出 PDF（以高清图在新窗口打印，WYSIWYG 且跨浏览器稳定） ——
  async function printPdf() {
    const node = document.getElementById('cert-paper')
    if (!node) return
    await document.fonts.ready
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true })
    const printSize = SIZE_PRESETS[config.size]?.printSize || '297mm 210mm'
    const w = window.open('', '_blank')
    if (!w) {
      // 弹窗被拦截时退化为直接下载 PNG
      await exportPng(2)
      return
    }
    const title = config.title || '荣誉证书'
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>` +
      `<style>@page{size:${printSize};margin:0}html,body{margin:0;padding:0}` +
      `img{display:block;width:100%;height:100%;object-fit:contain}</style></head>` +
      `<body><img src="${dataUrl}"/></body></html>`,
    )
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 350)
  }

  return {
    config,
    standings,
    bestDebaters,
    tournamentName,
    issuer,
    setTournamentInfo,
    setStandings,
    applyTpl,
    fill,
    reset,
    exportPng,
    printPdf,
  }
}
