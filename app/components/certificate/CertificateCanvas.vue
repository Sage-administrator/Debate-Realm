<!--
  CertificateCanvas.vue — 画布缩放外壳
  - ResizeObserver 测量舞台尺寸，fitScale = min(availW/baseW, availH/baseH)
  - 最终 scale = fitScale × zoom；纸张 transform: scale() 等比缩放
  - 内部纸张节点即 CertificatePaper（固定设计尺寸，单来源）
  - 工具栏：缩放滑块 + 百分比 + 适应屏幕 / 实际大小
-->
<template>
  <div class="cert-canvas">
    <!-- 顶部横向缩放工具条（与工作台标题栏同语言，替代原悬浮竖条） -->
    <div class="cert-canvas-bar">
      <button class="cz-btn" title="缩小" @click="zoomBy(-0.1)">−</button>
      <input class="cz-range" type="range" min="0.5" max="2" step="0.05" v-model.number="zoom" />
      <span class="cz-pct">{{ Math.round(scale * 100) }}%</span>
      <span class="cz-sep" />
      <button class="cz-btn cz-text" @click="fit">适应</button>
      <button class="cz-btn cz-text" @click="actual">实际大小</button>
    </div>

    <div ref="containerRef" class="cert-canvas-stage">
      <div class="cert-slot" :style="{ width: slotW, height: slotH }">
        <div
          class="cert-paper-wrapper"
          :style="{
            width: `${base.width}px`,
            height: `${base.height}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }"
        >
          <CertificatePaper :config="config" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import CertificatePaper from './CertificatePaper.vue'
import { type CertificateConfig, SIZE_PRESETS } from '~/utils/certificateTemplates'

const props = defineProps<{ config: CertificateConfig }>()

const containerRef = ref<HTMLElement | null>(null)
const zoom = ref(1)
const fitScale = ref(1)

const base = computed(() => SIZE_PRESETS[props.config.size])
const scale = computed(() => fitScale.value * zoom.value)
const slotW = computed(() => `${base.value.width * scale.value}px`)
const slotH = computed(() => `${base.value.height * scale.value}px`)

function recalc() {
  const el = containerRef.value
  if (!el) return
  const pad = 24
  const availW = el.clientWidth - pad * 2
  const availH = el.clientHeight - pad * 2
  if (availW <= 0 || availH <= 0) return
  fitScale.value = Math.min(availW / base.value.width, availH / base.value.height)
}

let ro: ResizeObserver | undefined
onMounted(() => {
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(recalc)
    ro.observe(containerRef.value)
  }
  recalc()
})
onBeforeUnmount(() => ro?.disconnect())

watch(
  () => props.config.size,
  () => {
    zoom.value = 1
    recalc()
  },
)

function fit() {
  zoom.value = 1
}
function actual() {
  zoom.value = 1 / Math.max(fitScale.value, 0.0001)
}
function zoomBy(d: number) {
  zoom.value = Math.min(2, Math.max(0.5, +(zoom.value + d).toFixed(2)))
}
</script>

<style scoped>
.cert-canvas {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--color-border); /* 与编辑面板之间的分隔，强化一体化 */
}
/* 顶部横向缩放工具条 */
.cert-canvas-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  flex: none;
}
.cz-sep {
  width: 1px;
  align-self: stretch;
  margin: 2px 2px;
  background: var(--color-border);
}
.cert-canvas-stage {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 1px 1px, rgba(127, 127, 127, 0.18) 1px, transparent 0) 0 0 / 22px 22px,
    var(--color-bg-secondary);
  overflow: hidden;
}
.cert-slot {
  position: relative;
}
.cert-paper-wrapper {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
  border-radius: 4px;
}

/* 缩放控件（横向排布，与工作台语言一致） */
.cz-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.18s ease;
}
.cz-btn:hover {
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}
.cz-text {
  width: auto;
  justify-content: center;
  white-space: nowrap;
  padding: 0 10px;
  font-size: 13px;
}
.cz-range {
  flex: 1 1 auto;
  min-width: 80px;
  accent-color: var(--color-accent-primary);
  cursor: pointer;
}
.cz-pct {
  min-width: 44px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
