<script setup lang="ts">
// 双面板月份范围选择器
// 左面板：开始月份 | 右面板：结束月份

const props = defineProps<{
  startDate?: string  // 'YYYY-MM'
  endDate?: string    // 'YYYY-MM'
}>()

const emit = defineEmits<{
  'update:startDate': [value: string]
  'update:endDate': [value: string]
}>()

// ── 月份名称 ──
const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

// ── 面板状态 ──
const open = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)

// 左右面板年份
const currentYear = new Date().getFullYear()
const leftYear = ref(currentYear)
const rightYear = ref(currentYear)  // 结束年份默认 = 开始年份

// 选中的月份 (0-based)
const selectedStartMonth = ref<number | null>(null)
const selectedEndMonth = ref<number | null>(null)

// 选择阶段: 'start' | 'end'
const pickingStep = ref<'start' | 'end'>('start')

// ── 初始化已有值 ──
watch(() => props.startDate, (val) => {
  if (val && /^\d{4}-\d{2}$/.test(val)) {
    const parts = val.split('-').map(Number)
    if (parts.length < 2 || parts[0] == null || parts[1] == null) return
    selectedStartMonth.value = parts[1] - 1
    leftYear.value = parts[0]
  }
}, { immediate: true })

watch(() => props.endDate, (val) => {
  if (val && /^\d{4}-\d{2}$/.test(val)) {
    const parts = val.split('-').map(Number)
    if (parts.length < 2 || parts[0] == null || parts[1] == null) return
    selectedEndMonth.value = parts[1] - 1
    rightYear.value = parts[0]
  }
}, { immediate: true })

// ── 显示文本 ──
const displayStart = computed(() => {
  if (selectedStartMonth.value == null) return ''
  return `${leftYear.value}-${String(selectedStartMonth.value + 1).padStart(2, '0')}`
})
const displayEnd = computed(() => {
  if (selectedEndMonth.value == null) return ''
  return `${rightYear.value}-${String(selectedEndMonth.value + 1).padStart(2, '0')}`
})

// ── 面板定位：用 ref 而非 computed，滚动时主动重算 ──
const panelLeft = ref(0)
const panelTop = ref(0)

function updatePanelPosition() {
  const rect = triggerRef.value?.getBoundingClientRect()
  if (rect) {
    panelLeft.value = rect.left
    panelTop.value = rect.bottom + 4
  }
}

