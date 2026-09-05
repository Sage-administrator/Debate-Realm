<!--
  发言权限管理小组件（QQ 频道模式计时器页面）
  - 右下角暗色悬浮小方框，适配计时页视觉风格
  - 顶部赛场下拉框：赛场名作为绑定标识，选中后实际以 channelId 调用 API
  - 10 个角色按钮：正方一~四辩、反方一~四辩、评委、观众
  - 按钮颜色反映发言权限状态：绿=可发言 / 红=不可发言 / 灰=API 更新中
  - 点击按钮切换对应角色权限：先乐观置灰（更新中），API 返回后再更新为绿/红
-->
<template>
  <div
    class="fixed bottom-4 right-4 z-40 w-72 max-w-[90vw] rounded-lg border border-white/15 bg-black/55 backdrop-blur-md text-white shadow-2xl p-3 select-none"
  >
    <!-- 头部 -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold tracking-wide text-gray-100">发言权限管理</span>
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-200">QQ频道</span>
        <button
          class="text-gray-300 hover:text-white text-xs leading-none px-1"
          title="刷新"
          :disabled="loadingArenas || loadingRoles"
          @click="refresh"
        >
          ↻
        </button>
      </div>
    </div>

    <!-- 赛场选择下拉框（自定义暗色下拉，避免原生 select 展开态系统白底菜单） -->
    <div ref="selectWrap" class="relative">
      <button
        type="button"
        class="w-full flex items-center justify-between gap-2 rounded-md border border-white/15 bg-gray-900/70 text-white text-xs px-2 py-1.5 outline-none focus:border-sky-400 transition-colors"
        @click="toggleOpen"
      >
        <span class="truncate text-left">{{ selectedLabel }}</span>
        <svg
          class="w-3 h-3 shrink-0 opacity-70 transition-transform"
          :class="open ? 'rotate-180' : ''"
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M5.5 7.5 10 12l4.5-4.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <!-- 展开浮层：向上弹出，避免被屏幕底部裁切；沿用面板暗色玻璃风格 -->
      <div
        v-if="open"
        class="absolute bottom-full left-0 right-0 mb-1 z-50 rounded-md border border-white/15 bg-gray-900/90 backdrop-blur-md shadow-2xl max-h-60 overflow-auto py-1"
      >
        <div v-if="arenas.length === 0 && !loadingArenas" class="px-2 py-1.5 text-xs text-gray-400">
          暂无赛场
        </div>
        <button
          v-for="a in arenas"
          :key="a.channelId"
          type="button"
          class="w-full flex items-center justify-between gap-2 text-left px-2 py-1.5 text-xs transition-colors"
          :class="
            a.channelId === selectedChannelId
              ? 'bg-sky-500/15 text-white'
              : 'text-gray-100 hover:bg-sky-500/20 hover:text-white'
          "
          @click="selectArena(a)"
        >
          <span class="truncate">{{ a.name }}（{{ a.matchFormat }}）</span>
          <span v-if="a.channelId === selectedChannelId" class="text-sky-300 shrink-0">✓</span>
        </button>
      </div>
    </div>

    <!-- 联动状态条：当前环节发言方 + 手动应用按钮 -->
    <div
      v-if="activePlan"
      class="mt-1.5 flex items-center justify-between text-[10px] text-gray-300"
    >
      <span
        >联动 · 当前环节：<b class="text-gray-100">{{ speakerPlanText(activePlan) }}</b></span
      >
      <button
        class="px-1.5 py-0.5 rounded border border-white/15 hover:bg-white/10 transition-colors disabled:opacity-50"
        :disabled="applying || loadingRoles"
        title="按当前环节发言方重新套用发言权限"
        @click="applyCurrentStage"
      >
        应用当前环节
      </button>
    </div>

    <!-- 角色按钮区 -->
    <div class="mt-2">
      <div v-if="loadingRoles" class="text-[11px] text-gray-400 py-3 text-center">加载角色中…</div>
      <div v-else-if="error" class="text-[11px] text-red-300 py-3 text-center">{{ error }}</div>
      <div v-else-if="roles.length === 0" class="text-[11px] text-gray-400 py-3 text-center">
        {{ selectedChannelId ? '该赛场暂无角色' : '请先选择赛场' }}
      </div>
      <div v-else class="grid grid-cols-2 gap-1.5">
        <button
          v-for="role in roles"
          :key="role.id"
          class="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
          :class="permClass(role.permission)"
          :disabled="role.permission === 'updating' || !role.qqRoleId"
          :title="role.qqRoleId ? '点击切换发言权限' : '该角色未绑定 QQ 身份组'"
          @click="toggleRole(role)"
        >
          <span
            class="h-1.5 w-1.5 rounded-full shrink-0"
            :style="{ background: sideDot(role.side) }"
          />
          <span class="flex-1 text-left truncate">{{ role.label }}</span>
          <span class="text-[10px] opacity-80 shrink-0">{{ permGlyph(role.permission) }}</span>
        </button>
      </div>
    </div>

    <!-- 图例 -->
    <div v-if="roles.length" class="mt-2 flex items-center gap-3 text-[10px] text-gray-300">
      <span class="flex items-center gap-1"
        ><i class="inline-block h-2 w-2 rounded-full bg-green-500" />可发言</span
      >
      <span class="flex items-center gap-1"
        ><i class="inline-block h-2 w-2 rounded-full bg-red-500" />不可发言</span
      >
      <span class="flex items-center gap-1"
        ><i class="inline-block h-2 w-2 rounded-full bg-gray-500" />更新中</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { getStageSpeakerPlan, speakerPlanText, normRoleName } from '~/utils/speakerSide'

