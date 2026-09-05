<script setup lang="ts">
// ════════════════════════════════════════════════════
// 创建独立赛事页 —— 个人用户创建赛事入口
// - 填写赛事名称、备注、比赛时间、赛事地区
// - 创建成功后跳转至赛事详情页
// ════════════════════════════════════════════════════
import { cityData } from '~~/app/data/cities'
import type { CityGroup } from '~~/app/data/cities'

const toast = useToast()
const { create: createStandaloneMatch } = useStandaloneMatches()

// ── 表单数据 ──
const form = reactive({
  name: '',
  description: '',
  scheduledAt: '',
  // 赛事地区 - 省市二级级联
  regionProvince: '',
  regionCity: '',
  // 对阵双方和辩题设置
  teamPositiveName: '',
  teamNegativeName: '',
  positiveTopic: '',
  negativeTopic: '',
})

const loading = ref(false)

// ── 表单错误（统一在组件下方显示红色小字） ──
const errors = reactive<{ [k: string]: string }>({
  name: '',
  region: '',
})

// 统一清除某字段错误
function clearError(key: string) {
  if (errors[key]) errors[key] = ''
}

// 赛事名称校验
function validateName() {
  const v = form.name.trim()
  if (!v) errors.name = '请输入赛事名称'
  else if (v.length < 2) errors.name = '赛事名称不少于2个字'
  else errors.name = ''
}

// 赛事地区校验
function validateRegion() {
  if (!form.regionProvince) {
    errors.region = '请选择赛事地区'
    return
  }
  const group = cityData.find((g: CityGroup) => g.province === form.regionProvince)
  const hasCities = !!(group?.cities && group.cities.length > 0)
  if (hasCities && !form.regionCity) {
    errors.region = '请选择城市'
  } else {
    errors.region = ''
  }
}

// 全量校验
function validateForm(): boolean {
  validateName()
  validateRegion()
  return !errors.name && !errors.region
}

