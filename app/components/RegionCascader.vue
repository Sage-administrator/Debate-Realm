<script setup lang="ts">
// 省市级联选择器
import { cityData } from '~~/app/data/cities'
import type { CityGroup } from '~~/app/data/cities'

// ── 外部传入/回写 ──
const props = defineProps<{
  province: string   // 选中的省份名称
  city: string       // 选中的城市名称（无二级时为空）
}>()

const emit = defineEmits<{
  // 省份变化时回写父组件
  (e: 'update:province', v: string): void
  // 城市变化时回写父组件
  (e: 'update:city', v: string): void
}>()

// ── UI 状态 ──
const open = ref(false) // 弹窗是否打开
const step = ref<'province' | 'city'>('province') // 当前面板：省份/城市
const triggerEl = ref<HTMLElement | null>(null) // 触发按钮元素
const panelStyle = ref<Record<string, string>>({}) // 面板动态定位

// ── 数据 ──
// 当前选中省份对应的城市列表
const cityList = computed(() => {
  const g = cityData.find((x: CityGroup) => x.province === props.province)
  return g?.cities ?? []
})

// 当前省份是否有二级（用于控制箭头、是否进入二级）
const hasChildren = computed(() => {
  const g = cityData.find((x: CityGroup) => x.province === props.province)
  return !!(g?.cities && g.cities.length > 0)
})

// 指定省份是否有二级（用于一级列表渲染箭头）
function groupHasChildren(provinceName: string): boolean {
  const g = cityData.find((x: CityGroup) => x.province === provinceName)
  return !!(g?.cities && g.cities.length > 0)
}

// ── 显示文本 ──
const displayText = computed(() => {
  if (!props.province) return '请选择省份 / 城市'
  const g = cityData.find((x: CityGroup) => x.province === props.province)
  const hasCities = !!(g?.cities && g.cities.length > 0)
  // 有二级的：展示"省 / 市"；无二级的（线上、直辖市）：直接显示省名
  if (hasCities) {
    if (props.city) return `${props.province} / ${props.city}`
    return props.province
  }
  return props.province
})

// 判断当前是否已选中有效值（用于触发按钮高亮）
const hasValue = computed(() => {
  if (!props.province) return false
  // 有二级的必须已选城市；无二级的有省份即可
  return hasChildren.value ? !!props.city : true
})

// ── 计算面板绝对位置（相对于 viewport） ──
function updatePanelPosition() {
  if (!triggerEl.value) return
  const rect = triggerEl.value.getBoundingClientRect()
  panelStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    minWidth: `${Math.max(rect.width, 240)}px`,
    maxWidth: `${Math.max(rect.width, 320)}px`,
    zIndex: '9999',
  }
}

// ── 打开下拉 ──
function openDropdown() {
  open.value = !open.value
  if (open.value) {
    step.value = 'province'
    // 下一帧再更新位置，确保 DOM 已存在
    nextTick(() => {
      updatePanelPosition()
    })
  }
}

// ── 选择省份 ──
function pickProvince(p: string) {
  emit('update:province', p)
  emit('update:city', '') // 切换省份时清空城市
  // 如果该省份有城市才进入二级；没有二级的（线上、直辖市）选中即完成
  const hasCities = groupHasChildren(p)
  if (hasCities) {
    step.value = 'city'
  } else {
    open.value = false
  }
}

// ── 选择城市 ──
function pickCity(c: string) {
  emit('update:city', c)
  open.value = false // 选完即关闭
}

// ── 回退到省份选择 ──
function backToProvince() {
  step.value = 'province'
}

// ── 点击外部关闭 ──
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  // 点击触发按钮本身不关闭（由 openDropdown 的 !open.value 处理）
  if (triggerEl.value && triggerEl.value.contains(target)) return
  open.value = false
}

// 页面挂载/卸载时注册全局点击
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', updatePanelPosition)
  window.addEventListener('scroll', updatePanelPosition, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', updatePanelPosition)
  window.removeEventListener('scroll', updatePanelPosition, true)
})
</script>

