/**
 * certificateTemplates.ts — 荣誉证书：尺寸预设 + 模板 + 配置模型
 * 设计原则（与 TimerDisplay 一致）：
 *  - 编辑器内纸张用「固定设计坐标」渲染（px），export 直接截该节点 → 预览=导出
 *  - 设计基准 = 150 DPI；高清导出时由 html-to-image 的 pixelRatio 补足到 300 DPI
 */

// ════════════ 画布尺寸预设 ════════════
export type CertificateSizeKey = 'a4-landscape' | 'a4-portrait' | 'square' | '16:9'

export interface SizePreset {
  key: CertificateSizeKey
  label: string
  width: number // 设计基准 px（150 DPI）
  height: number
  printSize: string // @media print 实际纸张尺寸
}

export const SIZE_PRESETS: Record<CertificateSizeKey, SizePreset> = {
  'a4-landscape': { key: 'a4-landscape', label: 'A4 横向', width: 1754, height: 1240, printSize: '297mm 210mm' },
  'a4-portrait': { key: 'a4-portrait', label: 'A4 纵向', width: 1240, height: 1754, printSize: '210mm 297mm' },
  'square': { key: 'square', label: '方形 1:1', width: 1400, height: 1400, printSize: '1400px 1400px' },
  '16:9': { key: '16:9', label: '宽屏 16:9', width: 1600, height: 900, printSize: '1600px 900px' },
}

export const SIZE_PRESET_LIST = Object.values(SIZE_PRESETS)

// 参考基准（用于内部字号/间距等比缩放系数）
export const REFERENCE_WIDTH = 1754

// 配置版本：localStorage 缓存一旦不兼容（无版本 / 版本不符）即回退到默认（横向 A4）
// 2026-07-19：首次引入版本化，清掉历史可能残留的竖向(a4-portrait)配置
export const CONFIG_VERSION = 1

// ════════════ 样式枚举 ════════════
export type ThemeKey =
  | 'gold' | 'blue' | 'red' | 'green' | 'purple'
  | 'teal' | 'orange' | 'rose' | 'slate' | 'custom'
export type BorderKey = 'classic' | 'modern' | 'none'
export type FontKey = 'serif' | 'sans' | 'kai'
export type RecipientType = 'team' | 'person'

// 主题配色（纸张本身的真实配色，不受站点暗色主题影响）
export interface ThemePalette {
  paperBg: string // 纸张背景（渐变/纯色）
  ink: string // 主文字（标题/获得者）
  subInk: string // 次要文字（颁奖词/赛事名）
  frame: string // 边框主色
  frameAccent: string // 边框辅色（内线/角饰）
  seal: string // 印章颜色
}

export const THEME_PALETTES: Record<ThemeKey, ThemePalette> = {
  gold: {
    paperBg: 'radial-gradient(ellipse at 50% 0%, #fffdf6 0%, #fbf3df 70%, #f3e6c4 100%)',
    ink: '#7a4b12',
    subInk: '#9a7636',
    frame: '#c9a44a',
    frameAccent: '#e7cf86',
    seal: '#b3271f',
  },
  blue: {
    paperBg: 'radial-gradient(ellipse at 50% 0%, #ffffff 0%, #eef4fb 70%, #dde9f6 100%)',
    ink: '#13386b',
    subInk: '#3a5a8c',
    frame: '#2f6fb3',
    frameAccent: '#9cc3e8',
    seal: '#b3271f',
  },
  red: {
    paperBg: 'radial-gradient(ellipse at 50% 0%, #fffaf8 0%, #fbeee9 70%, #f6ddd4 100%)',
    ink: '#9c2018',
    subInk: '#b9483c',
    frame: '#b3271f',
    frameAccent: '#e0a79e',
    seal: '#b3271f',
  },
  green: {
    paperBg: 'radial-gradient(ellipse at 50% 0%, #f4faf4 0%, #e7f3e9 70%, #d4e8d8 100%)',
    ink: '#1f5132',
    subInk: '#3f7355',
    frame: '#2f7d4f',
    frameAccent: '#8fc7a3',
    seal: '#b3271f',
  },
  purple: {
    paperBg: 'radial-gradient(ellipse at 50% 0%, #faf6ff 0%, #f0e8fb 70%, #e3d4f2 100%)',
    ink: '#4a2a78',
    subInk: '#6f4f9a',
    frame: '#7b4bbf',
    frameAccent: '#c4a8e8',
    seal: '#b3271f',
  },
  teal: {
    paperBg: 'radial-gradient(ellipse at 50% 0%, #f2fbfb 0%, #e2f3f3 70%, #cfe9ea 100%)',
    ink: '#13514f',
    subInk: '#357a78',
    frame: '#1f8a86',
    frameAccent: '#8fd0cd',
    seal: '#b3271f',
  },
  orange: {
    paperBg: 'radial-gradient(ellipse at 50% 0%, #fffaf3 0%, #fdeedc 70%, #f8ddc0 100%)',
    ink: '#8a4a12',
    subInk: '#a96a2c',
    frame: '#d98026',
    frameAccent: '#f0c089',
    seal: '#b3271f',
  },
  rose: {
    paperBg: 'radial-gradient(ellipse at 50% 0%, #fff6f8 0%, #fbe9ee 70%, #f6d7df 100%)',
    ink: '#8a2a4a',
    subInk: '#a84d6b',
    frame: '#cf4f7a',
    frameAccent: '#f0a9c2',
    seal: '#b3271f',
  },
  slate: {
    paperBg: 'radial-gradient(ellipse at 50% 0%, #ffffff 0%, #f1f3f5 70%, #e3e7eb 100%)',
    ink: '#1f2933',
    subInk: '#475569',
    frame: '#334155',
    frameAccent: '#94a3b8',
    seal: '#b3271f',
  },
  custom: {
    paperBg: '#ffffff',
    ink: '#222222',
    subInk: '#555555',
    frame: '#888888',
    frameAccent: '#cccccc',
    seal: '#b3271f',
  },
}