// ═══════════ 类型定义 ═══════════
interface ArenaOption {
  id: string
  name: string
  channelId: string
  guildId: string
  matchFormat: string
}

type RoleSide = 'affirmative' | 'negative' | 'judge' | 'audience'
type PermState = 'allowed' | 'denied' | 'updating'

interface RoleItem {
  id: string
  label: string
  side: RoleSide
  qqRoleId: string | null
  permission: PermState
}

// ═══════════ 状态 ═══════════
const auth = useAuthStore()
const toast = useToast()
const debate = useDebateStore()

const arenas = ref<ArenaOption[]>([])
const selectedChannelId = ref('')
const roles = ref<RoleItem[]>([])

// 自定义下拉展开态
const open = ref(false)
const selectWrap = ref<HTMLElement | null>(null)

const selectedLabel = computed(() => {
  const a = selectedArena.value
  if (a) return `${a.name}（${a.matchFormat}）`
  return loadingArenas.value ? '加载赛场中…' : '暂无赛场'
})

function toggleOpen() {
  open.value = !open.value
}
function closeOpen() {
  open.value = false
}
function selectArena(a: ArenaOption) {
  selectedChannelId.value = a.channelId
  open.value = false
}
const loadingArenas = ref(false)
const loadingRoles = ref(false)
const applying = ref(false)
const error = ref('')

const selectedArena = computed(
  () => arenas.value.find((a) => a.channelId === selectedChannelId.value) || null,
)

// 当前环节的发言方案（发言权限联动的驱动源）
const activePlan = computed(() => {
  const idx = (debate.currentStage || 1) - 1
  const stage = debate.stages?.[idx]
  return getStageSpeakerPlan(stage)
})

// 发言权限初始态：辩论常态下正方/反方/评委默认可发言，观众默认不可发言。
// 注意：后端未持久化单角色权限态，组件本地维护，点击后由 API 真实结果覆盖。
function defaultPermission(side: RoleSide): PermState {
  return side === 'audience' ? 'denied' : 'allowed'
}

// 阵营小圆点颜色（刻意避开绿/红，避免与权限态混淆）
function sideDot(side: RoleSide): string {
  switch (side) {
    case 'affirmative':
      return '#38bdf8' // 正方-天蓝
    case 'negative':
      return '#c084fc' // 反方-紫
    case 'judge':
      return '#fbbf24' // 评委-琥珀
    case 'audience':
      return '#94a3b8' // 观众-灰
  }
}

// 按钮配色：颜色严格反映发言权限状态
function permClass(state: PermState): string {
  switch (state) {
    case 'allowed':
      return 'border-green-500 bg-green-600/25 text-green-100 hover:bg-green-600/40'
    case 'denied':
      return 'border-red-500 bg-red-600/25 text-red-100 hover:bg-red-600/40'
    case 'updating':
      return 'border-gray-500 bg-gray-500/25 text-gray-300 cursor-wait'
  }
}

function permGlyph(state: PermState): string {
  return state === 'allowed' ? '✓' : state === 'denied' ? '✕' : '…'
}