// ── 面板打开/关闭时管理滚动监听 ──
watch(open, (val) => {
  if (val) {
    updatePanelPosition()
    window.addEventListener('scroll', updatePanelPosition, true)
    window.addEventListener('resize', updatePanelPosition)
  } else {
    window.removeEventListener('scroll', updatePanelPosition, true)
    window.removeEventListener('resize', updatePanelPosition)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', updatePanelPosition, true)
  window.removeEventListener('resize', updatePanelPosition)
})

// ── 点击外部关闭 ──
function onClickOutside(e: MouseEvent) {
  if (
    panelRef.value && !panelRef.value.contains(e.target as Node) &&
    triggerRef.value && !triggerRef.value.contains(e.target as Node)
  ) {
    closePanel()
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))

// ── 面板操作 ──
function togglePanel() {
  open.value = !open.value
  if (open.value) {
    pickingStep.value = 'start'
    // 重置左右面板年份：左=当前年 或 开始日期的年份，右=左（同一年）
    if (props.startDate) {
      const y = Number(props.startDate.split('-')[0])
      leftYear.value = y
      rightYear.value = y
    } else {
      leftYear.value = currentYear
      rightYear.value = currentYear
    }
  }
}

function closePanel() {
  open.value = false
  // 如果只选了开始没选结束，重置选择
  if (selectedStartMonth.value != null && selectedEndMonth.value == null) {
    selectedStartMonth.value = null
  }
  pickingStep.value = 'start'
}

// ── 月份格子判断 ──
// 将面板月份转为全局月份值
function toGlobalMonth(year: number, monthIdx: number): number {
  return year * 12 + monthIdx
}

function isDisabled(panel: 'left' | 'right', monthIdx: number): boolean {
  if (pickingStep.value !== 'end' || selectedStartMonth.value == null) return false

  // 用储存的开始日期做全局比较，确保年份与月份的一致性
  const startYear = leftYear.value
  const startMonth = selectedStartMonth.value
  const startGlobal = toGlobalMonth(startYear, startMonth)

  if (panel === 'left') {
    // 左面板：严格早于开始月份才禁用（同月允许）
    const thisGlobal = toGlobalMonth(leftYear.value, monthIdx)
    return thisGlobal < startGlobal
  }
  if (panel === 'right') {
    // 右面板：严格早于开始月份才禁用（同月允许）
    const thisGlobal = toGlobalMonth(rightYear.value, monthIdx)
    return thisGlobal < startGlobal
  }
  return false
}

function isSelected(panel: 'left' | 'right', monthIdx: number): boolean {
  if (panel === 'left') {
    return selectedStartMonth.value === monthIdx
  }
  if (panel === 'right') {
    return selectedEndMonth.value === monthIdx
  }
  return false
}

function isInRange(panel: 'left' | 'right', monthIdx: number): boolean {
  if (selectedStartMonth.value == null || selectedEndMonth.value == null) return false
  const startGlobal = toGlobalMonth(leftYear.value, selectedStartMonth.value)
  const endGlobal = toGlobalMonth(rightYear.value, selectedEndMonth.value)
  const thisGlobal = toGlobalMonth(panel === 'left' ? leftYear.value : rightYear.value, monthIdx)
  return thisGlobal > startGlobal && thisGlobal < endGlobal
}

// ── 点击月份 ──
function pickMonth(panel: 'left' | 'right', monthIdx: number) {
  if (isDisabled(panel, monthIdx)) return

  if (pickingStep.value === 'start') {
    // 第一阶段：选择开始月份
    selectedStartMonth.value = monthIdx
    leftYear.value = panel === 'left' ? leftYear.value : rightYear.value
    // 右面板年份至少 = 左面板（同一年也可选结束）
    if (rightYear.value < leftYear.value) {
      rightYear.value = leftYear.value
    }
    pickingStep.value = 'end'
  } else {
    // 第二阶段：选择结束月份
    // 验证：结束月份必须 >= 开始月份（同月允许）
    const startGlobal = toGlobalMonth(leftYear.value, selectedStartMonth.value!)
    const thisGlobal = panel === 'left'
      ? toGlobalMonth(leftYear.value, monthIdx)
      : toGlobalMonth(rightYear.value, monthIdx)
    if (thisGlobal < startGlobal) return  // 只排除早于开始的月份

    if (panel === 'left') {
      selectedEndMonth.value = monthIdx
      rightYear.value = leftYear.value
    } else {
      selectedEndMonth.value = monthIdx
    }
    // 发射更新
    const startStr = `${leftYear.value}-${String(selectedStartMonth.value! + 1).padStart(2, '0')}`
    const endStr = `${rightYear.value}-${String(selectedEndMonth.value! + 1).padStart(2, '0')}`
    emit('update:startDate', startStr)
    emit('update:endDate', endStr)
    // 重置
    pickingStep.value = 'start'
    open.value = false
  }
}

// ── 年份导航：约束右面板不能早于开始年份 ──
function prevYear(panel: 'left' | 'right') {
  if (panel === 'left') {
    leftYear.value--
  } else {
    // 选择结束阶段的右面板不能早于开始年份
    if (pickingStep.value === 'end' && selectedStartMonth.value != null) {
      if (rightYear.value - 1 < leftYear.value) return
    }
    rightYear.value--
  }
}

function nextYear(panel: 'left' | 'right') {
  if (panel === 'left') {
    leftYear.value++
    // 右面板至少与左面板同年（允许同一年选择）
    if (rightYear.value < leftYear.value) rightYear.value = leftYear.value
  } else {
    rightYear.value++
  }
}

// ── 年份列表 ──
const showYearSelect = ref<'left' | 'right' | null>(null)
const yearList = computed(() => {
  const base = currentYear - 5
  return Array.from({ length: 15 }, (_, i) => base + i)
})

function selectYear(panel: 'left' | 'right', year: number) {
  if (panel === 'left') {
    leftYear.value = year
    // 右面板至少与左面板同年（允许同一年选择）
    if (rightYear.value < year) rightYear.value = year
  } else {
    // 选择结束阶段的右面板年份不能早于开始年份
    if (pickingStep.value === 'end' && selectedStartMonth.value != null) {
      if (year < leftYear.value) {
        rightYear.value = leftYear.value
      } else {
        rightYear.value = year
      }
    } else {
      rightYear.value = year
    }
  }
  showYearSelect.value = null
}
</script>

<template>
  <div class="relative block w-full">
    <!-- 触发器 -->
    <div
      ref="triggerRef"
      class="flex items-center h-10 border rounded cursor-pointer select-none transition-colors focus-within:outline-none"
      :class="open ? 'border-green-500' : 'border-white/15 hover:border-white/25'"
      style="width: 100%;"
      @click.stop="togglePanel"
    >
      <span class="flex-1 pl-3 text-sm text-white/90">
        {{ displayStart || '开始' }}
      </span>
      <span class="text-white/40 text-sm px-1">-</span>
      <span
        class="flex-1 pl-3 text-sm"
        :class="displayEnd ? 'text-white/90' : 'text-white/40'"
      >
        {{ displayEnd || '结束' }}
      </span>
      <UIcon name="i-lucide-calendar" class="w-[18px] h-[18px] text-green-500 mr-3 shrink-0" />
    </div>

    <!-- 下拉面板 -->
    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="fixed z-50 bg-[#1e1e3e]/95 backdrop-blur-xl rounded-lg shadow-lg border border-white/15 flex"
        :style="{ left: panelLeft + 'px', top: panelTop + 'px' }"
      >
        <!-- 左面板：开始月份 -->
        <div class="p-3 w-[200px] border-r border-white/10">
          <!-- 顶部控制栏 -->
          <div class="flex items-center justify-between mb-2">
            <button
              class="w-6 h-6 flex items-center justify-center rounded text-white/70 hover:bg-white/10 transition-colors"
              @click.stop="prevYear('left')"
            >
              <UIcon name="i-lucide-chevron-left" class="w-3.5 h-3.5" />
            </button>
            <!-- 年份选择 -->
            <div class="relative">
              <button
                class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white/70 border border-white/15 rounded-md hover:bg-white/10 transition-colors"
                @click.stop="showYearSelect = showYearSelect === 'left' ? null : 'left'"
              >
                {{ leftYear }}
                <UIcon name="i-lucide-chevron-down" class="w-3 h-3 text-white/40" />
              </button>
              <!-- 年份下拉 -->
              <div
                v-if="showYearSelect === 'left'"
                class="absolute top-full left-0 mt-1 w-16 max-h-40 overflow-y-auto bg-[#1e1e3e]/95 backdrop-blur-xl border border-white/15 rounded-md shadow-lg z-10"
              >
                <div
                  v-for="y in yearList"
                  :key="y"
                  class="px-2 py-1.5 text-xs cursor-pointer hover:bg-white/10 text-center"
                  :class="y === leftYear ? 'text-green-600 font-medium' : 'text-white/70'"
                  @click.stop="selectYear('left', y)"
                >{{ y }}</div>
              </div>
            </div>
            <button
              class="w-6 h-6 flex items-center justify-center rounded text-white/70 hover:bg-white/10 transition-colors"
              @click.stop="nextYear('left')"
            >
              <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- 开始提示 -->
          <div class="text-xs text-white/40 mb-2">
            {{ pickingStep === 'start' ? '请选择开始月份' : '已选 ✓' }}
          </div>

          <!-- 月份网格 3x4 -->
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="(m, idx) in MONTHS"
              :key="'l'+idx"
              type="button"
              :disabled="isDisabled('left', idx)"
              class="h-7 text-xs rounded flex items-center justify-center transition-all duration-150"
              :class="[
                isDisabled('left', idx)
                  ? 'text-white/20 cursor-not-allowed'
                  : isSelected('left', idx)
                    ? 'bg-green-500 text-white font-medium'
                    : isInRange('left', idx)
                      ? 'bg-green-50 text-green-700'
                      : 'text-white/70 hover:bg-white/10 cursor-pointer',
              ]"
              @click.stop="pickMonth('left', idx)"
            >{{ m }}</button>
          </div>
        </div>

        <!-- 右面板：结束月份 -->
        <div class="p-3 w-[200px]">
          <!-- 顶部控制栏 -->
          <div class="flex items-center justify-between mb-2">
            <button
              class="w-6 h-6 flex items-center justify-center rounded text-white/70 hover:bg-white/10 transition-colors"
              @click.stop="prevYear('right')"
            >
              <UIcon name="i-lucide-chevron-left" class="w-3.5 h-3.5" />
            </button>
            <div class="relative">
              <button
                class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white/70 border border-white/15 rounded-md hover:bg-white/10 transition-colors"
                @click.stop="showYearSelect = showYearSelect === 'right' ? null : 'right'"
              >
                {{ rightYear }}
                <UIcon name="i-lucide-chevron-down" class="w-3 h-3 text-white/40" />
              </button>
              <div
                v-if="showYearSelect === 'right'"
                class="absolute top-full left-0 mt-1 w-16 max-h-40 overflow-y-auto bg-[#1e1e3e]/95 backdrop-blur-xl border border-white/15 rounded-md shadow-lg z-10"
              >
                <div
                  v-for="y in yearList"
                  :key="y"
                  class="px-2 py-1.5 text-xs cursor-pointer hover:bg-white/10 text-center"
                  :class="y === rightYear ? 'text-green-600 font-medium' : 'text-white/70'"
                  @click.stop="selectYear('right', y)"
                >{{ y }}</div>
              </div>
            </div>
            <button
              class="w-6 h-6 flex items-center justify-center rounded text-white/70 hover:bg-white/10 transition-colors"
              @click.stop="nextYear('right')"
            >
              <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- 结束提示 -->
          <div class="text-xs text-white/40 mb-2">
            {{ pickingStep === 'start'
              ? '请先选择开始月份'
              : selectedEndMonth != null
                ? '已选 ✓'
                : '请选择结束月份'
            }}
          </div>

          <!-- 月份网格 3x4 -->
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="(m, idx) in MONTHS"
              :key="'r'+idx"
              type="button"
              :disabled="isDisabled('right', idx) || pickingStep === 'start'"
              class="h-7 text-xs rounded flex items-center justify-center transition-all duration-150"
              :class="[
                isDisabled('right', idx)
                  ? 'text-white/20 cursor-not-allowed'
                  : isSelected('right', idx)
                    ? 'bg-green-500 text-white font-medium'
                    : isInRange('right', idx)
                      ? 'bg-green-50 text-green-700'
                      : pickingStep === 'start'
                        ? 'text-white/20 cursor-not-allowed'
                        : 'text-white/70 hover:bg-white/10 cursor-pointer',
              ]"
              @click.stop="pickMonth('right', idx)"
            >{{ m }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
