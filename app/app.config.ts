// NuxtUI v3 组件级主题覆盖
// 将 UCard / UModal 等组件的默认样式改为深色玻璃拟态
export default defineAppConfig({
  ui: {
    card: {
      root: 'bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg text-white/90',
      header: 'border-b border-white/10 text-white/90',
      body: 'text-white/80',
      footer: 'border-t border-white/10',
    },
    modal: {
      content: 'bg-[#1e1e3e]/95 backdrop-blur-xl border border-white/10 rounded-2xl text-white/90 shadow-2xl',
      header: 'text-white/90',
      title: 'text-white font-bold',
      description: 'text-white/50',
      body: 'text-white/80',
      footer: 'border-t border-white/10',
      overlay: 'bg-black/60 backdrop-blur-sm',
    },
    button: {
      neutral: {
        color: 'text-white/80 hover:bg-white/10',
        outline: 'border-white/20 hover:bg-white/10 text-white/80',
      },
    },
    dropdownMenu: {
      content: 'bg-[#1e1e3e]/95 backdrop-blur-xl border border-white/10 rounded-xl text-white/90 shadow-2xl',
      item: 'text-white/80 hover:bg-white/10',
      itemActive: 'bg-indigo-500/20 text-indigo-300',
      separator: 'border-white/10',
    },
    selectMenu: {
      content: 'bg-[#1e1e3e]/95 backdrop-blur-xl border border-white/10 rounded-xl text-white/90 shadow-2xl',
      item: 'text-white/80 hover:bg-white/10',
      itemActive: 'bg-indigo-500/20 text-indigo-300',
      label: 'text-white/50',
      separator: 'border-white/10',
    },
    input: {
      base: 'bg-white/5 border-white/15 text-white/90',
      placeholder: 'text-white/30',
    },
    badge: {
      neutral: 'bg-white/10 text-white/70',
    },
  },
})