export const THEME_LIST: { key: ThemeKey; label: string; swatch: string }[] = [
  { key: 'gold', label: '经典金', swatch: 'linear-gradient(135deg,#e7cf86,#c9a44a)' },
  { key: 'blue', label: '现代蓝', swatch: 'linear-gradient(135deg,#9cc3e8,#2f6fb3)' },
  { key: 'red', label: '红头官方', swatch: 'linear-gradient(135deg,#e0a79e,#b3271f)' },
  { key: 'green', label: '墨绿', swatch: 'linear-gradient(135deg,#8fc7a3,#2f7d4f)' },
  { key: 'purple', label: '紫金', swatch: 'linear-gradient(135deg,#c4a8e8,#7b4bbf)' },
  { key: 'teal', label: '青碧', swatch: 'linear-gradient(135deg,#8fd0cd,#1f8a86)' },
  { key: 'orange', label: '暖橙金', swatch: 'linear-gradient(135deg,#f0c089,#d98026)' },
  { key: 'rose', label: '玫瑰金', swatch: 'linear-gradient(135deg,#f0a9c2,#cf4f7a)' },
  { key: 'slate', label: '深空灰', swatch: 'linear-gradient(135deg,#94a3b8,#334155)' },
  { key: 'custom', label: '自定义', swatch: 'linear-gradient(135deg,#ccc,#888)' },
]

export const BORDER_LIST: { key: BorderKey; label: string }[] = [
  { key: 'classic', label: '经典双线' },
  { key: 'modern', label: '简约线' },
  { key: 'none', label: '无边框' },
]

export const FONT_LIST: { key: FontKey; label: string; stack: string }[] = [
  { key: 'serif', label: '宋体（思源宋体）', stack: "'SourceHanSerifCN-Heavy', 'SimSun', 'STSong', serif" },
  { key: 'sans', label: '黑体（阿里普惠）', stack: "'AlibabaPuHuiTi', 'Microsoft YaHei', 'PingFang SC', sans-serif" },
  { key: 'kai', label: '楷体', stack: "'KaiTi', 'STKaiti', 'Kaiti SC', 'SimSun', serif" },
]

export function fontStack(key: FontKey): string {
  // find 可能返回 undefined，但 FONT_LIST[0] 作为兜底，确保非空
  return (FONT_LIST.find(f => f.key === key) ?? FONT_LIST[0])!.stack
}

// ════════════ 配置模型 ════════════
export interface CertificateStyle {
  theme: ThemeKey
  border: BorderKey
  font: FontKey
  bg: string // 自定义背景（theme=custom 时生效，可为渐变/纯色/url）
  seal: boolean
}

export interface CertificateConfig {
  version: number // CONFIG_VERSION，用于缓存迁移
  size: CertificateSizeKey
  template: string
  title: string // 证书标题，如「荣誉证书」
  recipientName: string // 获得者
  recipientType: RecipientType
  recipientLogo?: string // 队徽 url（team 时）
  tournamentName: string // 赛事名称（自动）
  awardText: string // 颁奖词/事由
  date: string // 颁发日期（YYYY-MM-DD）
  issuer: string // 落款/主办方（自动）
  certNo: string // 证书编号（纸张左上角展示）
  style: CertificateStyle
}

