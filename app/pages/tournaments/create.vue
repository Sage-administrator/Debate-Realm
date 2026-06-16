<script setup lang="ts">
// 创建赛事页面 - 精简版（按用户需求移除高校/企业/其他、具体主办、参赛队伍、比赛地点、评委）
import { cityData } from '~~/app/data/cities'
import type { CityGroup } from '~~/app/data/cities'

const store = useAuthStore()
const toast = useToast()
const { createTournament } = useTournament()

const teamId = computed(() => store.user?.team?.id)

// ── 表单数据 ──
const form = reactive({
  // 赛事名称
  name: '',
  // 赛事地区 - 省市二级级联
  regionProvince: '',
  regionCity: '',
  // 举办周期 - MonthRangePicker
  startDate: '',
  endDate: '',
  // 主办方类别：仅保留 中小学 / 社会组织
  organizerCategory: '',
  // 赛事主办方
  organizer: '',
  // 赛制
  format: 'knockout',
  // 协议确认
  agreedToTerms: false,
})

const loading = ref(false)

// ── 城市级联数据 ──
// 根据选中的省份，获取对应的城市列表
const currentCities = computed(() => {
  if (!form.regionProvince) return []
  const group = cityData.find((g: CityGroup) => g.province === form.regionProvince)
  return group?.cities ?? []
})

// 省份变更时重置城市选择
watch(() => form.regionProvince, () => {
  form.regionCity = ''
})

// ── 主办方类别（仅保留中小学与社会组织） ──
const organizerCategoryOptions = [
  { label: '中小学', value: '中小学' },
  { label: '社会组织', value: '社会组织' },
]

// ── 赛制 ──
const formatOptions = [
  { label: '淘汰赛', value: 'knockout' },
  { label: '循环赛', value: 'round_robin' },
]

