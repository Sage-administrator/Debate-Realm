<script setup lang="ts">
// 环节类型级联选择器 - 根据计时器类型.md 规格
// 双栏联动：左栏选类别，右栏选具体类型

// 级联类别数据结构
interface CascaderCategory {
  label: string                                              // 类别展示文本
  value: string                                              // 类别值
  items: { label: string; value: string; desc?: string }[]   // 该类别下的具体类型列表
}

// 组件入参定义
interface Props {
  modelValue?: string | null  // 当前选中的环节类型值
  placeholder?: string        // 占位提示文本
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择环节类型',
})

// 选中值变化时回写父组件
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// 级联数据：类别 - 具体类型
const categories: CascaderCategory[] = [
  {
    label: '常规',
    value: 'regular',
    items: [
      { label: '单方发言', value: 'single_speech', desc: '一方单独发言，正方或反方轮流' },
      { label: '单方发问', value: 'single_question', desc: '一方向另一方提问' },
      { label: '双边对辩', value: 'bilateral_debate', desc: '双方交替辩论' },
      { label: '自由辩论', value: 'free_debate', desc: '自由辩论环节' },
    ],
  },
  {
    label: '基类',
    value: 'base',
    items: [
      { label: '无计时器', value: 'no_timer', desc: '不设置计时器' },
      { label: '单计时器', value: 'single_timer', desc: '单个倒计时' },
      { label: '双计时器', value: 'double_timer', desc: '正反方各有独立计时器' },
    ],
  },
  {
    label: 'PPT图片',
    value: 'image',
    items: [
      { label: 'PPT平替', value: 'ppt_replace', desc: '使用图片替代PPT展示' },
    ],
  },
]

// 当前选中的类别 value
const selectedCategory = ref<string>('')

// ponytail: 使用共享的 useDropdown composable，减少 ~40 行重复代码
const { isOpen, dropdownStyle, triggerRef, open, close } = useDropdown({
  minWidth: 420,
  offsetY: 4,
  dropdownClass: 'stage-type-cascader-dropdown-global',
})

// 获取当前值的显示文本
function getDisplayText(value: string | null | undefined): string {
  if (!value) return props.placeholder
  for (const cat of categories) {
    const item = cat.items.find(i => i.value === value)
    if (item) return item.label
  }
  return props.placeholder
}

// 选择类别
function selectCategory(value: string) {
  selectedCategory.value = value
}

// 选择具体类型
function selectItem(value: string) {
  emit('update:modelValue', value)
  close()
}

// 打开时定位到当前值所在类别
function onTriggerClick() {
  if (isOpen.value) {
    close()
    return
  }
  // 打开前同步当前值
  if (props.modelValue) {
    for (const cat of categories) {
      if (cat.items.find(i => i.value === props.modelValue)) {
        selectedCategory.value = cat.value
        break
      }
    }
  }
  open()
}
</script>

<template>
  <div class="cascader-wrap" @focusin="onTriggerClick" tabindex="-1">
    <!-- 触发器：选择框 -->
    <div
      ref="triggerRef"
      class="cascader-trigger"
      @click="onTriggerClick"
      :class="{ 'cascader-trigger--open': isOpen }"
    >
      <span :class="modelValue ? 'cascader-value' : 'cascader-placeholder'">
        {{ getDisplayText(modelValue) }}
      </span>
      <UIcon
        name="i-lucide-chevron-down"
        class="chevron-icon"
        :class="{ 'chevron-icon--rotate': isOpen }"
      />
    </div>

    <!-- 下拉浮层 - 双栏联动：使用 Teleport 传送到 body，fixed 定位 -->
    <!-- 避免被父容器的 overflow:hidden 截断 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isOpen"
          class="cascader-dropdown stage-type-cascader-dropdown-global"
          :style="dropdownStyle"
          @click.stop
        >
          <!-- 左栏：类别 -->
          <div class="cascader-left">
            <div
              v-for="cat in categories"
              :key="cat.value"
              class="cascader-cat"
              :class="{ 'cascader-cat--active': selectedCategory === cat.value }"
              @click="selectCategory(cat.value)"
            >
              <span class="cascader-cat-label">{{ cat.label }}</span>
              <UIcon
                v-if="selectedCategory === cat.value"
                name="i-lucide-chevron-right"
                class="chevron-right"
              />
            </div>
          </div>

          <!-- 右栏：具体类型 -->
          <div class="cascader-right">
            <div v-if="!selectedCategory" class="cascader-placeholder">
              请选择类别
            </div>
            <template v-for="cat in categories.filter(c => c.value === selectedCategory)" :key="'items-' + cat.value">
              <div
                v-for="item in cat.items"
                :key="item.value"
                class="cascader-item"
                :class="{ 'cascader-item--active': modelValue === item.value }"
                @click="selectItem(item.value)"
              >
                <span class="cascader-item-label">{{ item.label }}</span>
                <span v-if="item.desc" class="cascader-item-desc">{{ item.desc }}</span>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ===== 级联选择器容器 ===== */
.cascader-wrap {
  position: relative;
  width: 100%;
}

/* ===== 触发器（选择框）===== */
.cascader-trigger {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  text-align: left;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px;
  background: rgba(255,255,255,0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.cascader-trigger:hover {
  border-color: #07C160;
}

.cascader-trigger--open {
  border-color: #07C160;
  box-shadow: 0 0 0 2px rgba(7, 193, 96, 0.2);
}

.cascader-value {
  color: rgba(255,255,255,0.9);
}

.cascader-placeholder {
  color: rgba(255,255,255,0.4);
}

.chevron-icon {
  width: 16px;
  height: 16px;
  color: rgba(255,255,255,0.4);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.chevron-icon--rotate {
  transform: rotate(180deg);
}
</style>

<!-- 下拉菜单样式使用非 scoped，因为 Teleport 到 body 下 -->
<style>
/* ===== 下拉浮层（双栏）：fixed 定位 + 高 z-index，脱离父容器 overflow 限制 ===== */
.cascader-dropdown {
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

/* 左栏：一级分类 */
.cascader-left {
  width: 120px;
  border-right: 1px solid rgba(255,255,255,0.1);
  padding: 4px 0;
  flex-shrink: 0;
}

.cascader-cat {
  padding: 10px 12px;
  margin: 2px 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(255,255,255,0.7);
  border-radius: 6px;
}

.cascader-cat:hover {
  background-color: rgba(255,255,255,0.05);
}

/* 选中项高亮（淡绿色背景 + 绿色文字）*/
.cascader-cat--active {
  color: #07C160;
  background-color: rgba(7, 193, 96, 0.15);
  font-weight: 500;
}

.chevron-right {
  width: 14px;
  height: 14px;
  color: #07C160;
  flex-shrink: 0;
}

/* 右栏：二级选项 */
.cascader-right {
  flex: 1;
  padding: 4px 0;
  min-width: 260px;
}

.cascader-placeholder {
  padding: 10px 12px;
  font-size: 14px;
  color: #9CA3AF;
}

.cascader-item {
  padding: 10px 12px;
  margin: 2px 4px;
  cursor: pointer;
  transition: all 0.15s;
  color: rgba(255,255,255,0.7);
  border-radius: 6px;
}

.cascader-item:hover {
  background-color: rgba(255,255,255,0.05);
}

.cascader-item--active {
  color: #07C160;
  background-color: rgba(7, 193, 96, 0.15);
  font-weight: 500;
}

.cascader-item-label {
  font-size: 14px;
  display: block;
}

.cascader-item-desc {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
  display: block;
  margin-top: 2px;
  line-height: 1.4;
}
</style>
