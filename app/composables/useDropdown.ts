/**
 * useDropdown — 下拉菜单通用逻辑（ponytail: 提取 RolePicker/StageTypeCascader 重复代码）
 * 功能：点击外部关闭、fixed 定位、窗口滚动/缩放时自动更新位置
 *
 * 用法：
 *   const { isOpen, dropdownStyle, triggerRef, dropdownClass, open, close, toggle } = useDropdown({
 *     minWidth: 280,
 *     offsetY: 4,
 *     dropdownClass: 'my-dropdown-global',
 *   })
 */
export function useDropdown(options: {
  minWidth?: number
  offsetY?: number
  dropdownClass: string
}) {
  const { minWidth = 280, offsetY = 4, dropdownClass } = options

  const isOpen = ref(false)
  const triggerRef = ref<HTMLElement | null>(null)
  const dropdownStyle = ref({ top: '0px', left: '0px', minWidth: `${minWidth}px` })

  // 更新下拉菜单位置（fixed 定位，脱离父容器 overflow 限制）
  function updatePosition() {
    if (!triggerRef.value) return
    const rect = triggerRef.value.getBoundingClientRect()
    dropdownStyle.value = {
      top: `${rect.bottom + offsetY}px`,
      left: `${rect.left}px`,
      minWidth: `${Math.max(rect.width, minWidth)}px`,
    }
  }

  // 点击外部关闭下拉
  function onClickOutside(e: MouseEvent) {
    if (!isOpen.value) return
    const target = e.target as HTMLElement
    if (triggerRef.value && !triggerRef.value.contains(target)) {
      const dropdown = document.querySelector(`.${dropdownClass}`)
      if (dropdown && !dropdown.contains(target)) {
        isOpen.value = false
      }
    }
  }

  // 打开下拉
  function open() {
    isOpen.value = true
    // 下一帧计算位置，确保 DOM 已渲染
    nextTick(() => updatePosition())
    // 延迟绑定全局事件，避免触发立即关闭
    setTimeout(() => {
      document.addEventListener('click', onClickOutside)
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
    }, 0)
  }

  // 关闭下拉
  function close() {
    isOpen.value = false
  }

  // 切换打开/关闭
  function toggle() {
    isOpen.value ? close() : open()
  }

  // 监听关闭时清理事件
  watch(isOpen, (open) => {
    if (!open) {
      document.removeEventListener('click', onClickOutside)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  })

  // 组件卸载时清理
  onUnmounted(() => {
    document.removeEventListener('click', onClickOutside)
    window.removeEventListener('resize', updatePosition)
    window.removeEventListener('scroll', updatePosition, true)
  })

  return {
    isOpen,
    dropdownStyle,
    triggerRef,
    dropdownClass,
    open,
    close,
    toggle,
    updatePosition,
  }
}
