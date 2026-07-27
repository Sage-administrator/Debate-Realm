<script setup lang="ts">
// 角色选择器 - 双级联选择：正方/反方 + 辩手位
// 支持单选（modelValue: string）和多选（modelValue: string[]）
// 单选：点击辩手即选中并关闭（原行为）
// 多选：点击辩手 toggle 选中，底部"确定"按钮关闭

interface Props {
  modelValue?: string | string[] // 单选如 "正方·一辩"；多选如 ["正方·一辩","正方·二辩"]
  placeholder?: string
  multiple?: boolean // 显式指定模式；不传则按 modelValue 类型推断
  debaters?: { label: string; value: string }[] // 自定义辩手位，默认 4 辩手+全体
  reverse?: boolean // 反向/排除模式能力开关：为 true 时下拉提供「正常/排除」切换，初始进入排除模式；选某辩手位 X 表示"该方除 X 辩外任意辩手"，发言权限给其余辩手
  side?: 'positive' | 'negative' // 阵营锁定：仅显示并只允许该阵营（用于"正方辩手/反方辩手"等按阵营固定的字段）
}

const props = withDefaults(defineProps<Props>(), {
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
}>()

// 阵营
const sides = [
  { label: '正方', value: 'positive' },
  { label: '反方', value: 'negative' },
]

// 是否常规多选模式（按 prop 或 modelValue 类型推断）
const isMultiple = computed(() => props.multiple ?? Array.isArray(props.modelValue))

// 反向/排除模式（可切换）：reverse 为能力开关/初始默认，运行时可在下拉内切到正常模式
const isReverse = ref(!!props.reverse)

// 是否支持排除模式（显式开启 reverse 能力的字段提供「正常/排除」切换）
const reverseCapable = computed(() => !!props.reverse)

// 反向模式复用多选勾选 UI：勾选多个要排除的辩手，确认后合成单条排除值
const useCheckUI = computed(() => isMultiple.value || isReverse.value)

// 反向模式下不提供"全体"（排除全集含义模糊），仅保留具体辩手位
const visibleDebaters = computed(() =>
  isReverse.value ? props.debaters.filter(d => d.value !== 'all') : props.debaters,
)

// 阵营锁定：设定后仅显示该阵营，左侧阵营栏隐藏，选中阵营固定为该值
const isSideLocked = computed(() => !!props.side)
const effectiveSides = computed(() =>
  isSideLocked.value ? sides.filter(s => s.value === props.side) : sides,
)
const lockedSideLabel = computed(() => sides.find(s => s.value === props.side)?.label || '')

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
    const sideLabel = sides.find(s => s.value === p.side)?.label || ''
    const debaterLabel = props.debaters.find(d => d.value === p.debater)?.label || ''
    if (!bySide[sideLabel]) bySide[sideLabel] = []
    if (debaterLabel) bySide[sideLabel].push(debaterLabel)
  }
  const allDebaters = props.debaters.filter(d => d.value !== 'all').map(d => d.label)
  const parts: string[] = []
  for (const sideLabel of Object.keys(bySide)) {
    const labels = bySide[sideLabel] || []  // 兜底：确保 labels 不为 undefined
    const isAll = allDebaters.length > 0 && allDebaters.every(l => labels.includes(l))
    const text = isAll ? '全体' : labels.join('/')
    parts.push(`${sideLabel} · ${text}`)
  }
  return parts.join(' ')
}

// 获取显示文本
function getDisplayText(): string {
  const v = props.modelValue
  // 标准多选数组（如 正方/反方参与辩手）
  if (Array.isArray(v)) {
    if (!v.length) return props.placeholder
    // v.length >= 1 时 v[0] 一定存在
    if (v.length === 1) return formatSingle(v[0]!)
    return formatMultiDisplay(v)
  }
  // 单字符串：反向能力字段（发言方）可能以「、」连接的多值或排除值存储
  if (typeof v === 'string') {
    if (!v) return props.placeholder
    if (isReverseValue(v)) return formatSingle(v) // "X方除…外任意辩手"
    if (/[、，/]/.test(v)) {
      return formatMultiDisplay(v.split(/[、，/]/).map(s => s.trim()).filter(Boolean))
    }
    return formatSingle(v)
  }
  return props.placeholder
}

// 是否反向/排除值：形如 "正方·除一辩外任意辩手" / "正方除一辩二辩外任意辩手"（兼容旧数据无"任意辩手"后缀）
function isReverseValue(value: string): boolean {
  const v = (value || '').replace(/[·\/\s\-]/g, '')
  return v.includes('除') && v.includes('外')
}