async function handleCreate() {
  if (!validateForm()) return

  loading.value = true
  try {
    // 地区拼接：省 + 市（有城市时）
    let venue = ''
    if (form.regionProvince) {
      venue = form.regionCity ? `${form.regionProvince} ${form.regionCity}` : form.regionProvince
    }

    const result = await createStandaloneMatch({
      name: form.name.trim(),
      description: form.description || undefined,
      scheduledAt: form.scheduledAt || undefined,
      venue: venue || undefined,
    })

    // 创建成功后，保存对阵双方和辩题设置到 timer-config
    const matchId = (result as any).id
    if (matchId) {
      try {
        const authStore = useAuthStore()
        await $fetch<any>(`/api/standalone-matches/${matchId}/timer-config`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${authStore.token}` },
          body: {
            name: form.name.trim(),
            title: form.name.trim(),
            teamPositiveName: form.teamPositiveName || '',
            teamNegativeName: form.teamNegativeName || '',
            positiveTopic: form.positiveTopic || '',
            negativeTopic: form.negativeTopic || '',
            uiConfig: {},
            skinConfig: {},
            audioConfig: {},
            teamLogoConfig: {},
            stages: [],
          },
        })
      } catch (e) {
        // timer-config 保存失败不阻塞创建流程
        console.error('保存对阵信息失败:', e)
      }
    }

    toast.add({ title: '独立赛事创建成功', color: 'success' })
    await navigateTo(`/standalone/${matchId}`)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '创建失败', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- 最外层容器 -->
  <div class="min-h-screen">
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <!-- 页面标题区 -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-2">创建独立赛事</h1>
        <p class="text-[var(--color-text-secondary)] text-sm">
          快速创建一场独立比赛，填写以下信息完成创建
        </p>
      </div>

      <!-- 玻璃拟态卡片 -->
      <div class="glass-card-strong p-6 sm:p-8">
        <div class="space-y-6">
          <!-- 1. 赛事名称 -->
          <div>
            <label class="block text-[var(--color-text-secondary)] text-sm font-medium mb-1.5">
              赛事名称 <span class="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              placeholder="请输入赛事名称"
              class="input-glass w-full h-10"
              :class="errors.name ? '!border-red-400 focus:!border-red-400' : ''"
              @input="validateName"
              @blur="validateName"
            />
            <p v-if="errors.name" class="text-red-500 dark:text-red-400 text-xs mt-1.5">
              {{ errors.name }}
            </p>
          </div>

          <!-- 2. 比赛时间 + 3. 赛事地区（同一行，两列） -->
          <div class="grid grid-cols-2 gap-4">
            <!-- 左：比赛时间 -->
            <div>
              <label class="block text-[var(--color-text-secondary)] text-sm font-medium mb-1.5">
                比赛时间
              </label>
              <DatetimePicker v-model="form.scheduledAt" placeholder="请选择比赛时间" />
            </div>

            <!-- 右：赛事地区 - 省市二级级联 -->
            <div>
              <label class="block text-[var(--color-text-secondary)] text-sm font-medium mb-1.5">
                赛事地区 <span class="text-red-500 dark:text-red-400">*</span>
              </label>
              <div :class="errors.region ? 'ring-1 ring-red-400 rounded' : ''">
                <RegionCascader
                  :province="form.regionProvince"
                  :city="form.regionCity"
                  @update:province="
                    form.regionProvince = $event
                    clearError('region')
                  "
                  @update:city="
                    form.regionCity = $event
                    clearError('region')
                  "
                />
              </div>
              <p v-if="errors.region" class="text-red-500 dark:text-red-400 text-xs mt-1.5">
                {{ errors.region }}
              </p>
            </div>
          </div>

          <!-- 4. 备注 -->
          <div>
            <label class="block text-[var(--color-text-secondary)] text-sm font-medium mb-1.5">
              备注
            </label>
            <textarea
              v-model="form.description"
              placeholder="赛事备注（可选）"
              rows="3"
              class="input-glass w-full resize-none py-2"
            />
          </div>

          <!-- 5. 对阵双方和辩题设置 -->
          <div>
            <label class="block text-[var(--color-text-secondary)] text-sm font-medium mb-3">
              对阵双方和辩题设置
            </label>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[var(--color-text-secondary)] text-xs mb-1.5"
                  >正方队伍名</label
                >
                <input
                  v-model="form.teamPositiveName"
                  type="text"
                  placeholder="例：重庆大学"
                  class="input-glass w-full h-10"
                />
              </div>
              <div>
                <label class="block text-[var(--color-text-secondary)] text-xs mb-1.5"
                  >反方队伍名</label
                >
                <input
                  v-model="form.teamNegativeName"
                  type="text"
                  placeholder="例：中国科学院大学"
                  class="input-glass w-full h-10"
                />
              </div>
              <div>
                <label class="block text-[var(--color-text-secondary)] text-xs mb-1.5"
                  >正方辩题</label
                >
                <input
                  v-model="form.positiveTopic"
                  type="text"
                  placeholder="请输入正方辩题"
                  class="input-glass w-full h-10"
                />
              </div>
              <div>
                <label class="block text-[var(--color-text-secondary)] text-xs mb-1.5"
                  >反方辩题</label
                >
                <input
                  v-model="form.negativeTopic"
                  type="text"
                  placeholder="请输入反方辩题"
                  class="input-glass w-full h-10"
                />
              </div>
            </div>
          </div>

          <!-- 提交按钮 -->
          <button
            type="button"
            class="btn-primary w-full py-3 text-base font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="loading"
            @click="handleCreate"
          >
            <UIcon v-if="loading" name="i-lucide-loader" class="w-4 h-4 animate-spin" />
            <UIcon v-else name="i-lucide-plus" class="w-4 h-4" />
            {{ loading ? '创建中...' : '创建独立赛事' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
