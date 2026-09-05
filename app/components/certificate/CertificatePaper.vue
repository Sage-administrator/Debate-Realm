<!--
  CertificatePaper.vue — 荣誉证书「纸张」视觉（唯一来源）
  - 固定设计坐标（px），由外层 CertificateCanvas 用 transform scale 缩放
  - 内部字号/间距用 calc(var(--ck) * Npx) 等比缩放，保证各尺寸预设比例一致
  - id="cert-paper"：导出时直接截取此节点 → 预览=导出
  - 纸张为真实文档外观（不受站点暗色主题影响）
-->
<template>
  <div id="cert-paper" class="cert-paper" :style="rootStyle">
    <!-- 边框层 -->
    <div
      v-if="config.style.border !== 'none'"
      class="cert-frame"
      :class="`border-${config.style.border}`"
    >
      <span v-if="config.style.border === 'classic'" class="cert-corner tl" />
      <span v-if="config.style.border === 'classic'" class="cert-corner tr" />
      <span v-if="config.style.border === 'classic'" class="cert-corner bl" />
      <span v-if="config.style.border === 'classic'" class="cert-corner br" />
    </div>

    <!-- 内容层 -->
    <div class="cert-content">
      <!-- 顶部：证书编号（左上角） -->
      <div class="cert-top">
        <span class="cert-no">证书编号：{{ config.certNo || '（编号）' }}</span>
      </div>

      <!-- 头部：标题 + 赛事名 -->
      <div class="cert-head">
        <h1 class="cert-title">{{ config.title || '荣誉证书' }}</h1>
        <div v-if="config.tournamentName" class="cert-tournament">{{ config.tournamentName }}</div>
      </div>

      <!-- 获得者 -->
      <div class="cert-recipient">
        <div v-if="showLogo" class="cert-logo">
          <img :src="config.recipientLogo" alt="队徽" />
        </div>
        <div class="cert-recipient-name">{{ config.recipientName || '（获得者姓名）' }}</div>
        <div class="cert-recipient-label">{{ recipientLabel }}</div>
      </div>

      <!-- 颁奖词 -->
      <div class="cert-award">{{ config.awardText }}</div>

      <!-- 落款行（落款在上、日期在下，统一右对齐） -->
      <div class="cert-foot">
        <div class="cert-issuer">{{ config.issuer || '（主办方）' }}</div>
        <div class="cert-date">{{ formattedDate }}</div>
        <svg
          v-if="config.style.seal"
          class="cert-seal"
          viewBox="0 0 100 100"
          :style="{ width: u(220), height: u(220) }"
          aria-hidden="true"
        >
          <circle cx="50" cy="50" r="47" :fill="palette.seal" fill-opacity="0.06" />
          <circle cx="50" cy="50" r="47" :stroke="palette.seal" stroke-width="3" fill="none" />
          <circle cx="50" cy="50" r="38" :stroke="palette.seal" stroke-width="1.5" fill="none" />
          <path
            d="M50 30 L55 45 L71 45 L58 55 L63 71 L50 61 L37 71 L42 55 L29 45 L45 45 Z"
            :fill="palette.seal"
          />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  type CertificateConfig,
  SIZE_PRESETS,
  THEME_PALETTES,
  REFERENCE_WIDTH,
  fontStack,
} from '~/utils/certificateTemplates'

const props = defineProps<{ config: CertificateConfig }>()

const base = computed(() => SIZE_PRESETS[props.config.size])
const palette = computed(() => THEME_PALETTES[props.config.style.theme] || THEME_PALETTES.gold)
const k = computed(() => base.value.width / REFERENCE_WIDTH)
// 等比系数：用于 calc(var(--ck) * Npx)
function u(px: number) {
  return `calc(var(--ck) * ${px}px)`
}

const showLogo = computed(
  () => props.config.recipientType === 'team' && !!props.config.recipientLogo,
)
const recipientLabel = computed(() =>
  props.config.recipientType === 'team' ? '参赛队伍' : '获得者',
)

const formattedDate = computed(() => {
  const d = props.config.date
  if (!d) return '（日期）'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (m) return `${m[1]} 年 ${m[2]} 月 ${m[3]} 日`
  return d
})

const rootStyle = computed<Record<string, string>>(() => {
  const p = palette.value
  const bg = props.config.style.theme === 'custom' ? props.config.style.bg || '#ffffff' : p.paperBg
  return {
    width: `${base.value.width}px`,
    height: `${base.value.height}px`,
    '--ck': k.value.toString(),
    '--frame': p.frame,
    '--frame-accent': p.frameAccent,
    '--ink': p.ink,
    '--sub-ink': p.subInk,
    '--seal': p.seal,
    '--font': fontStack(props.config.style.font),
    background: bg,
    color: p.ink,
    fontFamily: fontStack(props.config.style.font),
  } as Record<string, string>
})
</script>

