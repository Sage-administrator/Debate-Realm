<script setup lang="ts">
// 自定义日期时间选择器（弹层日历 + 时间列表）
// 外观对齐 MonthRangePicker 的悬浮弹层风格，但面板背景使用 CSS 变量以适配深/浅色模式
// v-model 值格式：'YYYY-MM-DDTHH:mm'（本地时间，无时区后缀）

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const hourListRef = ref<HTMLElement | null>(null)
const minuteListRef = ref<HTMLElement | null>(null)

const panelLeft = ref(0)
const panelTop = ref(0)

// 选中的日期时间
const selected = ref<Date | null>(null)

function parseValue(val?: string): Date | null {
  if (val && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val)) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

watch(() => props.modelValue, (v) => {
  selected.value = parseValue(v)
}, { immediate: true })

// 日历视图状态
const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth()) // 0-based

watch(selected, (d) => {
  if (d) {
    viewYear.value = d.getFullYear()
    viewMonth.value = d.getMonth()
  }
}, { immediate: true })

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const daysInMonth = computed(() => new Date(viewYear.value, viewMonth.value + 1, 0).getDate())
const firstWeekday = computed(() => new Date(viewYear.value, viewMonth.value, 1).getDay()) // 0=周日

const dayCells = computed<(number | null)[]>(() => {
  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday.value; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth.value; d++) cells.push(d)
  return cells
})

const currentHour = computed(() => selected.value?.getHours() ?? -1)
const currentMinute = computed(() => selected.value?.getMinutes() ?? -1)

const displayText = computed(() => {
  if (!selected.value) return ''
  const d = selected.value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

function emitValue() {
  if (!selected.value) return
  const d = selected.value
  const pad = (n: number) => String(n).padStart(2, '0')
  emit('update:modelValue', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
}

function updatePanelPosition() {
  const rect = triggerRef.value?.getBoundingClientRect()
  if (!rect) return
  panelLeft.value = rect.left
  const estH = 360
  let top = rect.bottom + 4
  // 空间不足时翻到上方
  if (top + estH > window.innerHeight && rect.top - estH > 0) {
    top = rect.top - estH - 4
  }
  panelTop.value = top
}

function scrollTimeIntoView() {
  nextTick(() => {
    hourListRef.value?.querySelector('.t-sel')?.scrollIntoView({ block: 'center' })
    minuteListRef.value?.querySelector('.t-sel')?.scrollIntoView({ block: 'center' })
  })
}

function togglePanel() {
  open.value = !open.value
  if (open.value) {
    updatePanelPosition()
    scrollTimeIntoView()
    window.addEventListener('scroll', updatePanelPosition, true)
    window.addEventListener('resize', updatePanelPosition)
  }
}

function closePanel() {
  open.value = false
  window.removeEventListener('scroll', updatePanelPosition, true)
  window.removeEventListener('resize', updatePanelPosition)
}

function onClickOutside(e: MouseEvent) {
  if (
    panelRef.value && !panelRef.value.contains(e.target as Node) &&
    triggerRef.value && !triggerRef.value.contains(e.target as Node)
  ) {
    closePanel()
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  window.removeEventListener('scroll', updatePanelPosition, true)
  window.removeEventListener('resize', updatePanelPosition)
})

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

function isSelectedDay(d: number): boolean {
  if (!selected.value) return false
  const s = selected.value
  return s.getFullYear() === viewYear.value && s.getMonth() === viewMonth.value && s.getDate() === d
}

function pickDay(d: number) {
  const base = selected.value ?? new Date()
  selected.value = new Date(viewYear.value, viewMonth.value, d, base.getHours(), base.getMinutes())
  emitValue()
}

function setHour(h: number) {
  const base = selected.value ?? new Date()
  selected.value = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, base.getMinutes())
  scrollTimeIntoView()
  emitValue()
}
function setMinute(m: number) {
  const base = selected.value ?? new Date()
  selected.value = new Date(base.getFullYear(), base.getMonth(), base.getDate(), base.getHours(), m)
  scrollTimeIntoView()
  emitValue()
}

const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = Array.from({ length: 60 }, (_, i) => i)
</script>

<template>
  <div class="relative block w-full">
    <!-- 触发器 -->
    <div
      ref="triggerRef"
      class="flex items-center h-10 px-3 border rounded cursor-pointer select-none transition-colors"
      :class="open ? 'border-blue-500' : 'border-[var(--color-border)] hover:border-[var(--color-border-accented)]'"
      style="width: 100%;"
      @click.stop="togglePanel"
    >
      <UIcon name="i-lucide-calendar-clock" class="w-[18px] h-[18px] text-blue-500 mr-2 shrink-0" />
      <span
        class="flex-1 text-sm"
        :class="displayText ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'"
      >{{ displayText || '请选择比赛时间' }}</span>
    </div>

    <!-- 下拉面板（主题自适应） -->
    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="fixed z-[60] bg-[var(--color-bg-secondary)] backdrop-blur-xl rounded-lg shadow-lg border border-[var(--color-border)] flex"
        :style="{ left: panelLeft + 'px', top: panelTop + 'px' }"
      >
        <!-- 左：日历 -->
        <div class="p-3 w-[240px] border-r border-[var(--color-border)]">
          <!-- 顶部年月导航 -->
          <div class="flex items-center justify-between mb-2">
            <button
              type="button"
              class="w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              @click.stop="prevMonth"
            >
              <UIcon name="i-lucide-chevron-left" class="w-3.5 h-3.5" />
            </button>
            <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ viewYear }}年 {{ viewMonth + 1 }}月</span>
            <button
              type="button"
              class="w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              @click.stop="nextMonth"
            >
              <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5" />
            </button>
          </div>
          <!-- 星期 -->
          <div class="grid grid-cols-7 gap-1 mb-1">
            <div v-for="w in WEEKDAYS" :key="w" class="text-center text-xs text-[var(--color-text-muted)] py-1">{{ w }}</div>
          </div>
          <!-- 日期网格 -->
          <div class="grid grid-cols-7 gap-1">
            <template v-for="(d, idx) in dayCells" :key="idx">
              <div v-if="d === null"></div>
              <button
                v-else
                type="button"
                class="h-8 text-sm rounded flex items-center justify-center transition-all duration-150"
                :class="isSelectedDay(d)
                  ? 'bg-blue-500 text-white font-medium'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer'"
                @click.stop="pickDay(d)"
              >{{ d }}</button>
            </template>
          </div>
        </div>

        <!-- 右：时间 -->
        <div class="p-3 w-[132px]">
          <div class="text-xs text-[var(--color-text-muted)] mb-2 text-center">选择时间</div>
          <div class="flex gap-2" style="height: 232px;">
            <!-- 小时 -->
            <div ref="hourListRef" class="flex-1 overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <button
                v-for="h in hours"
                :key="'h' + h"
                type="button"
                class="w-full py-1.5 text-sm rounded transition-colors"
                :class="currentHour === h
                  ? 't-sel bg-blue-500 text-white font-medium'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'"
                @click.stop="setHour(h)"
              >{{ String(h).padStart(2, '0') }}</button>
            </div>
            <!-- 分钟 -->
            <div ref="minuteListRef" class="flex-1 overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <button
                v-for="m in minutes"
                :key="'m' + m"
                type="button"
                class="w-full py-1.5 text-sm rounded transition-colors"
                :class="currentMinute === m
                  ? 't-sel bg-blue-500 text-white font-medium'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'"
                @click.stop="setMinute(m)"
              >{{ String(m).padStart(2, '0') }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