// 解析反向/排除值 → { side, excluded: debater value[] }
// 支持多选排除，如 "正方·除一辩二辩外任意辩手" / "正方除一辩二辩外"（旧数据无"任意辩手"后缀也可解析）
function parseReverseValue(value: string): { side: string; excluded: string[] } | null {
  const cleaned = (value || '').replace(/[·\/\s\-]/g, '')
  const m = cleaned.match(/^(正方|反方)除(.+?)外(?:任意辩手)?$/)
  if (!m || !m[2]) return null  // 兜底：确保 m[2] 存在
  const side = m[1] === '正方' ? 'positive' : 'negative'
  const excluded: string[] = []
  for (const part of m[2].split('辩')) {
    if (!part) continue
    const debVal = props.debaters.find(d => d.label === part + '辩')?.value
    if (debVal && !excluded.includes(debVal)) excluded.push(debVal)
  }
  return { side, excluded }
}

// 格式化单个值用于显示
function formatSingle(value: string): string {
  const parsed = parseValue(value)
  if (!parsed) return value
  const sideLabel = sides.find(s => s.value === parsed.side)?.label || ''
  // 反向/排除模式：落库值已含"任意辩手"，直接返回标准文本
  if (isReverseValue(value)) {
    return value
  }
  const debaterLabel = props.debaters.find(d => d.value === parsed.debater)?.label || ''
  return `${sideLabel} · ${debaterLabel}`
}

// 组装单条值
function buildValue(side: string, debater: string, reverse = false): string {
  const sideLabel = sides.find(s => s.value === side)?.label || ''
  const debaterLabel = props.debaters.find(d => d.value === debater)?.label || ''
  return reverse ? `${sideLabel}·除${debaterLabel}外` : `${sideLabel}·${debaterLabel}`
}

// 反向/排除模式组装值：把被排除的多个辩手合成单条，形如 "正方·除一辩二辩外任意辩手"
function buildReverseValue(side: string, excluded: string[]): string {
  if (!excluded.length) return ''
  const sideLabel = sides.find(s => s.value === side)?.label || ''
  const labels = excluded.map(v => props.debaters.find(d => d.value === v)?.label || '').join('')
  return `${sideLabel}·除${labels}外任意辩手`
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

// 把一组角色值（"正方·一辩" 等）填充到 multiSelected（按阵营分组）
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
  if (isMultiple.value) {
    const raw = props.modelValue
    // 反向能力字段（发言方）以单字符串存储：排除值 或 正常多选("、" 连接)
    if (typeof raw === 'string' && raw) {
      if (isReverseValue(raw)) {
        isReverse.value = true
        const rv = parseReverseValue(raw)
        if (rv) {
          selectedSide.value = rv.side
          multiSelected.value = { positive: [], negative: [], [rv.side]: rv.excluded }
        } else {
          multiSelected.value = { positive: [], negative: [] }
        }
        selectedDebater.value = 'de1'
        return
      }
      // 正常多选：按 、，/ 拆分后填充
      fillMultiFromArray(raw.split(/[、，/]/).map(s => s.trim()).filter(Boolean))
      isReverse.value = false
      return
    }
    // 标准多选数组
    fillMultiFromArray(Array.isArray(raw) ? raw : [])
    isReverse.value = false
    return
  }
  // 单值模式：根据已存值类型回显「正常 / 排除」，空值回退到 reverse 默认
  const val = props.modelValue as string | undefined
  if (val && isReverseValue(val)) {
    isReverse.value = true
    const rv = parseReverseValue(val)
    if (rv) {
      selectedSide.value = rv.side
      multiSelected.value = { positive: [], negative: [], [rv.side]: rv.excluded }
    } else {
      multiSelected.value = { positive: [], negative: [] }
    }
    selectedDebater.value = 'de1'
  } else {
    isReverse.value = false
    multiSelected.value = { positive: [], negative: [] }
    if (val) {
      const parsed = parseValue(val)
      if (parsed) {
        selectedSide.value = parsed.side
        selectedDebater.value = parsed.debater
      }
    } else {
      // 空值：遵循 reverse 能力默认
      isReverse.value = !!props.reverse
    }
  }
}