// ═══════════ 数据加载 ═══════════
async function loadArenas() {
  loadingArenas.value = true
  error.value = ''
  try {
    const res = await $fetch<{ arenas?: any[] }>('/api/bot/arena/list', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    arenas.value = (res.arenas || []).map((a) => ({
      id: a.id,
      name: a.name,
      channelId: a.channelId,
      guildId: a.guildId,
      matchFormat: a.matchFormat,
    }))
    // 默认选中第一个赛场（以赛场名为展示标识）
    if (!selectedChannelId.value && arenas.value.length) {
      selectedChannelId.value = arenas.value[0]!.channelId
    }
  } catch {
    error.value = '赛场列表加载失败'
  } finally {
    loadingArenas.value = false
  }
}

async function loadRoles() {
  if (!selectedChannelId.value) {
    roles.value = []
    return
  }
  loadingRoles.value = true
  error.value = ''
  try {
    const res = await $fetch<{ arenas?: any[] }>('/api/bot/arena/status', {
      query: { channelId: selectedChannelId.value },
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    const arena = (res.arenas || []).find((a) => a.channelId === selectedChannelId.value)
    if (arena && arena.roles) {
      roles.value = arena.roles
        .slice()
        .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
        .map((r: any) => ({
          id: r.id,
          label: r.label,
          side: r.side as RoleSide,
          qqRoleId: r.qqRoleId || null,
          permission: defaultPermission(r.side as RoleSide),
        }))
    } else {
      roles.value = []
    }
    // 环节联动：套用当前环节发言方对应的发言权限
    if (activePlan.value) applyCurrentStage()
  } catch {
    error.value = '角色加载失败'
  } finally {
    loadingRoles.value = false
  }
}

function refresh() {
  loadArenas()
}

// 切换赛场 → 重新加载角色（watch 触发）
watch(selectedChannelId, () => {
  loadRoles()
})

// 当前环节发言方案变化 → 自动套用发言权限（联动）
watch(activePlan, (plan) => {
  if (plan && roles.value.length) applyCurrentStage()
})

// ═══════════ 按环节套用发言权限（联动核心） ═══════════
async function applyCurrentStage() {
  if (!selectedChannelId.value || roles.value.length === 0) return
  const plan = activePlan.value
  if (!plan) return
  // 计算目标可发言角色（label 列表）
  //  - roles：直接使用环节指定的发言方
  //  - both ：展开为当前赛场所有正方 + 反方辩手
  //  - default：空数组，后端套用默认权限（正方+反方+评委可发言，观众不可）
  let targetRoles: string[] = []
  if (plan.mode === 'roles') {
    targetRoles = plan.roles
  } else if (plan.mode === 'both') {
    targetRoles = roles.value
      .filter((r) => r.side === 'affirmative' || r.side === 'negative')
      .map((r) => r.label)
  }
  applying.value = true
  // 乐观：已绑定身份组的角色先置灰（更新中）
  roles.value.forEach((r) => {
    if (r.qqRoleId) r.permission = 'updating'
  })
  try {
    const res = await $fetch<{ allowed?: string[]; denied?: string[] }>(
      '/api/bot/permissions/apply-stage',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
        body: { channelId: selectedChannelId.value, targetRoles },
      },
    )
    const allowed = new Set((res.allowed || []).map(normRoleName))
    const denied = new Set((res.denied || []).map(normRoleName))
    roles.value.forEach((r) => {
      const lbl = normRoleName(r.label)
      if (allowed.has(lbl)) r.permission = 'allowed'
      else if (denied.has(lbl)) r.permission = 'denied'
    })
  } catch (e: any) {
    toast.add({
      title: e?.data?.statusMessage || e?.data?.message || '套用环节发言权限失败',
      color: 'error',
    })
    // 失败回滚：重新按默认态刷新
    await loadRoles()
  } finally {
    applying.value = false
  }
}

// ═══════════ 切换发言权限 ═══════════
async function toggleRole(role: RoleItem) {
  if (role.permission === 'updating' || !role.qqRoleId || !selectedArena.value) return

  // 当前可发言 -> 目标为禁止；当前不可发言 -> 目标为允许
  const prev = role.permission
  const nextAllow = prev !== 'allowed'

  // 乐观更新：立即置灰（更新中）
  role.permission = 'updating'
  try {
    await $fetch('/api/bot/permissions/set-role', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: {
        channelId: selectedChannelId.value,
        qqRoleId: role.qqRoleId,
        allow: nextAllow,
      },
    })
    // API 成功 -> 更新为最终颜色
    role.permission = nextAllow ? 'allowed' : 'denied'
  } catch (e: any) {
    // 失败 -> 回滚并提示
    role.permission = prev
    const msg = e?.data?.statusMessage || e?.data?.message || '切换发言权限失败'
    toast.add({ title: msg, color: 'error' })
  }
}

// ═══════════ 生命周期 ═══════════
function onDocClick(e: MouseEvent) {
  if (selectWrap.value && !selectWrap.value.contains(e.target as Node)) open.value = false
}
function onKeyEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeyEsc)
  loadArenas()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeyEsc)
})
</script>
