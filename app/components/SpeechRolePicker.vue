<script setup lang="ts">
// 发言方选择器（用于环节发言权限联动）
// 视觉：触发器与 RolePicker 同构；下拉面板为单列平铺的角色列表（带勾选框+分组标题+确定按钮），
// 不复用双栏级联，避免"点击文字切换分组"的交互。
// 分组：正方 / 反方 / 其他；多选，emit 角色 label 列表（如 ["正方一辩","评委"]）。

interface Props {
  modelValue?: string[]
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择发言方',
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const groups = [
  {
    label: '正方',
    value: 'positive',
    members: [
      { label: '一辩', value: '正方一辩' },
      { label: '二辩', value: '正方二辩' },
      { label: '三辩', value: '正方三辩' },
      { label: '四辩', value: '正方四辩' },
    ],
  },
  {
    label: '反方',
    value: 'negative',
    members: [
      { label: '一辩', value: '反方一辩' },
      { label: '二辩', value: '反方二辩' },
      { label: '三辩', value: '反方三辩' },
      { label: '四辩', value: '反方四辩' },
    ],
  },
  {
    label: '其他',
    value: 'other',
    members: [
      { label: '评委', value: '评委' },
      { label: '观众', value: '观众' },
    ],
  },
]

// 各分组已选角色（value 为角色 label）
const multiSelected = ref<Record<string, string[]>>({
  positive: [],
  negative: [],
  other: [],
})

const { isOpen, dropdownStyle, triggerRef, open, close } = useDropdown({
  minWidth: 240,
  offsetY: 4,
  dropdownClass: 'speech-role-picker-dropdown-global',
})

// 角色 label → 展示文案（正方一辩 → 正方 · 一辩；评委/观众原样）
function formatRole(label: string): string {
  if (label.startsWith('正方') || label.startsWith('反方')) {
    return `${label.slice(0, 2)} · ${label.slice(2)}`
  }
  return label
}

// 触发区文案：与 RolePicker 同构
function getDisplayText(): string {
  const arr = (props.modelValue as string[] | undefined) || []
  if (!arr.length) return props.placeholder
  // arr.length >= 1 时 arr[0] 一定存在
  if (arr.length === 1) return formatRole(arr[0]!)
  if (arr.length === 2) return `${formatRole(arr[0]!)}，${formatRole(arr[1]!)}`
  return `${arr.length} 人`
}

// 打开前从 modelValue 同步内部状态
function syncFromModel() {
  const arr = (props.modelValue as string[] | undefined) || []
  const map: Record<string, string[]> = { positive: [], negative: [], other: [] }
  for (const role of arr) {
    const g = groups.find((g) => g.members.some((m) => m.value === role))
    // g 和 g.value 都已在 find 成功时保证存在
    if (g && map[g.value!]) map[g.value!]!.push(role)
  }
  multiSelected.value = map
}

function onTriggerClick() {
  if (isOpen.value) {
    close()
    return
  }
  syncFromModel()
  open()
}

function findGroup(value: string) {
  return groups.find((g) => g.members.some((m) => m.value === value))
}

// 切换某角色的选中状态（按角色所在分组更新）
function toggleMember(value: string) {
  const g = findGroup(value)
  if (!g) return
  const list = multiSelected.value[g.value] || []
  const idx = list.indexOf(value)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(value)
  multiSelected.value = { ...multiSelected.value }
}

function isSelected(value: string): boolean {
  return Object.values(multiSelected.value).some((list) => list.includes(value))
}

// 确认：展平为角色 label 列表回写
function confirm() {
  const result: string[] = []
  for (const g of groups) {
    for (const m of g.members) {
      if ((multiSelected.value[g.value] || []).includes(m.value)) result.push(m.value)
    }
  }
  emit('update:modelValue', result)
  close()
}
</script>

<template>
  <div class="role-picker-wrap">
    <!-- 触发器：与 RolePicker 同构 -->
    <div
      ref="triggerRef"
      class="role-picker-trigger"
      :class="{ 'role-picker-trigger--open': isOpen }"
      @click="onTriggerClick"
    >
      <span
        :class="(modelValue as string[])?.length ? 'role-picker-value' : 'role-picker-placeholder'"
      >
        {{ getDisplayText() }}
      </span>
      <UIcon
        name="i-lucide-chevron-down"
        class="role-picker-chevron"
        :class="{ 'role-picker-chevron--rotate': isOpen }"
      />
    </div>

    <!-- 单列平铺下拉 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isOpen"
          class="role-picker-dropdown speech-role-picker-dropdown-global"
          :style="dropdownStyle"
          @click.stop
        >
          <div class="role-picker-right">
            <template v-for="g in groups" :key="g.value">
              <div class="speech-role-picker-group">{{ g.label }}</div>
              <div
                v-for="m in g.members"
                :key="m.value"
                class="role-picker-item"
                :class="{ 'role-picker-item--active': isSelected(m.value) }"
                @click="toggleMember(m.value)"
              >
                <span
                  class="role-picker-check"
                  :class="{ 'role-picker-check--checked': isSelected(m.value) }"
                >
                  <UIcon v-if="isSelected(m.value)" name="i-lucide-check" class="w-3 h-3" />
                </span>
                <span>{{ formatRole(m.value) }}</span>
              </div>
            </template>

            <!-- 确定按钮 -->
            <div class="role-picker-confirm-bar">
              <button class="role-picker-confirm-btn" @click="confirm">确定</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.speech-role-picker-group {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--rp-active-text, #07c160);
  background: var(--rp-hover-bg, rgba(0, 0, 0, 0.03));
  border-bottom: 1px solid var(--rp-divider, rgba(0, 0, 0, 0.06));
  border-top: 1px solid var(--rp-divider, rgba(0, 0, 0, 0.06));
}
</style>
