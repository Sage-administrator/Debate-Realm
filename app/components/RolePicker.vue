<script setup lang="ts">
// 角色选择器 - 双级联选择：正方/反方 + 一辩二辩/全体
// 用于：单方发言的"发言方"、单方发问的"发问人"和"接受人"

// 组件入参定义
interface Props {
  modelValue?: string // 例如 "正方·一辩"、"反方·二辩"
  placeholder?: string // 占位提示文本
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择',
})

// 选中值变化时回写父组件
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

// 当前选中的阵营与辩手（内部状态）
const selectedSide = ref<string>('positive')
const selectedDebater = ref<string>('de1')

// ponytail: 使用共享的 useDropdown composable，减少 ~40 行重复代码
const { isOpen, dropdownStyle, triggerRef, open, close } = useDropdown({
  minWidth: 280,
  offsetY: 4,
  dropdownClass: 'role-picker-dropdown-global',
})

// 解析现有值：将"正方·一辩"等字符串解析为 side/debater 内部值
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
  // 分隔符 " · "（·前后各有一个空格）
  return `${sideLabel} · ${debaterLabel}`
}

// 触发器点击：打开前先同步当前值
function onTriggerClick() {
  if (isOpen.value) {
    close()
  } else {
    if (props.modelValue) {
      const { side, debater } = parseValue(props.modelValue)
      selectedSide.value = side
      selectedDebater.value = debater
    }
    open()
  }
}

// 选择阵营：仅更新内部状态，不立即触发回写
function selectSide(value: string) {
  selectedSide.value = value
}

// 选择辩手：组装最终值并回写父组件，随后关闭下拉
function selectDebater(value: string) {
  selectedDebater.value = value
  // 确认：分隔符 " · "（·前后各有一个空格）
  const sideLabel = sides.find(s => s.value === selectedSide.value)?.label || ''
  const debaterLabel = debaters.find(d => d.value === value)?.label || ''
  emit('update:modelValue', `${sideLabel} · ${debaterLabel}`)
  close()
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
      <span :class="modelValue ? 'role-picker-value' : 'role-picker-placeholder'">
        {{ getDisplayText(modelValue) }}
      </span>
      <UIcon
        name="i-lucide-chevron-down"
        class="role-picker-chevron"
        :class="{ 'role-picker-chevron--rotate': isOpen }"
      />
    </div>

    <!-- 双栏下拉：使用 Teleport 传送到 body，使用 fixed 定位 -->
    <!-- 避免被父容器的 overflow:hidden 截断 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isOpen"
          class="role-picker-dropdown role-picker-dropdown-global"
          :style="dropdownStyle"
          @click.stop
        >
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
      </Transition>
    </Teleport>
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
</style>

<!-- 下拉菜单样式使用非 scoped，因为 Teleport 到 body 下 -->
<style>
/* 下拉浮层：fixed 定位 + 高 z-index，脱离父容器 overflow 限制 */
.role-picker-dropdown {
  position: fixed;
  z-index: 1000;
  background: rgba(30, 30, 60, 0.95);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  display: flex;
  overflow: hidden;
}

/* 淡入淡出动画 */
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
  border-right: 1px solid rgba(255,255,255,0.1);
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
  color: rgba(255,255,255,0.7);
  border-radius: 6px;
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
  margin: 2px 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  color: rgba(255,255,255,0.7);
  border-radius: 6px;
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
