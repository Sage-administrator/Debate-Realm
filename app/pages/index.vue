<script setup lang="ts">
// ════════════════════════════════════════════════════
// 首页 —— 落地页/产品介绍页（公开，无需登录）
// 默认入口即公开首页；已登录用户可通过顶部「进入仪表盘」进入后台
// ════════════════════════════════════════════════════

definePageMeta({ layout: false })

// 已登录态：首页 CTA 直接进仪表盘；未登录：进登录页
const store = useAuthStore()
const ctaTo = computed(() => (store.isAuthenticated ? '/home' : '/login'))

// 主标题：首屏即渲染完整文字（SSR 输出与首次绘制都包含完整标题），
// 不再依赖客户端 JS 水合后才逐字出现——之前打字机初始为空，会导致大标题空白数秒。
// 光标装饰保留，视觉上仍是「在输入」的观感，但内容零延迟可见、利于 SEO。
const part1 = '让辩论赛 '
const part2 = '更高效、更精彩'
const typed1 = ref(part1)
const typed2 = ref(part2)
</script>

<template>
  <div class="min-h-screen flex flex-col">
    
    <!-- 顶部导航栏（与公开赛事页共用 PublicHeader） -->
    <PublicHeader />

    <!-- 主内容区 -->
    <main class="flex-1 flex flex-col items-center justify-center px-4 pt-24 pb-16">
      <div class="max-w-4xl mx-auto text-center fade-in">
        
        <!-- 主标题 -->
        <div class="mb-8">
          <div class="flex flex-col items-center">
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] mb-6">
              <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span class="text-caption">专业的辩论赛管理平台</span>
            </div>
          </div>
          <h1 class="text-heading-1 text-[var(--color-text-primary)] mb-6 text-balance">
            {{ typed1 }}<span class="hero-gradient">{{ typed2 }}</span><span class="tw-cursor" />
          </h1>
          <p class="text-body text-[var(--color-text-secondary)] max-w-3xl mx-auto leading-relaxed paragraph-max-width">
            专业的辩论赛计时管理系统，集成高精度计时器、6种赛制自动赛程生成、
            报名管理、辩题投票、QQ频道机器人等核心功能。支持单败淘汰、双败淘汰、
            循环赛、佩寄制、瑞士制、小组+淘汰赛等多种赛制，提供从赛前准备、
            赛中计时到赛后统计的全流程解决方案。
          </p>
        </div>

        <!-- CTA 按钮组 -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <NuxtLink :to="ctaTo" class="btn-primary text-base px-8 py-3 flex items-center gap-2 w-full sm:w-auto justify-center">
            <UIcon name="i-lucide-rocket" class="w-5 h-5" />
            <span>立即开始</span>
          </NuxtLink>
          <NuxtLink to="/tournaments" class="btn-ghost text-base px-8 py-3 flex items-center gap-2 w-full sm:w-auto justify-center">
            <UIcon name="i-lucide-swords" class="w-5 h-5" />
            <span>浏览赛事</span>
          </NuxtLink>
          <a href="#features" class="btn-ghost text-base px-8 py-3 flex items-center gap-2 w-full sm:w-auto justify-center">
            <UIcon name="i-lucide-chevrons-down" class="w-5 h-5" />
            <span>了解更多</span>
          </a>
        </div>

        <!-- 功能特性卡片 -->
        <div id="features" class="features-grid text-left grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 section-content">
          
          <!-- 功能1：赛事管理 -->
          <div class="glass-card-strong p-8 border border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/30 hover:shadow-lg hover:shadow-[var(--color-accent-primary)]/5 transition-all duration-300 group lg:col-span-2 lg:row-span-1">
            <div class="flex items-start gap-6">
              <div class="w-16 h-16 rounded-xl feature-tile tile-indigo flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <UIcon name="i-lucide-trophy" class="w-8 h-8 text-[var(--color-accent-primary)]" />
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-bold text-[var(--color-text-primary)] mb-3">赛事管理</h3>
                <p class="text-base text-[var(--color-text-secondary)] leading-relaxed mb-4">
                  支持淘汰赛、循环赛等多种赛制，一键创建赛事，自动生成对阵图和赛程安排。
                </p>
                <div class="flex gap-2">
                  <UBadge label="多赛制" color="primary" size="xs" variant="soft" class="tag-square" />
                  <UBadge label="自动对阵" color="info" size="xs" variant="soft" class="tag-square" />
                </div>
              </div>
            </div>
          </div>

          <!-- 功能2：专业计时 -->
          <div class="glass-card-strong p-6 border border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/30 hover:shadow-lg hover:shadow-[var(--color-accent-primary)]/5 transition-all duration-300 group">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UIcon name="i-lucide-clock" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 class="text-lg font-bold text-[var(--color-text-primary)] mb-2">专业计时</h3>
            <p class="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              高精度辩论计时器，自定义环节时长，多种皮肤主题。
            </p>
          </div>

          <!-- 功能3：队伍管理 -->
          <div class="glass-card-strong p-6 border border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/30 hover:shadow-lg hover:shadow-[var(--color-accent-primary)]/5 transition-all duration-300 group">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/30 to-emerald-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UIcon name="i-lucide-users" class="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 class="text-lg font-bold text-[var(--color-text-primary)] mb-2">队伍管理</h3>
            <p class="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              多账号协作，子账号权限管理，队伍成员一目了然。
            </p>
          </div>

          <!-- 功能4：辩题投票 -->
          <div class="glass-card-strong p-6 border border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/30 hover:shadow-lg hover:shadow-[var(--color-accent-primary)]/5 transition-all duration-300 group">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UIcon name="i-lucide-vote" class="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 class="text-lg font-bold text-[var(--color-text-primary)] mb-2">辩题投票</h3>
            <p class="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              参赛队伍参与辩题选择，投票结果实时统计。
            </p>
          </div>

          <!-- 功能5：音频控制 -->
          <div class="glass-card-strong p-6 border border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/30 hover:shadow-lg hover:shadow-[var(--color-accent-primary)]/5 transition-all duration-300 group">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/30 to-rose-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UIcon name="i-lucide-volume-2" class="w-6 h-6 text-pink-600 dark:text-pink-400" />
            </div>
            <h3 class="text-lg font-bold text-[var(--color-text-primary)] mb-2">音效控制</h3>
            <p class="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              自定义开场、结束提醒音效，营造专业氛围。
            </p>
          </div>

          <!-- 功能6：QQ机器人 -->
          <div class="glass-card-strong p-6 border border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/30 hover:shadow-lg hover:shadow-[var(--color-accent-primary)]/5 transition-all duration-300 group">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-violet-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UIcon name="i-lucide-bot" class="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 class="text-lg font-bold text-[var(--color-text-primary)] mb-2">QQ机器人</h3>
            <p class="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              QQ频道机器人接入，赛事通知、报名一键触达。
            </p>
          </div>
        </div>

        <!-- 底部 CTA -->
        <div class="mt-16 glass-card-strong p-8 sm:p-10">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div class="text-center sm:text-left">
              <h3 class="text-heading-2 text-[var(--color-text-primary)] mb-2">准备好开始了吗？</h3>
              <p class="text-caption text-[var(--color-text-secondary)]">立即登录，体验专业的辩论赛管理系统</p>
            </div>
            <NuxtLink :to="ctaTo" class="btn-primary text-base px-8 py-3 flex items-center gap-2 whitespace-nowrap">
              <span>立即登录</span>
              <UIcon name="i-lucide-arrow-right" class="w-5 h-5" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </main>

    <!-- 页脚（与公开赛事页共用 PublicFooter） -->
    <PublicFooter />
  </div>
</template>

<style scoped>
/* 打字机光标：与主色一致，步进闪烁 */
.tw-cursor {
  display: inline-block;
  width: 0.1em;
  height: 0.95em;
  margin-left: 0.06em;
  background-color: var(--color-accent-primary);
  vertical-align: -0.1em;
  animation: tw-blink 1.05s step-end infinite;
}
@keyframes tw-blink {
  0%, 50% { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}
</style>
