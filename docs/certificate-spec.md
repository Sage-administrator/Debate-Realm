# 荣誉证书制作界面 — 设计规格 (Spec)

> 面向对象：`app/pages/tournaments/[id]/certificate.vue`
> 模式：spec（先定方案，确认后再实现）
> 依赖既有模式：`TimerDisplay.vue` / `TimerPreview.vue` 的「固定设计尺寸 + transform scale」画布引擎、`tournament.vue` 双层导航、CSS 变量主题体系。

---

## 1. 目标与范围

制作一个**所见即所得**的荣誉证书制作器，挂在「赛后统计 → 荣誉证书」下。

- 从赛事真实数据一键填充（冠军/亚军/最佳辩手/参赛队伍）。
- 多套模板（冠军、亚军、季军、参赛证明、最佳辩手、自定义）。
- 自由编辑字段与纸张样式（配色、边框、字体、印章、落款）。
- 导出 **高清 PNG** 与 **PDF**，导出结果与编辑器预览 100% 一致。
- v1 不依赖后端持久化（配置存 localStorage/按赛事），服务端保存作为后续扩展。

---

## 2. 画布与「制作大小」方案（核心）

采用与 `TimerDisplay` 一致的**单一视觉来源 + 固定设计坐标系**策略，彻底避免「预览 ≠ 导出」漂移。

### 2.1 设计基准（design base）= 导出分辨率
编辑器内纸张用**固定 px 尺寸**渲染，外层用 `transform: scale()` 等比缩放填充。

| 预设 | 设计基准 (px) | 比例 | 说明 |
|---|---|---|---|
| **A4 横向**（默认） | 1754 × 1240 | ≈1.414 | 150 DPI，最常见证书版式 |
| A4 纵向 | 1240 × 1754 | ≈0.707 | 竖向荣誉证书 |
| 方形 1:1 | 1400 × 1400 | 1 | 社交分享友好 |
| 宽屏 16:9 | 1600 × 900 | 1.778 | 投屏/线上展示 |

### 2.2 缩放引擎（复用 TimerPreview 技术）
- 外层容器用 `ResizeObserver` 测量可用宽高，`scale = min(availW/baseW, availH/baseH) × zoom`。
- 纸张 `transform: scale(scale); transform-origin: top left`，外层容器显式设 `baseW*scale × baseH*scale` 占位，避免留白/溢出。
- 提供缩放滑块（0.5×–2×）+「适应屏幕 / 实际大小」快捷键。
- 所有文字、边框、间距在纸张内部**一律用固定 px**（不随容器变），保证导出像素级一致。

### 2.3 导出分辨率（DPI 映射）
- **PNG**：`html-to-image` 的 `toPng(node, { pixelRatio })`。
  - 标准（150 DPI）：`pixelRatio = 1` → 直接按设计基准导出。
  - 高清（300 DPI）：`pixelRatio = 2` → A4 横向输出 3508×2480。
- **PDF**：浏览器原生打印（`@media print` 仅渲染纸张，按 A4 实际尺寸输出）。
  - 真矢量、字体最清晰、**零依赖**。
  - 提供「打印 / 导出 PDF」按钮，触发打印对话框，用户选「另存为 PDF」。

> 设计基准选 150 DPI 而非更高，是为了编辑器 DOM 不至于过大卡顿；高清版靠 `pixelRatio=2` 在导出时补足。

---

## 3. 数据自动填充

`certificate.vue` 挂载时拉取 `GET /api/tournaments/{id}/standings`（与 `result.vue` 同源），取到：

- `tournament.name` → 自动填入「赛事名称」
- `tournament.organizer` → 自动填入「主办方/落款」
- `standings[]`：`{ id, name, groupLabel, points, wins, … }`，按积分排名
  - 冠军 = `standings[0].name`，亚军 = `standings[1].name`，季军 = `standings[2].name`
  - 参赛证明：可选任一队伍
- `bestDebaters[]`：`{ name, count }`
  - 最佳辩手 = `bestDebaters[0].name`（个人）

界面提供「从赛事数据填充 ▾」：选 冠军 / 亚军 / 季军 / 最佳辩手 / 参赛队伍 → 自动写入获得者姓名 + 默认颁奖词。队徽可从 `teams.vue` 已配置的队徽中取（按 TournamentTeam 关联）。

---

## 4. 组件架构（对应要求的结构 `div > div > div > main > div > div > div`）

`certificate.vue` 根节点保持单一 `<div>`（接在 tournament 布局 `main > div > div` 之后）。内部：

```
certificate.vue (page)
├─ header：标题 + 操作（从赛事填充 / 导出 PNG / 打印PDF / 重置）
└─ grid [画布区 | 编辑面板]
   ├─ CertificateCanvas.vue      ← 缩放外壳 + 缩放滑块 + export ref
   │   └─ CertificatePaper.vue   ← 固定设计尺寸视觉（唯一来源，props: config）
   └─ CertificateEditor.vue      ← 控件（模板/尺寸/字段/样式）
       ├─ 模板选择（卡片）
       ├─ 画布尺寸预设
       ├─ 字段编辑（获得者/赛事/颁奖词/日期/落款）
       └─ 纸张样式（配色主题/边框/字体/背景/印章）
```

