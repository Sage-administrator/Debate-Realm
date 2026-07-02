<script setup lang="ts">
// 赛制级联选择器（替代原生 select，统一 UI 风格）
// 结构：一级 = 赛制大类；二级 = 该大类下的具体赛制
// 某些大类没有二级（如"手动录入赛程""佩寄制""瑞士制""小组+淘汰赛制"），选中一级即完成

// ── 外部传入/回写 ──
const props = defineProps<{
  // 一级赛制（大类）
  primary: string
  // 二级赛制（具体子类型，可为空）
  secondary: string
}>()

const emit = defineEmits<{
  (e: 'update:primary', v: string): void
  (e: 'update:secondary', v: string): void
}>()

// ── 赛制数据定义 ──
// 值说明：
//   - manual          : 手动录入赛程（无二级）
//   - knockout        : 淘汰制（二级: single / double）
//   - round_robin     : 循环赛（二级: single / double）
//   - page            : 佩寄制（无二级）
//   - swiss           : 瑞士制（无二级）
//   - group_knockout  : 小组+淘汰赛制（无二级）

interface FormatOption {
  value: string
  label: string
  children?: { value: string; label: string }[]
}

const formatOptions: FormatOption[] = [
  { value: 'manual', label: '手动录入赛程' },
  {
    value: 'knockout',
    label: '淘汰制',
    children: [
      { value: 'single', label: '单败' },
      { value: 'double', label: '双败' },
    ],
  },
  {
    value: 'round_robin',
    label: '循环制',
    children: [
      { value: 'single', label: '单循环' },
      { value: 'double', label: '双循环' },
    ],
  },
  { value: 'page', label: '佩寄制' },
  { value: 'swiss', label: '瑞士制' },
  { value: 'group_knockout', label: '小组+淘汰赛制' },
]

// ── UI 状态 ──
const open = ref(false) // 面板是否打开
const step = ref<'primary' | 'secondary'>('primary') // 当前面板
const triggerEl = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

// ── 计算属性 ──
const currentChildren = computed(() => {
  if (!props.primary) return []
  const g = formatOptions.find((x) => x.value === props.primary)
  return g?.children ?? []
})

const hasChildren = computed(() => {
  const g = formatOptions.find((x) => x.value === props.primary)
  return !!(g?.children && g.children.length > 0)
})

// 显示文本
const displayText = computed(() => {
  if (!props.primary) return '请选择赛制'
  const g = formatOptions.find((x) => x.value === props.primary)
  if (!g) return '请选择赛制'
  if (g.children && g.children.length > 0) {
    if (!props.secondary) return g.label
    const c = g.children.find((x) => x.value === props.secondary)
    return `${g.label} / ${c?.label ?? ''}`
  }
  return g.label
})

const hasValue = computed(() => {
  if (!props.primary) return false
  const g = formatOptions.find((x) => x.value === props.primary)
  if (!g) return false
  // 有二级：必须同时有二级才认为有值
  if (g.children && g.children.length > 0) return !!props.secondary
  // 没有二级：选中一级即可
  return true
})

// 面包屑文本
const primaryLabel = computed(() => formatOptions.find((x) => x.value === props.primary)?.label ?? '请选择赛制')
const secondaryLabel = computed(() => currentChildren.value.find((x) => x.value === props.secondary)?.label ?? '请选择')

// ── 面板定位 ──
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

function openDropdown() {
  open.value = !open.value
  if (open.value) {
    step.value = 'primary'
    nextTick(() => updatePanelPosition())
  }
}

function pickPrimary(v: string) {
  emit('update:primary', v)
  emit('update:secondary', '')
  const g = formatOptions.find((x) => x.value === v)
  if (g?.children && g.children.length > 0) {
    step.value = 'secondary' // 有二级，进入二级
  } else {
    open.value = false // 无二级，选中即完成
  }
}

function pickSecondary(v: string) {
  emit('update:secondary', v)
  open.value = false
}

function backToPrimary() {
  step.value = 'primary'
}

// ── 点击外部关闭 ──
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (triggerEl.value && triggerEl.value.contains(target)) return
  open.value = false
}

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
  <div class="format-cascader">
    <!-- 触发按钮 -->
    <div
      ref="triggerEl"
      class="cascader-trigger"
      @click.stop="openDropdown"
      :class="{ 'is-active': open, 'has-value': hasValue }"
    >
      <span class="cascader-text" :class="hasValue ? 'text-white/80' : 'text-white/40'">
        {{ displayText }}
      </span>
      <UIcon name="i-lucide-chevron-down" class="cascader-icon" :class="{ 'is-open': open }" />
    </div>

    <!-- 下拉面板 -->
    <Teleport to="body">
      <div v-if="open" class="cascader-panel" :style="panelStyle" @click.stop>
        <!-- 选项列表 -->
        <div class="cascader-list">
          <!-- 一级 -->
          <div v-if="step === 'primary'" class="cascader-list-inner">
            <div
              v-for="o in formatOptions"
              :key="o.value"
              class="cascader-option"
              :class="{ 'is-selected': o.value === primary }"
              @click.stop="pickPrimary(o.value)"
            >
              <span>{{ o.label }}</span>
              <UIcon v-if="o.children && o.children.length > 0" name="i-lucide-chevron-right" class="cascader-arrow" />
            </div>
          </div>
          <!-- 二级 -->
          <div v-else class="cascader-list-inner">
            <div
              class="cascader-option cascader-option-back"
              @click.stop="backToPrimary"
            >
              <UIcon name="i-lucide-chevron-left" class="cascader-arrow" />
              <span>返回 {{ primaryLabel }}</span>
            </div>
            <div
              v-for="c in currentChildren"
              :key="c.value"
              class="cascader-option"
              :class="{ 'is-selected': c.value === secondary }"
              @click.stop="pickSecondary(c.value)"
            >
              <span>{{ c.label }}</span>
            </div>
            <div v-if="!currentChildren.length" class="cascader-empty">暂无数据</div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── 触发按钮 ── */
.format-cascader {
  position: relative;
  display: inline-block;
  width: 100%;
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
  width: 100%;
  box-sizing: border-box;
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
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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
  max-height: 320px;
  background: rgba(30, 30, 62, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.2);
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
