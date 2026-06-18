<script setup lang="ts">
// 环节类型级联选择器 - 根据计时器类型.md 规格
// 双栏联动：左栏选类别，右栏选具体类型

interface CascaderCategory {
  label: string
  value: string
  items: { label: string; value: string; desc?: string }[]
}

interface Props {
  modelValue?: string | null
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择环节类型',
})

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
// 是否展开
const isOpen = ref(false)

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
  isOpen.value = false
}

// 打开时定位到当前值所在类别
function onOpen() {
  if (props.modelValue) {
    for (const cat of categories) {
      if (cat.items.find(i => i.value === props.modelValue)) {
        selectedCategory.value = cat.value
        break
      }
    }
  }
  isOpen.value = true
}

// 点击外部关闭
function onTriggerClick() {
  if (isOpen.value) {
    isOpen.value = false
  } else {
    onOpen()
  }
}

// 点击外部区域
function onBlurClose() {
  // 延迟以允许点击选项
  setTimeout(() => {
    isOpen.value = false
  }, 150)
}
</script>

<template>
  <div class="cascader-wrap" @focusin="onTriggerClick" tabindex="-1">
    <!-- 触发器：选择框 -->
    <div
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

    <!-- 下拉浮层 - 双栏联动 -->
    <div v-if="isOpen" class="cascader-dropdown" @click.stop @focusout="onBlurClose">
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
  border: 1px solid #D1D5DB;
  border-radius: 4px;
  background: #FFFFFF;
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
  color: #1F2937;
}

.cascader-placeholder {
  color: #9CA3AF;
}

.chevron-icon {
  width: 16px;
  height: 16px;
  color: #9CA3AF;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.chevron-icon--rotate {
  transform: rotate(180deg);
}

/* ===== 下拉浮层（双栏）===== */
.cascader-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 420px;
  z-index: 20;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  overflow: hidden;
}

/* 左栏：一级分类 */
.cascader-left {
  width: 120px;
  border-right: 1px solid #F3F4F6;
  padding: 4px 0;
  flex-shrink: 0;
}

.cascader-cat {
  padding: 10px 12px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #374151;
}

.cascader-cat:hover {
  background-color: #F9FAFB;
}

/* 选中项高亮（淡绿色背景 + 绿色文字）*/
.cascader-cat--active {
  color: #07C160;
  background-color: #E8F9EE;
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
  cursor: pointer;
  transition: all 0.15s;
  color: #374151;
}

.cascader-item:hover {
  background-color: #F9FAFB;
}

.cascader-item--active {
  color: #07C160;
  background-color: #ECFDF5;
  font-weight: 500;
}

.cascader-item-label {
  font-size: 14px;
  display: block;
}

.cascader-item-desc {
  font-size: 12px;
  color: #9CA3AF;
  display: block;
  margin-top: 2px;
  line-height: 1.4;
}
</style>