export function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function defaultConfig(): CertificateConfig {
  return {
    version: CONFIG_VERSION,
    size: 'a4-landscape',
    template: 'champion',
    title: '荣誉证书',
    recipientName: '',
    recipientType: 'team',
    recipientLogo: '',
    tournamentName: '',
    awardText: '在本次比赛中表现优异，特发此证，以资鼓励。',
    date: todayISO(),
    issuer: '',
    certNo: '',
    style: { theme: 'gold', border: 'classic', font: 'serif', bg: '#ffffff', seal: true },
  }
}

// ════════════ 内置模板（含默认内容 + 纸张样式覆盖） ════════════
export interface CertificateTemplate {
  key: string
  label: string
  description: string
  // 套用模板时合并进 config 的字段
  apply: Partial<CertificateConfig>
}

export const TEMPLATES: CertificateTemplate[] = [
  {
    key: 'champion',
    label: '冠军证书',
    description: '红金官方风 · 颁发给夺冠队伍',
    apply: {
      title: '荣誉证书',
      recipientType: 'team',
      awardText: '在 {tournament} 中荣获冠军，特此表彰。',
      style: { theme: 'red', border: 'classic', font: 'serif', bg: '#ffffff', seal: true },
    },
  },
  {
    key: 'runnerup',
    label: '亚军证书',
    description: '现代蓝风 · 颁发给亚军队伍',
    apply: {
      title: '荣誉证书',
      recipientType: 'team',
      awardText: '在 {tournament} 中荣获亚军，特此表彰。',
      style: { theme: 'blue', border: 'classic', font: 'serif', bg: '#ffffff', seal: true },
    },
  },
  {
    key: 'third',
    label: '季军证书',
    description: '经典金风 · 颁发给季军队伍',
    apply: {
      title: '荣誉证书',
      recipientType: 'team',
      awardText: '在 {tournament} 中荣获季军，特此表彰。',
      style: { theme: 'gold', border: 'classic', font: 'serif', bg: '#ffffff', seal: true },
    },
  },
  {
    key: 'participant',
    label: '参赛证明',
    description: '蓝调现代 · 颁发给参赛队伍/个人',
    apply: {
      title: '参赛证明',
      recipientType: 'team',
      awardText: '参加 {tournament}，积极拼搏，特此证明。',
      style: { theme: 'blue', border: 'modern', font: 'sans', bg: '#ffffff', seal: false },
    },
  },
  {
    key: 'best-debater',
    label: '最佳辩手',
    description: '紫金风 · 颁发给个人',
    apply: {
      title: '最佳辩手',
      recipientType: 'person',
      awardText: '在 {tournament} 中荣获「最佳辩手」称号，特此表彰。',
      style: { theme: 'gold', border: 'classic', font: 'serif', bg: '#ffffff', seal: true },
    },
  },
  {
    key: 'custom',
    label: '自定义',
    description: '空白画布 · 自由编辑全部内容',
    apply: {
      title: '荣誉证书',
      recipientType: 'team',
      awardText: '在此填写颁奖词……',
      style: { theme: 'gold', border: 'classic', font: 'serif', bg: '#ffffff', seal: true },
    },
  },
]

// 将模板套用到现有 config（保留赛事名/日期/落款等自动字段）
export function applyTemplate(config: CertificateConfig, key: string) {
  const tpl = TEMPLATES.find(t => t.key === key)
  if (!tpl) return
  config.template = key
  const a = tpl.apply
  if (a.title !== undefined) config.title = a.title
  if (a.recipientType !== undefined) config.recipientType = a.recipientType
  if (a.awardText !== undefined) {
    config.awardText = a.awardText.replace('{tournament}', config.tournamentName || '本次比赛')
  }
  if (a.style) Object.assign(config.style, a.style)
}

// 从赛事数据自动填充获得者
export type FillKind = 'champion' | 'runnerup' | 'third' | 'best-debater' | 'participant'

export function fillOptionsFromData(standings: any[], bestDebaters: any[]) {
  const opts: { label: string; value: FillKind; disabled?: boolean }[] = []
  if (standings[0]) opts.push({ label: `冠军：${standings[0].name}`, value: 'champion' })
  if (standings[1]) opts.push({ label: `亚军：${standings[1].name}`, value: 'runnerup' })
  if (standings[2]) opts.push({ label: `季军：${standings[2].name}`, value: 'third' })
  if (bestDebaters[0]) opts.push({ label: `最佳辩手：${bestDebaters[0].name}`, value: 'best-debater' })
  if (standings.length) opts.push({ label: `参赛队伍：${standings[0].name}`, value: 'participant' })
  return opts
}
