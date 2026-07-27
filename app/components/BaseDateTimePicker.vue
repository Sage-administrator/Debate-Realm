<!--
  暗色主题日期/时间选择器（取代原生 date / datetime-local / time 输入）
  - 对外 v-model 仍是字符串，与现有格式完全一致：
      mode="date"     -> "YYYY-MM-DD"
      mode="datetime" -> "YYYY-MM-DDTHH:mm"
      mode="time"     -> "HH:mm"
  - 触发器是只读 input，沿用调用方页面原有的字段样式类（inputClass），
    视觉上与原生输入框一致，但点击后弹出的是自定义暗色日历/时间弹层，
    不再暴露操作系统的白底日历菜单。
  - 弹层使用项目 CSS 主题变量（--color-*），深浅色页面均自适应。
-->
<template>
  <div ref="rootRef" class="relative">
    <input
      type="text"
      readonly
      :value="displayLabel"
      :placeholder="defaultPlaceholder"
      :disabled="disabled"
      @click="openPicker"
      @focus="openPicker"
      :class="['w-full cursor-pointer', inputClass]"
    />

    <div
      v-if="open"
      ref="popupRef"
      class="fixed z-[100] w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl p-3 text-[var(--color-text-primary)]"
      :style="popupStyle"
    >
      <!-- 日历（time 模式不显示） -->
      <template v-if="mode !== 'time'">
        <div class="flex items-center justify-between mb-2">
          <div class="flex gap-1">
            <button type="button" class="w-6 h-6 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-xs" @click="prevYear">«</button>
            <button type="button" class="w-6 h-6 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]" @click="prevMonth">‹</button>
          </div>
          <span class="text-sm font-medium">{{ viewYear }}年{{ viewMonth + 1 }}月</span>
          <div class="flex gap-1">
            <button type="button" class="w-6 h-6 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]" @click="nextMonth">›</button>
            <button type="button" class="w-6 h-6 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-xs" @click="nextYear">»</button>
          </div>
        </div>

        <div class="grid grid-cols-7 mb-1">
          <span v-for="w in weekDays" :key="w" class="text-center text-[11px] text-[var(--color-text-muted)] py-1">{{ w }}</span>
        </div>

        <div class="grid grid-cols-7 gap-0.5">
          <button
            v-for="(c, i) in cells"
            :key="i"
            type="button"
            :disabled="c.disabled"
            class="h-8 rounded text-xs flex items-center justify-center transition-colors"
            :class="[
              c.disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
              !c.inMonth ? 'text-[var(--color-text-muted)] opacity-60' : 'text-[var(--color-text-primary)]',
              isSelected(c.date)
                ? 'bg-[var(--color-accent-primary)] text-white font-semibold'
                : (c.inMonth && !c.disabled ? 'hover:bg-[var(--color-accent-bg)]' : ''),
            ]"
            @click="pickDay(c.date)"
          >
            <span v-if="isToday(c.date) && !isSelected(c.date)" class="underline decoration-[var(--color-accent-primary)] decoration-2 underline-offset-2">{{ c.date.getDate() }}</span>
            <span v-else>{{ c.date.getDate() }}</span>
          </button>
        </div>
      </template>

      <!-- 时间步进器（date 模式不显示） -->
      <div v-if="mode !== 'date'" class="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center justify-center gap-5">
        <div class="flex flex-col items-center gap-1">
          <button type="button" class="w-7 h-6 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]" @click="adjust('hour', 1)">▲</button>
          <span class="text-lg font-semibold tabular-nums w-8 text-center">{{ pad(draft.getHours()) }}</span>
          <button type="button" class="w-7 h-6 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]" @click="adjust('hour', -1)">▼</button>
          <span class="text-[10px] text-[var(--color-text-muted)]">时</span>
        </div>
        <span class="text-lg font-semibold pb-4">:</span>
        <div class="flex flex-col items-center gap-1">
          <button type="button" class="w-7 h-6 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]" @click="adjust('minute', 1)">▲</button>
          <span class="text-lg font-semibold tabular-nums w-8 text-center">{{ pad(draft.getMinutes()) }}</span>
          <button type="button" class="w-7 h-6 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]" @click="adjust('minute', -1)">▼</button>
          <span class="text-[10px] text-[var(--color-text-muted)]">分</span>
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="mt-3 pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
        <button type="button" class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" @click="clearValue">清除</button>
        <button
          v-if="mode !== 'date'"
          type="button"
          class="px-3 py-1 rounded-md bg-[var(--color-accent-primary)] text-white text-xs hover:opacity-90"
          @click="confirm"
        >确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string
  mode?: 'date' | 'datetime' | 'time'
  placeholder?: string
  min?: string
  max?: string
  disabled?: boolean
  inputClass?: string
}>(), {
  modelValue: '',
  mode: 'date',
  placeholder: '',
  min: '',
  max: '',
  disabled: false,
  inputClass: 'input-glass w-full',
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// ═══════════ 工具函数 ═══════════
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parseValue(v?: string | null): Date | null {
  if (!v) return null
  const s = String(v)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  // 正则匹配成功时 m[1]-m[5] 一定存在，加非空断言
  if (m) return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, 0, 0)
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(+m[1]!, +m[2]! - 1, +m[3]!, 0, 0, 0, 0)
  m = s.match(/^(\d{2}):(\d{2})/)
  if (m) {
    const d = new Date()
    d.setHours(+m[1]!, +m[2]!, 0, 0)
    return d
  }
  return null
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function fmtTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function toModel(d: Date, mode: string): string {
  if (mode === 'time') return fmtTime(d)
  if (mode === 'datetime') return `${fmtDate(d)}T${fmtTime(d)}`
  return fmtDate(d)
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// ═══════════ 状态 ═══════════
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
const draft = ref<Date>(new Date())
const viewYear = ref(0)
const viewMonth = ref(0) // 0-based
const popupStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

let resizeHandler: (() => void) | null = null
let scrollHandler: (() => void) | null = null

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

const defaultPlaceholder = computed(() =>
  props.placeholder || (props.mode === 'time' ? '选择时间' : props.mode === 'datetime' ? '选择日期时间' : '选择日期'),
)

const displayLabel = computed(() => {
  const d = parseValue(props.modelValue)
  if (!d) return ''
  if (props.mode === 'time') return fmtTime(d)
  if (props.mode === 'datetime') return `${fmtDate(d)} ${fmtTime(d)}`
  return fmtDate(d)
})

function isDisabled(d: Date): boolean {
  if (props.mode === 'time') return false
  const minD = parseValue(props.min)
  const maxD = parseValue(props.max)
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (minD) {
    const m = new Date(minD.getFullYear(), minD.getMonth(), minD.getDate())
    if (day < m) return true
  }
  if (maxD) {
    const m = new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate())
    if (day > m) return true
  }
  return false
}

const cells = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const startIdx = (first.getDay() + 6) % 7 // 周一为一周起点
  const gridStart = new Date(viewYear.value, viewMonth.value, 1 - startIdx)
  const out: { date: Date; inMonth: boolean; disabled: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    out.push({ date: d, inMonth: d.getMonth() === viewMonth.value, disabled: isDisabled(d) })
  }
  return out
})

