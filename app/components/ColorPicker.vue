<!--
  自定义颜色选择器组件
  替代原生 input[type="color"]，提供更美观的深色主题 UI
  功能：
  - 预设颜色快速选择（24 色，6列布局）
  - 自定义颜色输入（HEX）
  - 色板预览
  - 自动边界检测，避免被裁剪
-->
<script setup lang="ts">
interface Props {
  modelValue: string
  label?: string
  presetColors?: string[]
  showInput?: boolean
  placement?: 'bottom-left' | 'bottom-right'
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  presetColors: () => [
    // 蓝色系
    '#3B82F6',
    '#2563EB',
    '#1D4ED8',
    '#0EA5E9',
    '#06B6D4',
    // 绿色系
    '#10B981',
    '#059669',
    '#22C55E',
    '#14B8A6',
    '#84CC16',
    // 紫色系
    '#8B5CF6',
    '#7C3AED',
    '#A855F7',
    '#EC4899',
    '#F472B6',
    // 暖色系
    '#F59E0B',
    '#EF4444',
    '#F97316',
    '#EAB308',
    '#FB923C',
    // 中性色
    '#FFFFFF',
    '#E5E7EB',
    '#9CA3AF',
    '#6B7280',
    '#374151',
    '#1F2937',
    '#111827',
    '#000000',
  ],
  showInput: true,
  placement: 'bottom-left',
})

const emit = defineEmits(['update:modelValue'])

const showPicker = ref(false)
const inputValue = ref(props.modelValue || '#3B82F6')
const pickerStyle = ref({})
const triggerRef = ref<HTMLElement | null>(null)
const pickerRef = ref<HTMLElement | null>(null)

// 同步外部值
watch(
  () => props.modelValue,
  (val) => {
    inputValue.value = val
  },
  { immediate: true },
)

// 计算弹出位置，避免被裁剪（fixed 定位，使用视口坐标）
function updatePosition() {
  if (!triggerRef.value || !pickerRef.value) return

  const triggerRect = triggerRef.value.getBoundingClientRect()
  const pickerRect = pickerRef.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // 水平位置：优先左对齐触发按钮
  let left = triggerRect.left

  // 检测右侧是否超出视口
  if (left + pickerRect.width > viewportWidth - 16) {
    // 右对齐触发按钮
    left = triggerRect.right - pickerRect.width
  }
  // 左侧也超出的话，贴左边缘
  if (left < 16) left = 16

  // 垂直位置：优先在下方
  // ponytail: 显式声明类型，不用 as any
  let top: number | string = triggerRect.bottom + 8
  let bottom: number | string = 'auto'

  // 检测底部是否超出视口
  // ponytail: 此时 top 仍为 number（未被重新赋值），断言为 number 参与运算
  if ((top as number) + pickerRect.height > viewportHeight - 16) {
    // 改在上方弹出
    top = 'auto'
    bottom = viewportHeight - triggerRect.top + 8
  }

  pickerStyle.value = {
    left: `${left}px`,
    top: top === 'auto' ? 'auto' : `${top}px`,
    bottom: bottom === 'auto' ? 'auto' : `${bottom}px`,
  }
}

// 打开面板
function openPicker() {
  showPicker.value = true
  // 下一帧更新位置（等 DOM 渲染后）
  nextTick(() => {
    updatePosition()
  })
}

// 选择预设颜色
function selectColor(color: string) {
  inputValue.value = color
  emit('update:modelValue', color)
}

// 手动输入颜色
function onInputChange() {
  const val = inputValue.value.trim()
  if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
    emit('update:modelValue', val)
  }
}

// 取色器引用（回退方案）
const colorPickerInputRef = ref<HTMLInputElement | null>(null)

// 判断浏览器是否支持 EyeDropper API
const isEyeDropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window

// 打开取色器：优先使用 EyeDropper API（屏幕取色），不支持则回退到原生 color input
async function openColorPicker() {
  // 先关闭弹出面板，避免遮挡屏幕取色
  showPicker.value = false

  if (isEyeDropperSupported) {
    try {
      // 使用 EyeDropper API 直接在屏幕上取色
      const eyeDropper = new (window as any).EyeDropper()
      const result = await eyeDropper.open()
      const color = result.sRGBHex.toUpperCase()
      inputValue.value = color
      emit('update:modelValue', color)
    } catch {
      // 用户取消取色，不做处理
    }
  } else if (colorPickerInputRef.value) {
    // 回退：触发原生颜色选择器
    colorPickerInputRef.value.click()
  }
}

