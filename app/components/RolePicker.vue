<script setup lang="ts">
// 角色选择器 - 双级联选择：正方/反方 + 辩手位
// modelValue: 选中的辩手值（正常模式=发言方；反向模式=被排除的辩手）
// modelMode: 0=正常模式 1=反向模式
import { formatSpeakerDisplay, formatReverseDisplay } from '~/utils/speakerSide'

interface Props {
  modelValue?: string | string[]
  modelMode?: number // 0=正常 1=反向
  placeholder?: string
  multiple?: boolean
  debaters?: { label: string; value: string }[]
  reverse?: boolean // 能力开关：下拉提供「正常/反向」切换
  side?: 'positive' | 'negative'
}

const props = withDefaults(defineProps<Props>(), {
  modelMode: 0,
  placeholder: '请选择',
  multiple: undefined,
  debaters: () => [
    { label: '一辩', value: 'de1' },
    { label: '二辩', value: 'de2' },
    { label: '三辩', value: 'de3' },
    { label: '四辩', value: 'de4' },
    { label: '全体', value: 'all' },
  ],
})

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
  'update:mode': [value: number]
}>()

// 阵营
const sides = [
  { label: '正方', value: 'positive' },
  { label: '反方', value: 'negative' },
]

// 是否常规多选模式（按 prop 或 modelValue 类型推断）
const isMultiple = computed(() => props.multiple ?? Array.isArray(props.modelValue))

// 当前是否处于反向模式
const isReverse = ref(props.modelMode === 1)

// 是否支持反向模式切换（显式开启 reverse 能力的字段）
const reverseCapable = computed(() => !!props.reverse)

// 反向模式复用多选勾选 UI
const useCheckUI = computed(() => isMultiple.value || isReverse.value)

// 反向模式下不提供"全体"，仅保留具体辩手位
const visibleDebaters = computed(() => props.debaters)

// 是否有选定值（用于触发器样式）
const hasModelValue = computed(() => {
  const v = props.modelValue
  if (Array.isArray(v)) return v.length > 0
  return !!v
})

// 阵营锁定：设定后仅显示该阵营，左侧阵营栏隐藏，选中阵营固定为该值
const isSideLocked = computed(() => !!props.side)
const effectiveSides = computed(() =>
  isSideLocked.value ? sides.filter((s) => s.value === props.side) : sides,
)
const lockedSideLabel = computed(() => sides.find((s) => s.value === props.side)?.label || '')

// 当前选中的阵营
const selectedSide = ref<string>('positive')

// 单选：当前选中的辩手
const selectedDebater = ref<string>('de1')

// 多选：每个阵营的已选辩手 Set（用对象+数组模拟，Vue 3 Set 响应式需重新赋值）
const multiSelected = ref<Record<string, string[]>>({
  positive: [],
  negative: [],
})

// ponytail: 使用共享的 useDropdown composable
const { isOpen, dropdownStyle, triggerRef, open, close } = useDropdown({
  minWidth: 320,
  offsetY: 4,
  dropdownClass: 'role-picker-dropdown-global',
})

// 解析单个值 "正方·一辩" → { side, debater }
function parseValue(value: string): { side: string; debater: string } | null {
  if (!value) return null
  for (const s of sides) {
    if (value.startsWith(s.label)) {
      const rest = value.replace(s.label, '').replace(/[·\/\s\-]/g, '')
      for (const d of props.debaters) {
        if (rest.includes(d.label)) {
          return { side: s.value, debater: d.value }
        }
      }
      return { side: s.value, debater: 'de1' }
    }
  }
  return null
}