function isSelected(d: Date): boolean {
  const s = draft.value
  return s.getFullYear() === d.getFullYear() && s.getMonth() === d.getMonth() && s.getDate() === d.getDate()
}
function isToday(d: Date): boolean {
  const t = new Date()
  return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth() && t.getDate() === d.getDate()
}

// ═══════════ 交互 ═══════════
function openPicker() {
  if (props.disabled || open.value) return
  const parsed = parseValue(props.modelValue)
  draft.value = parsed ? new Date(parsed) : startOfToday()
  const base = parsed || startOfToday()
  viewYear.value = base.getFullYear()
  viewMonth.value = base.getMonth()
  open.value = true
}

function computePosition() {
  if (!open.value || !rootRef.value || !popupRef.value) return
  const trigger = rootRef.value.getBoundingClientRect()
  const popup = popupRef.value.getBoundingClientRect()
  const gap = 6
  const spaceBelow = window.innerHeight - trigger.bottom
  const spaceAbove = trigger.top
  const openUp = spaceBelow < popup.height && spaceAbove > spaceBelow
  const top = openUp ? trigger.top - popup.height - gap : trigger.bottom + gap
  let left = trigger.left
  if (left + popup.width > window.innerWidth) {
    left = Math.max(8, window.innerWidth - popup.width - 8)
  }
  popupStyle.value = { top: `${top}px`, left: `${left}px` }
}

function bindReposition() {
  resizeHandler = () => computePosition()
  scrollHandler = () => computePosition()
  window.addEventListener('resize', resizeHandler)
  window.addEventListener('scroll', scrollHandler, true)
}
function unbindReposition() {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler, true)
  resizeHandler = null
  scrollHandler = null
}

watch(open, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      computePosition()
      bindReposition()
    })
  } else {
    unbindReposition()
  }
})

function emitValue() {
  emit('update:modelValue', toModel(draft.value, props.mode))
}

function pickDay(d: Date) {
  if (isDisabled(d)) return
  const newD = new Date(d)
  if (props.mode === 'datetime') {
    newD.setHours(draft.value.getHours(), draft.value.getMinutes(), 0, 0)
  } else {
    newD.setHours(0, 0, 0, 0)
  }
  draft.value = newD
  emitValue()
  if (props.mode === 'date') open.value = false
}

function adjust(which: 'hour' | 'minute', delta: number) {
  const d = new Date(draft.value)
  if (which === 'hour') d.setHours((d.getHours() + delta + 24) % 24)
  else d.setMinutes((d.getMinutes() + delta + 60) % 60)
  draft.value = d
  emitValue()
}

function confirm() {
  emitValue()
  open.value = false
}

function clearValue() {
  emit('update:modelValue', '')
  open.value = false
}

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}
function prevYear() { viewYear.value-- }
function nextYear() { viewYear.value++ }

// 点击外部 / Esc 关闭
function onDocClick(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = false
}
function onKeyEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeyEsc)
})
onBeforeUnmount(() => {
  unbindReposition()
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeyEsc)
})
</script>