// 切换「正常 / 排除」模式：清空内部选择，避免跨模式脏数据
function setMode(reverse: boolean) {
  isReverse.value = reverse
  multiSelected.value = { positive: [], negative: [] }
  selectedDebater.value = 'de1'
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
    // "全体"：切换全部具体辩手
    const allDebaters = props.debaters.filter(d => d.value !== 'all').map(d => d.value)
    const allSelected = allDebaters.every(d => list.includes(d))
    multiSelected.value = {
      ...multiSelected.value,
      [selectedSide.value]: allSelected ? [] : allDebaters,
    }
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
    const allDebaters = props.debaters.filter(d => d.value !== 'all').map(d => d.value)
    return allDebaters.every(d => list.includes(d))
  }
  return list.includes(value)
}

// 多选 / 反向排除：确认按钮
function confirmMulti() {
  // 先关闭面板，再回写值：避免父组件更新 modelValue 的重渲染把面板重新点亮
  close()
  if (isReverse.value) {
    // 反向模式：把当前阵营的多个被排除辩手合成单条排除值（写入 modelValue 字符串）
    const excluded = multiSelected.value[selectedSide.value] || []
    emit('update:modelValue', buildReverseValue(selectedSide.value, excluded))
    return
  }
  const parts: string[] = []
  for (const s of effectiveSides.value) {
    const list = multiSelected.value[s.value] || []
    for (const d of props.debaters) {
      if (d.value !== 'all' && list.includes(d.value)) {
        parts.push(buildValue(s.value, d.value))
      }
    }
  }
  // 反向能力字段（发言方）以单字符串存储：正常多选用 "、" 连接；其余多选字段返回数组
  emit('update:modelValue', props.reverse ? parts.join('、') : parts)
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
      <span :class="(isMultiple ? (modelValue as string[])?.length : modelValue) ? 'role-picker-value' : 'role-picker-placeholder'">
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
          <!-- 模式切换：正常 / 排除（仅排除能力开启且非多选时显示） -->
          <div v-if="reverseCapable" class="role-picker-mode-toggle">
            <button
              type="button"
              class="role-picker-mode-btn"
              :class="{ 'role-picker-mode-btn--active': !isReverse }"
              @click="setMode(false)"
            >
              正常
            </button>
            <button
              type="button"
              class="role-picker-mode-btn"
              :class="{ 'role-picker-mode-btn--active': isReverse }"
              @click="setMode(true)"
            >
              排除
            </button>
          </div>

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

              <!-- 反向/排除模式提示 -->
              <div v-if="isReverse" class="role-picker-reverse-hint">
                排除模式 · 勾选要排除的辩手（可多选，其余同方可发言）
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
                  <span class="role-picker-check" :class="{ 'role-picker-check--checked': isDebaterSelected(d.value) }">
                    <UIcon v-if="isDebaterSelected(d.value)" name="i-lucide-check" class="w-3 h-3" />
                  </span>
                  <span>{{ d.label }}</span>
                  <span v-if="isReverse && isDebaterSelected(d.value)" class="role-picker-exclude-badge">排除</span>
                </template>
                <template v-else>
                  <span>{{ d.label }}</span>
                </template>
              </div>

              <!-- 多选 / 反向排除：确定按钮 -->
              <div v-if="useCheckUI" class="role-picker-confirm-bar">
                <button class="role-picker-confirm-btn" @click.stop="confirmMulti">
                  确定
                </button>
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
  transition: border-color 0.2s, box-shadow 0.2s;
}

.role-picker-trigger:hover {
  border-color: #07C160;
}

.role-picker-trigger--open {
  border-color: #07C160;
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
  --rp-active-text: #07C160;
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
  --rp-active-text: #07C160;
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

/* 模式切换：正常 / 排除（分段控件） */
.role-picker-mode-toggle {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--rp-divider);
  flex-shrink: 0;
}

.role-picker-mode-btn {
  flex: 1;
  padding: 6px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--rp-item);
  background: transparent;
  border: 1px solid var(--rp-divider);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.role-picker-mode-btn:hover {
  background-color: var(--rp-hover-bg);
}

.role-picker-mode-btn--active {
  color: #fff;
  background-color: #07C160;
  border-color: #07C160;
}

/* 两栏容器：模式切换下方的阵营 + 辩手 */
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
  color: #07C160;
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

/* 反向模式：选中项的"排除"徽标 */
.role-picker-exclude-badge {
  margin-left: auto;
  padding: 1px 8px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  background-color: #e53e3e;
  border-radius: 10px;
  flex-shrink: 0;
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
  background-color: #07C160;
  border-color: #07C160;
  color: #fff;
}

/* 多选确定按钮 */
.role-picker-confirm-bar {
  padding: 8px 12px;
  border-top: 1px solid var(--rp-divider);
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
}

.role-picker-confirm-btn {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: #07C160;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.role-picker-confirm-btn:hover {
  background: #06a050;
}
</style>