// 回退方案：原生颜色选择器变化
function onColorPickerChange(e: Event) {
  const target = e.target as HTMLInputElement
  const color = target.value.toUpperCase()
  inputValue.value = color
  emit('update:modelValue', color)
}

// 点击外部关闭
function onClickOutside(e: MouseEvent) {
  if (
    triggerRef.value &&
    !triggerRef.value.contains(e.target as Node) &&
    pickerRef.value &&
    !pickerRef.value.contains(e.target as Node)
  ) {
    showPicker.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  window.addEventListener('resize', () => {
    if (showPicker.value) updatePosition()
  })
  window.addEventListener(
    'scroll',
    () => {
      if (showPicker.value) updatePosition()
    },
    true,
  )
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div ref="triggerRef" class="relative inline-block">
    <!-- 触发按钮：颜色预览 -->
    <button
      type="button"
      class="group w-11 h-11 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border)] transition-all overflow-hidden relative bg-[var(--color-bg-secondary)]"
      @click.stop="openPicker"
    >
      <!-- 当前颜色预览 -->
      <div
        class="w-full h-full transition-transform group-hover:scale-105"
        :style="{ backgroundColor: modelValue || '#3B82F6' }"
      />
      <!-- 边框高亮效果 -->
      <div
        class="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/10 group-hover:ring-white/20 pointer-events-none"
      />
    </button>

    <!-- 弹出面板 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-150 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition-all duration-100 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showPicker"
          ref="pickerRef"
          class="fixed z-[9999] w-60 bg-[var(--color-bg-secondary)]/95 backdrop-blur-xl rounded-xl border border-[var(--color-border)] shadow-2xl shadow-black/20 overflow-hidden"
          :style="pickerStyle"
          @click.stop
        >
          <!-- 预设颜色区 -->
          <div class="p-2.5 border-b border-[var(--color-border-muted)]">
            <div class="text-xs text-[var(--color-text-muted)] mb-2 font-medium">预设颜色</div>
            <div class="grid grid-cols-6 gap-1.5">
              <button
                v-for="color in presetColors"
                :key="color"
                class="w-full aspect-square rounded transition-all hover:scale-110 hover:z-10 ring-1 ring-inset ring-white/10 hover:ring-white/30 relative group/color"
                :style="{ backgroundColor: color }"
                :class="{
                  'ring-2 ring-blue-400 ring-offset-1 ring-offset-[var(--color-bg-secondary)] scale-105 z-10':
                    modelValue?.toLowerCase() === color.toLowerCase(),
                }"
                :title="color"
                @click="selectColor(color)"
              >
                <!-- 白色等浅色加个边框方便看 -->
                <div
                  v-if="['#FFFFFF', '#E5E7EB'].includes(color)"
                  class="absolute inset-0 rounded ring-1 ring-inset ring-black/10"
                />
              </button>
            </div>
          </div>

          <!-- 自定义输入 -->
          <div v-if="showInput" class="p-2.5">
            <div class="text-xs text-[var(--color-text-muted)] mb-2 font-medium">自定义颜色</div>
            <div class="flex items-center gap-2">
              <!-- 颜色预览（纯展示） -->
              <div
                class="w-8 h-8 rounded-lg ring-1 ring-inset ring-white/10 shrink-0 shadow-inner"
                :style="{ backgroundColor: inputValue || '#000000' }"
              />
              <!-- HEX 输入 -->
              <input
                v-model="inputValue"
                type="text"
                maxlength="7"
                placeholder="#FFFFFF"
                class="flex-1 min-w-0 px-2.5 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] font-mono placeholder-white/30 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase"
                @input="onInputChange"
                @blur="onInputChange"
                @keyup.enter="onInputChange"
              />
              <!-- 取色器按钮（独立滴管图标） -->
              <button
                type="button"
                class="w-8 h-8 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shrink-0 flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border)] transition-all"
                title="取色器"
                @click="openColorPicker"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m2 22 1-1h3l9-9" />
                  <path d="M3 21v-3l9-9" />
                  <path
                    d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"
                  />
                </svg>
              </button>
              <!-- 隐藏的原生取色器（仅在不支持 EyeDropper 时作为回退方案） -->
              <input
                v-if="!isEyeDropperSupported"
                ref="colorPickerInputRef"
                type="color"
                class="sr-only"
                :value="inputValue || '#000000'"
                @input="onColorPickerChange"
              />
            </div>
            <div class="text-xs text-[var(--color-text-muted)] mt-2">支持 HEX 格式，如 #3B82F6</div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
