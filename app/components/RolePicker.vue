<script setup lang="ts">
// 角色选择器 - 双级联选择：正方/反方 + 一辩二辩/全体
// 用于：单方发言的"发言方"、单方发问的"发问人"和"接受人"

interface Props {
  modelValue?: string // 例如 "正方·一辩"、"反方·二辩"
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// 阵营 & 辩手
const sides = [
  { label: '正方', value: 'positive' },
  { label: '反方', value: 'negative' },
]

const debaters = [
  { label: '一辩', value: 'de1' },
  { label: '二辩', value: 'de2' },
  { label: '三辩', value: 'de3' },
  { label: '四辩', value: 'de4' },
  { label: '全体', value: 'all' },
]

const selectedSide = ref<string>('positive')
const selectedDebater = ref<string>('de1')
const isOpen = ref(false)

// 解析现有值
function parseValue(value: string | undefined): { side: string; debater: string } {
  if (!value) return { side: 'positive', debater: 'de1' }
  // 支持"正方·一辩"、"正方一辩"等格式
  for (const s of sides) {
    if (value.startsWith(s.label)) {
      const rest = value.replace(s.label, '').replace(/[·\/\s\-]/g, '')
      for (const d of debaters) {
        if (rest.includes(d.label)) {
          return { side: s.value, debater: d.value }
        }
      }
      return { side: s.value, debater: 'de1' }
    }
  }
  return { side: 'positive', debater: 'de1' }
}

// 获取显示文本
function getDisplayText(value: string | undefined): string {
  if (!value) return props.placeholder
  const { side, debater } = parseValue(value)
  const sideLabel = sides.find(s => s.value === side)?.label || ''
  const debaterLabel = debaters.find(d => d.value === debater)?.label || ''
  return `${sideLabel}·${debaterLabel}`
}

// 打开时初始化
function onOpen() {
  if (props.modelValue) {
    const { side, debater } = parseValue(props.modelValue)
    selectedSide.value = side
    selectedDebater.value = debater
  }
  isOpen.value = true
}

function onTriggerClick() {
  if (isOpen.value) {
    isOpen.value = false
  } else {
    onOpen()
  }
}

function selectSide(value: string) {
  selectedSide.value = value
}

function selectDebater(value: string) {
  selectedDebater.value = value
  // 确认
  const sideLabel = sides.find(s => s.value === selectedSide.value)?.label || ''
  const debaterLabel = debaters.find(d => d.value === value)?.label || ''
  emit('update:modelValue', `${sideLabel}·${debaterLabel}`)
  isOpen.value = false
}
</script>

<template>
  <div class="role-picker-wrap">
    <!-- 触发器 -->
    <div
      class="role-picker-trigger"
      @click="onTriggerClick"
      :class="{ 'role-picker-trigger--open': isOpen }"
    >
      <span :class="modelValue ? 'role-picker-value' : 'role-picker-placeholder'">
        {{ getDisplayText(modelValue) }}
      </span>
      <UIcon
        name="i-lucide-chevron-down"
        class="role-picker-chevron"
        :class="{ 'role-picker-chevron--rotate': isOpen }"
      />
    </div>

    <!-- 双栏下拉 -->
    <div v-if="isOpen" class="role-picker-dropdown" @click.stop>
      <!-- 左栏：阵营 -->
      <div class="role-picker-left">
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
        <div
          v-for="d in debaters"
          :key="d.value"
          class="role-picker-item"
          :class="{ 'role-picker-item--active': selectedDebater === d.value }"
          @click="selectDebater(d.value)"
        >
          {{ d.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-picker-wrap {
  position: relative;
  width: 100%;
}

/* 触发器 */
.role-picker-trigger {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  font-size: 16px;
  text-align: left;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  background: rgba(255,255,255,0.08);
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
  color: rgba(255,255,255,0.9);
}

.role-picker-placeholder {
  color: rgba(255,255,255,0.4);
}

.role-picker-chevron {
  width: 16px;
  height: 16px;
  color: rgba(255,255,255,0.5);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.role-picker-chevron--rotate {
  transform: rotate(180deg);
}

/* 下拉浮层 */
.role-picker-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 280px;
  z-index: 20;
  background: rgba(30, 30, 60, 0.95);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(20px);
  display: flex;
  overflow: hidden;
}

.role-picker-left {
  width: 100px;
  border-right: 1px solid rgba(255,255,255,0.1);
  padding: 4px 0;
}

.role-picker-side {
  padding: 10px 12px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.15s;
  color: rgba(255,255,255,0.7);
}

.role-picker-side:hover {
  background-color: rgba(255,255,255,0.05);
}

.role-picker-side--active {
  color: #07C160;
  background-color: rgba(7, 193, 96, 0.15);
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
}

.role-picker-item {
  padding: 10px 12px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  color: rgba(255,255,255,0.7);
}

.role-picker-item:hover {
  background-color: rgba(255,255,255,0.05);
}

.role-picker-item--active {
  color: #07C160;
  background-color: rgba(7, 193, 96, 0.15);
  font-weight: 500;
}
</style>