// ── 表单提交 ──
async function handleCreate() {
  // 验证必填字段
  if (!form.name.trim()) {
    toast.add({ title: '请输入赛事名称', color: 'error' })
    return
  }
  if (!form.regionProvince || !form.regionCity) {
    toast.add({ title: '请选择赛事地区', color: 'error' })
    return
  }
  if (!form.startDate || !form.endDate) {
    toast.add({ title: '请选择举办周期', color: 'error' })
    return
  }
  if (!form.organizerCategory) {
    toast.add({ title: '请选择主办方类别', color: 'error' })
    return
  }
  if (!form.organizer.trim()) {
    toast.add({ title: '请输入赛事主办方', color: 'error' })
    return
  }
  if (!form.agreedToTerms) {
    toast.add({ title: '请同意服务协议', color: 'error' })
    return
  }

  loading.value = true
  try {
    // 将 UI 字段拼接进 description
    const extendedInfo: string[] = []
    if (form.regionProvince && form.regionCity) {
      extendedInfo.push(`地区：${form.regionProvince} ${form.regionCity}`)
    }
    if (form.organizerCategory) extendedInfo.push(`主办方类别：${form.organizerCategory}`)
    if (form.startDate && form.endDate) extendedInfo.push(`举办周期：${form.startDate} 至 ${form.endDate}`)
    const description = extendedInfo.join('；')

    const result = await createTournament(teamId.value!, {
      name: form.name.trim(),
      description,
      format: form.format,
      scheduledAt: form.startDate ? `${form.startDate}-01` : undefined,
      venue: form.organizer.trim() || undefined,
    })

    toast.add({ title: '赛事创建成功', color: 'success' })
    await navigateTo(`/tournaments/${(result as any).id}`)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || e?.statusMessage || '创建失败', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 py-10">
    <!-- 页面标题区 -->
    <div class="max-w-[800px] mx-auto px-6 mb-6">
      <h1 class="text-2xl font-bold text-gray-900 leading-8">创建赛事</h1>
      <p class="text-sm text-gray-500 mt-2">快速开始创建赛事，填写以下信息完成创建</p>
    </div>

    <!-- 主表单卡片 -->
    <div class="max-w-[800px] mx-auto px-6">
      <div class="bg-white rounded-lg shadow-sm p-8 space-y-6">

        <!-- 1. 赛事名称 -->
        <div>
          <label class="block text-sm text-gray-700 mb-1.5">
            赛事名称 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            placeholder="请输入赛事名称"
            class="w-full h-10 px-3 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors placeholder:text-gray-400"
          />
          <p class="text-xs text-gray-400 mt-1.5">请不要在这里填写辩题，辩题将在赛事详情中设置</p>
        </div>

        <!-- 2. 赛事地区 - 省市二级级联 -->
        <div>
          <label class="block text-sm text-gray-700 mb-1.5">
            赛事地区 <span class="text-red-500">*</span>
          </label>
          <div class="flex gap-3">
            <!-- 省份选择 -->
            <div class="relative flex-1">
              <select
                v-model="form.regionProvince"
                class="w-full h-10 px-3 pr-10 text-sm border border-gray-300 rounded bg-white appearance-none cursor-pointer focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors"
                :class="form.regionProvince ? 'text-gray-900 border-green-500' : 'text-gray-400'"
              >
                <option value="" disabled>请选择省份</option>
                <option v-for="g in cityData" :key="g.province" :value="g.province">{{ g.province }}</option>
              </select>
              <UIcon name="i-lucide-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <!-- 城市选择 -->
            <div class="relative flex-1">
              <select
                v-model="form.regionCity"
                :disabled="!form.regionProvince"
                class="w-full h-10 px-3 pr-10 text-sm border border-gray-300 rounded bg-white appearance-none cursor-pointer focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                :class="form.regionCity ? 'text-gray-900 border-green-500' : 'text-gray-400'"
              >
                <option value="" disabled>{{ form.regionProvince ? '请选择城市' : '请先选择省份' }}</option>
                <option v-for="city in currentCities" :key="city" :value="city">{{ city }}</option>
              </select>
              <UIcon name="i-lucide-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <!-- 3. 举办周期 - MonthRangePicker -->
        <div>
          <label class="block text-sm text-gray-700 mb-1.5">
            举办周期 <span class="text-red-500">*</span>
          </label>
          <MonthRangePicker
            :start-date="form.startDate"
            :end-date="form.endDate"
            @update:start-date="form.startDate = $event"
            @update:end-date="form.endDate = $event"
          />
        </div>

        <!-- 4. 赛制 -->
        <div>
          <label class="block text-sm text-gray-700 mb-1.5">赛制</label>
          <div class="relative">
            <select
              v-model="form.format"
              class="w-full h-10 px-3 pr-10 text-sm text-gray-900 border border-gray-300 rounded bg-white appearance-none cursor-pointer focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors"
            >
              <option v-for="f in formatOptions" :key="f.value" :value="f.value">{{ f.label }}</option>
            </select>
            <UIcon name="i-lucide-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <!-- 5. 主办方类别 - Segmented Control（仅中小学/社会组织） -->
        <div>
          <label class="block text-sm text-gray-700 mb-1.5">
            主办方类别 <span class="text-red-500">*</span>
          </label>
          <div class="inline-flex bg-gray-100 rounded-md p-0.5 gap-0.5">
            <button
              v-for="cat in organizerCategoryOptions"
              :key="cat.value"
              type="button"
              class="px-4 py-1.5 text-sm rounded transition-all cursor-pointer"
              :class="form.organizerCategory === cat.value
                ? 'bg-white text-gray-900 font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'"
              @click="form.organizerCategory = cat.value"
            >
              {{ cat.label }}
            </button>
          </div>
        </div>

        <!-- 6. 赛事主办方 -->
        <div>
          <label class="block text-sm text-gray-700 mb-1.5">
            赛事主办方 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.organizer"
            type="text"
            placeholder="请输入主办单位名称"
            class="w-full h-10 px-3 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors placeholder:text-gray-400"
            :class="form.organizer ? 'border-green-500' : ''"
          />
        </div>

        <!-- 底部：协议 + 提交 -->
        <div class="pt-2 space-y-4">
          <!-- 协议勾选 -->
          <label class="inline-flex items-start gap-2 cursor-pointer group">
            <span class="relative flex items-center justify-center w-4 h-4 mt-0.5 shrink-0">
              <span
                class="absolute inset-0 rounded-sm border transition-colors"
                :class="form.agreedToTerms
                  ? 'bg-green-500 border-green-500'
                  : 'border-gray-300 group-hover:border-gray-400'"
              />
              <UIcon v-if="form.agreedToTerms" name="i-lucide-check" class="relative w-3 h-3 text-white" />
            </span>
            <input
              type="checkbox"
              v-model="form.agreedToTerms"
              class="sr-only"
            />
            <span class="text-xs text-gray-500 leading-relaxed">
              创建赛事即代表您已同意
              <span class="text-green-600 cursor-pointer hover:underline">服务协议</span>
              和
              <span class="text-green-600 cursor-pointer hover:underline">隐私政策</span>
            </span>
          </label>

          <!-- 提交按钮 -->
          <button
            type="button"
            class="w-full h-11 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-base font-medium rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="loading"
            @click="handleCreate"
          >
            <UIcon v-if="loading" name="i-lucide-loader" class="w-4 h-4 animate-spin" />
            <UIcon v-else name="i-lucide-plus" class="w-4 h-4" />
            {{ loading ? '创建中...' : '创建赛事' }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>