<template>
  <div class="region-cascader">
    <!-- 选择器触发按钮 -->
    <div
      ref="triggerEl"
      class="cascader-trigger"
      @click.stop="openDropdown"
      :class="{ 'is-active': open, 'has-value': hasValue }"
    >
      <span class="cascader-text" :class="hasValue ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'">
        {{ displayText }}
      </span>
      <UIcon name="i-lucide-chevron-down" class="cascader-icon" :class="{ 'is-open': open }" />
    </div>

    <!-- 下拉面板（使用 teleport + getBoundingClientRect 动态定位） -->
    <Teleport to="body">
      <div
        v-if="open"
        class="cascader-panel"
        :style="panelStyle"
        @click.stop
      >
        <!-- 选项列表 -->
        <div class="cascader-list">
          <!-- 省份列表 -->
          <div v-if="step === 'province'" class="cascader-list-inner">
            <div
              v-for="g in cityData"
              :key="g.province"
              class="cascader-option"
              :class="{ 'is-selected': g.province === province }"
              @click.stop="pickProvince(g.province)"
            >
              <span>{{ g.province }}</span>
              <UIcon
                v-if="g.cities && g.cities.length > 0"
                name="i-lucide-chevron-right"
                class="cascader-arrow"
              />
            </div>
          </div>
          <!-- 城市列表 -->
          <div v-else class="cascader-list-inner">
            <div
              class="cascader-option cascader-option-back"
              @click.stop="backToProvince"
            >
              <UIcon name="i-lucide-chevron-left" class="cascader-arrow" />
              <span>返回 {{ province }}</span>
            </div>
            <div
              v-for="c in cityList"
              :key="c"
              class="cascader-option"
              :class="{ 'is-selected': c === city }"
              @click.stop="pickCity(c)"
            >
              <span>{{ c }}</span>
            </div>
            <div v-if="!cityList.length" class="cascader-empty">暂无城市数据</div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── 触发按钮（与项目中 select 保持同款视觉） ── */
.region-cascader {
  position: relative;
  display: inline-block;
}

.cascader-trigger {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  background: rgba(255,255,255,0.08);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  min-width: 220px;
}

.cascader-trigger:hover {
  border-color: rgba(255,255,255,0.25);
}

.cascader-trigger.is-active {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.cascader-trigger.has-value {
  border-color: #10b981;
}

.cascader-text {
  flex: 1;
  font-size: 14px;
  text-align: left;
  user-select: none;
  padding-right: 8px;
}

.cascader-icon {
  width: 16px;
  height: 16px;
  color: rgba(255,255,255,0.4);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.cascader-icon.is-open {
  transform: rotate(180deg);
  color: #10b981;
}

/* ── 下拉面板 ── */
.cascader-panel {
  position: absolute;
  left: 0;
  top: calc(100% + 4px);
  min-width: 240px;
  max-height: 320px;
  background: rgba(30, 30, 62, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.2);
  z-index: 100;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: cascader-fade-in 0.12s ease;
}

@keyframes cascader-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── 面包屑 ── */
.cascader-breadcrumb {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  flex-wrap: wrap;
}

.crumb {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.15s ease, color 0.15s ease;
  color: rgba(255,255,255,0.5);
}

.crumb:hover {
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7);
}

.crumb.is-active {
  color: #059669;
  font-weight: 500;
}

.crumb.is-placeholder {
  color: rgba(255,255,255,0.4);
  font-weight: normal;
}

.crumb-sep {
  margin: 0 4px;
  color: rgba(255,255,255,0.15);
}

/* ── 选项列表 ── */
.cascader-list {
  overflow-y: auto;
  flex: 1;
}

.cascader-list-inner {
  padding: 4px;
  max-height: 260px;
  overflow-y: auto;
}

/* 自定义滚动条 */
.cascader-list-inner::-webkit-scrollbar {
  width: 6px;
}
.cascader-list-inner::-webkit-scrollbar-track {
  background: transparent;
}
.cascader-list-inner::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.15);
  border-radius: 3px;
}
.cascader-list-inner::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.25);
}

.cascader-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 14px;
  color: rgba(255,255,255,0.7);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.cascader-option:hover {
  background: rgba(16, 185, 129, 0.08);
  color: #059669;
}

.cascader-option.is-selected {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  font-weight: 500;
}

.cascader-arrow {
  width: 14px;
  height: 14px;
  color: rgba(255,255,255,0.4);
  margin-left: 8px;
  flex-shrink: 0;
}

.cascader-option:hover .cascader-arrow {
  color: #059669;
}

/* 返回一级的选项样式：更紧凑，左箭头与文字靠左 */
.cascader-option-back {
  justify-content: flex-start;
  gap: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding: 6px 12px;
  font-size: 13px;
  color: rgba(255,255,255,0.5);
}

.cascader-option-back:hover {
  color: #059669;
  background: rgba(16, 185, 129, 0.08);
}

.cascader-option-back .cascader-arrow {
  margin-left: 0;
  width: 12px;
  height: 12px;
}

.cascader-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: rgba(255,255,255,0.4);
}
</style>