- `CertificatePaper.vue` 角色 = `TimerDisplay.vue`：纯视觉、固定尺寸、单来源。
- `CertificateCanvas.vue` 角色 = `TimerPreview.vue`：缩放 + 导出。
- 状态集中在 `useCertificate.ts`（reactive `config` + 导出函数）。

---

## 5. 模板与字段

**内置模板**（各自含默认内容 + 纸张配色）：
1. 冠军证书（红金官方风）
2. 亚军证书
3. 季军证书
4. 参赛证明（蓝现代风）
5. 最佳辩手（个人，紫金风）
6. 自定义（空白，用户全改）

**可编辑字段（config 模型）**：
```ts
interface CertificateConfig {
  size: 'a4-landscape' | 'a4-portrait' | 'square' | '16:9'
  template: string
  title: string            // 证书标题，如「荣誉证书」
  recipientName: string    // 获得者
  recipientType: 'team' | 'person'
  recipientLogo?: string   // 队徽 url
  tournamentName: string   // 自动
  awardText: string        // 颁奖词/事由，如「在 XX 辩论赛中获得冠军」
  date: string             // 颁发日期
  issuer: string           // 落款/主办方，自动
  style: {
    theme: 'gold' | 'blue' | 'red' | 'custom'
    border: 'classic' | 'modern' | 'none'
    font: 'serif' | 'sans' | 'kai'
    bg: string             // 背景（渐变/纯色/图）
    seal: boolean          // 印章显隐
  }
}
```

---

## 6. 导出实现

- **新增依赖**：`html-to-image`（轻量、对渐变/阴影/Web 字体支持优于 `html2canvas`）。PDF 走原生打印，无依赖。
- **PNG**：`toPng(paperEl, { pixelRatio, cacheBust: true, fontEmbedCSS })` → 触发下载。
- **PDF**：注入 `@media print` 样式，仅纸张可见、按 A4 尺寸铺满，`window.print()`。
- **字体嵌入坑**：`SourceHanSerifCN-Heavy.otf`（宋体/楷体）在 `/public`，导出前需确保已 `document.fonts.ready` 加载完成，否则 PNG 会回退到系统字体。将在导出前 `await document.fonts.ready`。

---

## 7. 视觉与主题（premium）

- 编辑面板：`backdrop-blur` 玻璃拟态，跟随现有 CSS 变量（明/暗/跟随系统）。
- 纸张本身模拟真实纸张（米白/纯白 + 柔和投影 + SVG 描金边框），**不受站点暗色主题影响**（它是真实文档）。
- 纸张配色主题：经典金 / 现代蓝 / 红头官方 / 自定义，切换有 60fps 平滑过渡。
- 印章为可定位 SVG 红色圆章；落款带签名行。
- 控件 hover 有磁吸/微交互（与项目既有风格一致）。

---

## 8. 响应式

- 宽屏：画布左、编辑面板右（grid 两列）。
- 窄屏（<1024px）：编辑面板折叠到画布下方（手风琴/分区），画布仍等比缩放填满宽度。
- 缩放引擎对容器尺寸变化实时响应（`ResizeObserver`）。

---

## 9. 技术风险与对策

| 风险 | 对策 |
|---|---|
| 预览 ≠ 导出（尺寸漂移） | 固定设计坐标 + 单一 `CertificatePaper` 来源，导出直接截该节点 |
| Web 字体未嵌入 PNG | 导出前 `await document.fonts.ready`；html-to-image 自动内联 |
| 大基准 DOM 卡顿 | 设计基准用 150 DPI；编辑态不渲染高清，仅导出时 `pixelRatio=2` |
| 暗色主题污染纸张 | 纸张强制浅色背景 + 独立作用域样式 |
| 队徽/背景跨域污染 canvas | 队徽来自同域 `/uploads`；若用外链图需 `crossOrigin` |

---

## 10. 文件清单

- 改：`app/pages/tournaments/[id]/certificate.vue`（占位 → 完整页）
- 新：`app/components/certificate/CertificateCanvas.vue`
- 新：`app/components/certificate/CertificatePaper.vue`
- 新：`app/components/certificate/CertificateEditor.vue`
- 新：`app/composables/useCertificate.ts`（状态 + 导出）
- 新：`app/utils/certificateTemplates.ts`（模板 + 尺寸预设）
- 改：`package.json`（加 `html-to-image`）+ 重新 `npm install`

---

## 11. 实施步骤（确认后执行）

1. 加依赖、建 `useCertificate` + `certificateTemplates`（尺寸/模板数据）。
2. 实现 `CertificatePaper.vue`（固定尺寸视觉 + 样式主题）。
3. 实现 `CertificateCanvas.vue`（缩放引擎 + 导出 ref + 缩放控件）。
4. 实现 `CertificateEditor.vue`（模板/尺寸/字段/样式控件 + 从赛事填充）。
5. 改写 `certificate.vue` 组装页面，接入 standings 自动填充。
6. 实现 PNG（html-to-image）/ PDF（打印）导出 + 字体就绪等待。
7. 响应式 + 主题 + 自测（`npm run dev`，核对预览=导出）。