// 多选显示：按阵营分组，辩手位用 "/" 连接
// 如 ["正方·一辩","正方·二辩","反方·三辩"] → "正方 · 一/二辩 反方 · 三辩"；某方全选 → "正方 · 全体"
function formatMultiDisplay(arr: string[]): string {
  const bySide: Record<string, string[]> = {}
  for (const v of arr) {
    const p = parseValue(v)
    if (!p) continue
    const sideLabel = sides.find((s) => s.value === p.side)?.label || ''
    const debaterLabel = props.debaters.find((d) => d.value === p.debater)?.label || ''
    if (!bySide[sideLabel]) bySide[sideLabel] = []
    if (debaterLabel) bySide[sideLabel].push(debaterLabel)
  }
  const allDebaters = props.debaters.filter((d) => d.value !== 'all').map((d) => d.label)
  const parts: string[] = []
  for (const sideLabel of Object.keys(bySide)) {
    const labels = bySide[sideLabel] || []
    const isAll = allDebaters.length > 0 && allDebaters.every((l) => labels.includes(l))
    const text = isAll ? '全体' : labels.join('/')
    parts.push(`${sideLabel} · ${text}`)
  }
  return parts.join(' ')
}

// 获取显示文本
function getDisplayText(): string {
  const v = props.modelValue
  const mode = props.modelMode
  // 反向模式：使用反向格式显示
  if (mode === 1) {
    if (Array.isArray(v)) return formatReverseDisplay(v.join('、'))
    if (typeof v === 'string' && v) return formatReverseDisplay(v)
    return props.placeholder
  }
  // 正常模式
  if (Array.isArray(v)) {
    if (!v.length) return props.placeholder
    if (v.length === 1) return formatSpeakerDisplay(v[0]!, 0)
    return formatMultiDisplay(v)
  }
  if (typeof v === 'string') {
    if (!v) return props.placeholder
    if (/[、，/]/.test(v)) {
      return formatMultiDisplay(
        v
          .split(/[、，/]/)
          .map((s) => s.trim())
          .filter(Boolean),
      )
    }
    return formatSpeakerDisplay(v, 0)
  }
  return props.placeholder
}

// 格式化单个值用于显示
function formatSingle(value: string): string {
  const parsed = parseValue(value)
  if (!parsed) return value
  const sideLabel = sides.find((s) => s.value === parsed.side)?.label || ''
  const debaterLabel = props.debaters.find((d) => d.value === parsed.debater)?.label || ''
  return `${sideLabel} · ${debaterLabel}`
}

// 组装单条值
function buildValue(side: string, debater: string, reverse = false): string {
  const sideLabel = sides.find((s) => s.value === side)?.label || ''
  const debaterLabel = props.debaters.find((d) => d.value === debater)?.label || ''
  return reverse ? `${sideLabel}·除${debaterLabel}外` : `${sideLabel}·${debaterLabel}`
}

// 触发器点击
function onTriggerClick() {
  if (isOpen.value) {
    close()
    return
  }
  // 打开前同步当前值
  if (isSideLocked.value) selectedSide.value = props.side!
  syncFromModel()
  open()
}

// 把一组角色值填充到 multiSelected（按阵营分组）
function fillMultiFromArray(arr: string[]) {
  const pos: string[] = []
  const neg: string[] = []
  for (const v of arr) {
    const parsed = parseValue(v)
    if (parsed) {
      // "全体" 展开为具体辩手
      if (parsed.debater === 'all') {
        for (const d of props.debaters) {
          if (d.value !== 'all') {
            if (parsed.side === 'positive') pos.push(d.value)
            else neg.push(d.value)
          }
        }
      } else {
        if (parsed.side === 'positive') pos.push(parsed.debater)
        else neg.push(parsed.debater)
      }
    }
  }
  multiSelected.value = { positive: pos, negative: neg }
}

