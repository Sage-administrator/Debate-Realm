// NuxtUI v4 组件级主题覆盖
// 使用 CSS 变量实现深浅色模式适配
// ponytail: as any — Nuxt UI v4 的 app.config 类型是由 #build/ui 运行时生成的，
// 静态类型检查无法推断扩展后的 slots/variants。运行时配置通过 tailwind-variants 合并正常工作。
export default defineAppConfig({
  ui: {
    // 卡片组件：使用 CSS 变量，支持深浅色模式
    card: {
      root: 'bg-[var(--color-bg-secondary)] backdrop-blur-xl border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-md)] text-[var(--color-text-primary)] contain-[layout,paint,style]',
      header: 'border-b border-[var(--color-border)] text-[var(--color-text-primary)]',
      body: 'text-[var(--color-text-secondary)]',
      footer: 'border-t border-[var(--color-border)]',
    } as any,
    // 模态框组件：使用 CSS 变量，支持深浅色模式
    modal: {
      content:
        'bg-[var(--color-surface-elevated)] backdrop-blur-xl border border-[var(--color-border-accented)] rounded-2xl text-[var(--color-text-primary)] shadow-[var(--shadow-xl)]',
      header: 'text-[var(--color-text-primary)]',
      title: 'text-[var(--color-text-primary)] font-bold',
      description: 'text-[var(--color-text-muted)]',
      body: 'text-[var(--color-text-secondary)]',
      footer: 'border-t border-[var(--color-border)]',
      overlay: 'bg-[var(--overlay-overlay)] backdrop-blur-sm',
    } as any,
    // 按钮组件：使用 CSS 变量，支持深浅色模式
    button: {
      neutral: {
        color: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]',
        outline:
          'border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
      },
    } as any,
    // 下拉菜单组件：使用 CSS 变量，支持深浅色模式
    dropdownMenu: {
      content:
        'bg-[var(--color-surface-elevated)] backdrop-blur-xl border border-[var(--color-border-accented)] rounded-xl text-[var(--color-text-primary)] shadow-[var(--shadow-xl)]',
      item: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-bg)]',
      itemActive: 'bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]',
      separator: 'border-[var(--color-border)]',
    } as any,
    // 选择菜单组件（SelectMenu）：使用 CSS 变量，支持深浅色模式
    selectMenu: {
      content:
        'bg-[var(--color-surface-elevated)] backdrop-blur-xl border border-[var(--color-border-accented)] rounded-xl text-[var(--color-text-primary)] shadow-[var(--shadow-xl)]',
      item: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-bg)]',
      itemActive: 'bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]',
      label: 'text-[var(--color-text-muted)]',
      separator: 'border-[var(--color-border)]',
    } as any,
    // Select 组件：使用 CSS 变量，支持深浅色模式
    select: {
      content:
        'bg-[var(--color-surface-elevated)] backdrop-blur-xl border border-[var(--color-border-accented)] rounded-xl text-[var(--color-text-primary)] shadow-[var(--shadow-xl)]',
      viewport: 'p-1',
      item: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-bg)] rounded-lg',
      itemActive: 'bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]',
      label: 'text-[var(--color-text-muted)] text-xs font-medium px-2 py-1.5',
      separator: 'border-[var(--color-border)] my-1',
    } as any,
    // 输入框组件：使用 CSS 变量，支持深浅色模式
    input: {
      base: 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text-primary)]',
      placeholder: 'text-[var(--color-text-muted)]',
    } as any,
    // 徽标组件：使用 CSS 变量，支持深浅色模式
    badge: {
      // 抬升过小字号，避免可访问性/可读性问题（原 xs=8px、sm=10px 均 < 12px 下限）
      variants: {
        size: {
          xs: { base: 'text-xs px-1.5 py-0.5' },
          sm: { base: 'text-xs px-2 py-1' },
        },
      },
      // soft 彩色徽标对比度修复：
      // Nuxt UI 默认 soft 用 `bg-${color}/10 text-${color}`（完整色值文字压在同色 10% 底上），
      // 亮色卡片上对比度仅约 2:1，文字几乎糊进底色；且 primary 默认=green，与 success 同色难区分。
      // 这里把文字压暗一档（-700 / 暗色 -300），并用 ! 提升优先级覆盖默认 compoundVariant 的 text-${color}。
      // neutral soft 用 text-default bg-elevated 本身可读，无需处理；solid/outline 不受影响。
      compoundVariants: [
        { color: 'primary', variant: 'soft', class: 'text-primary-700! dark:text-primary-200!' },
        {
          color: 'secondary',
          variant: 'soft',
          class: 'text-secondary-700! dark:text-secondary-200!',
        },
        { color: 'success', variant: 'soft', class: 'text-success-700! dark:text-success-300!' },
        { color: 'info', variant: 'soft', class: 'text-info-700! dark:text-info-300!' },
        { color: 'warning', variant: 'soft', class: 'text-warning-700! dark:text-warning-300!' },
        { color: 'error', variant: 'soft', class: 'text-error-700! dark:text-error-300!' },
      ],
    } as any,
  },
})