<style scoped>
.cert-paper {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  user-select: none;
}

/* ════════ 边框 ════════ */
.cert-frame {
  position: absolute;
  pointer-events: none;
}
.border-classic {
  inset: calc(var(--ck) * 36px);
  border: calc(var(--ck) * 3px) solid var(--frame);
}
.border-classic::before {
  content: '';
  position: absolute;
  inset: calc(var(--ck) * 14px);
  border: calc(var(--ck) * 1.5px) solid var(--frame-accent);
}
.border-modern {
  inset: calc(var(--ck) * 40px);
  border: calc(var(--ck) * 2px) solid var(--frame);
}
.cert-corner {
  position: absolute;
  width: calc(var(--ck) * 18px);
  height: calc(var(--ck) * 18px);
  background: var(--frame-accent);
  transform: rotate(45deg);
}
.cert-corner.tl {
  top: calc(var(--ck) * -9px);
  left: calc(var(--ck) * -9px);
}
.cert-corner.tr {
  top: calc(var(--ck) * -9px);
  right: calc(var(--ck) * -9px);
}
.cert-corner.bl {
  bottom: calc(var(--ck) * -9px);
  left: calc(var(--ck) * -9px);
}
.cert-corner.br {
  bottom: calc(var(--ck) * -9px);
  right: calc(var(--ck) * -9px);
}

/* ════════ 内容层 ════════ */
.cert-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: calc(var(--ck) * 120px) calc(var(--ck) * 110px) calc(var(--ck) * 120px);
  box-sizing: border-box;
}

/* 头部 */
.cert-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--ck) * 18px);
}
/* 顶部：证书编号（左上角，独立于居中的标题块） */
.cert-top {
  align-self: stretch;
  text-align: left;
  margin-bottom: calc(var(--ck) * 22px);
}
.cert-no {
  font-size: calc(var(--ck) * 34px);
  color: var(--sub-ink);
  letter-spacing: calc(var(--ck) * 2px);
}
.cert-title {
  margin: 0;
  font-size: calc(var(--ck) * 120px);
  font-weight: 800;
  letter-spacing: calc(var(--ck) * 18px);
  color: var(--ink);
  line-height: 1.1;
}
.cert-tournament {
  font-size: calc(var(--ck) * 46px);
  color: var(--sub-ink);
  letter-spacing: calc(var(--ck) * 4px);
}

/* 获得者 */
.cert-recipient {
  margin-top: calc(var(--ck) * 70px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--ck) * 14px);
}
.cert-logo {
  width: calc(var(--ck) * 130px);
  height: calc(var(--ck) * 130px);
  border-radius: 50%;
  overflow: hidden;
  border: calc(var(--ck) * 3px) solid var(--frame-accent);
  background: rgba(255, 255, 255, 0.6);
}
.cert-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cert-recipient-name {
  font-size: calc(var(--ck) * 150px);
  font-weight: 800;
  color: var(--ink);
  line-height: 1.15;
  padding-bottom: calc(var(--ck) * 10px);
  border-bottom: calc(var(--ck) * 4px) solid var(--frame);
  max-width: calc(var(--ck) * 1300px);
  word-break: break-word;
}
.cert-recipient-label {
  font-size: calc(var(--ck) * 40px);
  color: var(--sub-ink);
  letter-spacing: calc(var(--ck) * 6px);
}

/* 颁奖词 */
.cert-award {
  margin-top: calc(var(--ck) * 60px);
  font-size: calc(var(--ck) * 54px);
  line-height: 1.7;
  color: var(--sub-ink);
  max-width: calc(var(--ck) * 1300px);
  word-break: break-word;
}

/* 落款行（落款在上、日期在下，统一右对齐） */
.cert-foot {
  position: relative;
  margin-top: auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  gap: calc(var(--ck) * 18px);
  padding: 0 calc(var(--ck) * 40px);
}
.cert-issuer {
  font-size: calc(var(--ck) * 44px);
  font-weight: 700;
  color: var(--ink);
  text-align: right;
}
.cert-date {
  font-size: calc(var(--ck) * 40px);
  color: var(--ink); /* 与落款同色 */
}
.cert-seal {
  position: absolute;
  right: calc(var(--ck) * -20px);
  bottom: calc(var(--ck) * -30px);
  transform: rotate(-14deg);
  pointer-events: none;
}
</style>