// 从 modelValue 同步内部状态
function syncFromModel() {
  const raw = props.modelValue
  const mode = props.modelMode
  // 反向模式：选中的是被排除的辩手
  if (mode === 1) {
    isReverse.value = true
    const items = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? raw
            .split(/[、，/]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    fillMultiFromArray(items)
    return
  }
  // 正常模式
  isReverse.value = false
  if (isMultiple.value) {
    if (typeof raw === 'string' && raw) {
      fillMultiFromArray(
        raw
          .split(/[、，/]/)
          .map((s) => s.trim())
          .filter(Boolean),
      )
      return
    }
    fillMultiFromArray(Array.isArray(raw) ? raw : [])
    return
  }
  // 单值模式
  multiSelected.value = { positive: [], negative: [] }
  if (typeof raw === 'string' && raw) {
    const parsed = parseValue(raw)
    if (parsed) {
      selectedSide.value = parsed.side
      selectedDebater.value = parsed.debater
    }
  }
  if (isSideLocked.value) selectedSide.value = props.side!
}

// 切换「正常 / 排除」模式：清空内部选择，避免跨模式脏数据
function setMode(reverse: boolean) {
  // 反向与全体互斥：开启反向时若选中了全体则切回正常
  if (reverse) {
    const allDebaters = props.debaters.filter((d) => d.value !== 'all').map((d) => d.value)
    const list = multiSelected.value[selectedSide.value] || []
    if (allDebaters.every((d) => list.includes(d))) return
  }
  isReverse.value = reverse
}

// 选择阵营（阵营锁定时禁止切换）
function selectSide(value: string) {
  if (isSideLocked.value) return
  selectedSide.value = value
}

// 辩手项点击：勾选 UI（多选 / 反向排除）toggle，否则单选直接确认
function onDebaterClick(value: string) {
  if (useCheckUI.value) {
    toggleDebaterMulti(value)
  } else {
    selectDebaterSingle(value)
  }
}

// 单选：组装值并回写，关闭下拉
function selectDebaterSingle(value: string) {
  selectedDebater.value = value
  emit('update:modelValue', buildValue(selectedSide.value, value, isReverse.value))
  close()
}

// 多选：toggle 某个辩手的选中状态
function toggleDebaterMulti(value: string) {
  const list = multiSelected.value[selectedSide.value] || []
  if (value === 'all') {
    // "全体"：切换全部具体辩手，同时关闭反向模式（互斥）
    const allDebaters = props.debaters.filter((d) => d.value !== 'all').map((d) => d.value)
    const allSelected = allDebaters.every((d) => list.includes(d))
    multiSelected.value = {
      ...multiSelected.value,
      [selectedSide.value]: allSelected ? [] : allDebaters,
    }
    if (!allSelected) isReverse.value = false
  } else {
    const idx = list.indexOf(value)
    if (idx >= 0) {
      list.splice(idx, 1)
    } else {
      list.push(value)
    }
    multiSelected.value = { ...multiSelected.value }
  }
}

// 多选 / 反向排除：某辩手是否选中
function isDebaterSelected(value: string): boolean {
  if (!useCheckUI.value) return selectedDebater.value === value
  const list = multiSelected.value[selectedSide.value] || []
  if (value === 'all') {
    const allDebaters = props.debaters.filter((d) => d.value !== 'all').map((d) => d.value)
    return allDebaters.every((d) => list.includes(d))
  }
  return list.includes(value)
}

// 多选 / 反向排除：确认按钮
function confirmMulti() {
  if (isReverse.value) {
    // 反向模式：emit 选中的辩手值（被排除的）+ mode=1
    const excluded = multiSelected.value[selectedSide.value] || []
    const side = selectedSide.value as 'positive' | 'negative'
    const sideLabel = side === 'positive' ? '正方' : '反方'
    const values = excluded.map((v) => {
      const label = props.debaters.find((d) => d.value === v)?.label || ''
      return `${sideLabel}·${label}`
    })
    emit('update:modelValue', values.join('、'))
    emit('update:mode', 1)
    nextTick(() => close())
    return
  }
  // 正常模式
  const parts: string[] = []
  for (const s of effectiveSides.value) {
    const list = multiSelected.value[s.value] || []
    for (const d of props.debaters) {
      if (d.value !== 'all' && list.includes(d.value)) {
        parts.push(buildValue(s.value, d.value))
      }
    }
  }
  const expectsArray = Array.isArray(props.modelValue)
  emit('update:modelValue', expectsArray ? parts : parts.join('、'))
  emit('update:mode', 0)
  nextTick(() => close())
}
</script>

<template>
  <div class="role-picker-wrap">
    <!-- 触发器 -->
    <div
      ref="triggerRef"
      class="role-picker-trigger"
      @click="onTriggerClick"
      :class="{ 'role-picker-trigger--open': isOpen }"
    >
      <span :class="hasModelValue ? 'role-picker-value' : 'role-picker-placeholder'">
        {{ getDisplayText() }}
      </span>
      <UIcon
        name="i-lucide-chevron-down"
        class="role-picker-chevron"
        :class="{ 'role-picker-chevron--rotate': isOpen }"
      />
    </div>

    <!-- 双栏下拉 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isOpen"
          class="role-picker-dropdown role-picker-dropdown-global"
          :style="dropdownStyle"
          @click.stop
        >
          <div class="role-picker-cols">
            <!-- 左栏：阵营（阵营锁定模式隐藏） -->
            <div v-if="!isSideLocked" class="role-picker-left">
              <div
                v-for="s in sides"
                :key="s.value"
                class="role-picker-side"
                :class="{ 'role-picker-side--active': selectedSide === s.value }"
                @click="selectSide(s.value)"
              >
                <span>{{ s.label }}</span>
                <UIcon
                  v-if="selectedSide === s.value"
                  name="i-lucide-chevron-right"
                  class="role-picker-chevron-right"
                />
              </div>
            </div>

            <!-- 右栏：辩手 -->
            <div class="role-picker-right">
              <!-- 阵营锁定：固定阵营标题（不可切换） -->
              <div v-if="isSideLocked" class="role-picker-locked-side">
                {{ lockedSideLabel }}
              </div>

              <div
                v-for="d in visibleDebaters"
                :key="d.value"
                class="role-picker-item"
                :class="{ 'role-picker-item--active': isDebaterSelected(d.value) }"
                @click="onDebaterClick(d.value)"
              >
                <!-- 多选 / 反向排除：显示勾选框 -->
                <template v-if="useCheckUI">
                  <span
                    class="role-picker-check"
                    :class="{ 'role-picker-check--checked': isDebaterSelected(d.value) }"
                  >
                    <UIcon
                      v-if="isDebaterSelected(d.value)"
                      name="i-lucide-check"
                      class="w-3 h-3"
                    />
                  </span>
                  <span>{{ d.label }}</span>
                </template>
                <template v-else>
                  <span>{{ d.label }}</span>
                </template>
              </div>

              <!-- 多选：反向勾选框 + 确定按钮 -->
              <div v-if="useCheckUI" class="role-picker-confirm-bar">
                <label
                  v-if="reverseCapable"
                  class="role-picker-reverse-check"
                  title="仅改变展示方式。例：选中一辩、二辩、四辩 → 展示为「除三辩外任意辩手」，但实际发言方仍是一辩、二辩、四辩。"
                >
                  <input type="checkbox" :checked="isReverse" @change="setMode(!isReverse)" />
                  <span>反向显示</span>
                </label>
                <button class="role-picker-confirm-btn" @click.stop="confirmMulti">确定</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.role-picker-wrap {
  position: relative;
  width: 100%;
}

.role-picker-trigger {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  font-size: 16px;
  text-align: left;
  border: 1px solid var(--rp-trigger-border);
  border-radius: 6px;
  background: var(--rp-trigger-bg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.role-picker-trigger:hover {
  border-color: #07c160;
}

.role-picker-trigger--open {
  border-color: #07c160;
  box-shadow: 0 0 0 2px rgba(7, 193, 96, 0.2);
}

.role-picker-value {
  color: var(--rp-value);
}

.role-picker-placeholder {
  color: var(--rp-placeholder);
}

.role-picker-chevron {
  width: 16px;
  height: 16px;
  color: var(--rp-chevron);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.role-picker-chevron--rotate {
  transform: rotate(180deg);
}
</style>

<style>
:root {
  --rp-trigger-bg: var(--color-bg-secondary);
  --rp-trigger-border: var(--color-border);
  --rp-value: var(--color-text-primary);
  --rp-placeholder: var(--color-text-muted);
  --rp-chevron: var(--color-text-muted);
  --rp-dropdown-bg: var(--color-bg-secondary);
  --rp-dropdown-border: var(--color-border);
  --rp-dropdown-shadow: 0 4px 20px rgba(15, 23, 42, 0.12);
  --rp-divider: var(--color-border);
  --rp-item: var(--color-text-secondary);
  --rp-item-desc: var(--color-text-muted);
  --rp-hover-bg: var(--color-bg-tertiary);
  --rp-active-text: #07c160;
  --rp-active-bg: rgba(7, 193, 96, 0.12);
}
.dark {
  --rp-trigger-bg: rgba(255, 255, 255, 0.08);
  --rp-trigger-border: rgba(255, 255, 255, 0.15);
  --rp-value: rgba(255, 255, 255, 0.9);
  --rp-placeholder: rgba(255, 255, 255, 0.4);
  --rp-chevron: rgba(255, 255, 255, 0.5);
  --rp-dropdown-bg: rgba(30, 30, 60, 0.95);
  --rp-dropdown-border: rgba(255, 255, 255, 0.15);
  --rp-dropdown-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  --rp-divider: rgba(255, 255, 255, 0.1);
  --rp-item: rgba(255, 255, 255, 0.7);
  --rp-item-desc: rgba(255, 255, 255, 0.4);
  --rp-hover-bg: rgba(255, 255, 255, 0.05);
  --rp-active-text: #07c160;
  --rp-active-bg: rgba(7, 193, 96, 0.15);
}

.role-picker-dropdown {
  position: fixed;
  z-index: 1000;
  background: var(--rp-dropdown-bg);
  border: 1px solid var(--rp-dropdown-border);
  border-radius: 8px;
  box-shadow: var(--rp-dropdown-shadow);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 两栏容器 */
.role-picker-cols {
  display: flex;
  flex: 1;
  min-height: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.role-picker-left {
  width: 100px;
  border-right: 1px solid var(--rp-divider);
  padding: 4px 0;
}

.role-picker-side {
  padding: 10px 12px;
  margin: 2px 4px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.15s;
  color: var(--rp-item);
  border-radius: 6px;
}

.role-picker-side:hover {
  background-color: var(--rp-hover-bg);
}

.role-picker-side--active {
  color: var(--rp-active-text);
  background-color: var(--rp-active-bg);
  font-weight: 500;
}

.role-picker-chevron-right {
  width: 14px;
  height: 14px;
  color: #07c160;
}

.role-picker-right {
  flex: 1;
  padding: 4px 0;
  display: flex;
  flex-direction: column;
}

.role-picker-item {
  padding: 10px 12px;
  margin: 2px 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--rp-item);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-picker-item:hover {
  background-color: var(--rp-hover-bg);
}

/* 反向/排除模式提示 */
.role-picker-reverse-hint {
  padding: 8px 12px;
  margin: 2px 4px 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--rp-active-text);
  background-color: var(--rp-active-bg);
  border-radius: 6px;
}

/* 阵营锁定：固定阵营标题 */
.role-picker-locked-side {
  padding: 10px 12px 6px;
  margin: 2px 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--rp-active-text);
}

.role-picker-item--active {
  color: var(--rp-active-text);
  background-color: var(--rp-active-bg);
  font-weight: 500;
}

/* 多选勾选框 */
.role-picker-check {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--rp-divider);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.role-picker-check--checked {
  background-color: #07c160;
  border-color: #07c160;
  color: #fff;
}

/* 多选确定按钮 */
.role-picker-confirm-bar {
  padding: 8px 12px;
  border-top: 1px solid var(--rp-divider);
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.role-picker-confirm-btn {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: #07c160;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.role-picker-confirm-btn:hover {
  background: #06a050;
}

/* 反向模式勾选框 */
.role-picker-reverse-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--rp-item);
  cursor: pointer;
  user-select: none;
}
.role-picker-reverse-check input {
  width: 14px;
  height: 14px;
  accent-color: #07c160;
  cursor: pointer;
}
</style>
