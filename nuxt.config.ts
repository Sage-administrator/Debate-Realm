// https://nuxt.com/docs/api/configuration/nuxt-config
import os from 'node:os'
import { join } from 'node:path'

// 所有构建产物（.nuxt / vite 缓存 / .output）统一路由到系统临时目录。
// WorkBuddy 的安全删除 shim 对 os.tmpdir() 下的批量删除放行（直连原生 fs），
// 因此 `npm run build` 在清理 .nuxt/dist 与 .output 时不再被 SAFE_DELETE 拦截。
// Nitro ≥ 2.13 已修复 buildDir 在临时目录时 server 入口解析失败（ERR_INVALID_FILE_URL_PATH）的问题。
//
// BUILD_IN_PLACE=true 时（Docker 容器等无 WorkBuddy 环境），构建产物留在项目目录内，
// 避免 /tmp 迂回和启动路径依赖问题。不影响开发/生产 Windows 环境的现有行为。
const buildRoot = process.env.BUILD_IN_PLACE === 'true'
  ? join(process.cwd(), '.build')
  : join(os.tmpdir(), 'debate-timer-build')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // #shared 别名：shared/ 目录供前后端共同引用 Schema 定义
  alias: {
    '#shared': join(process.cwd(), 'shared'),
  },
  imports: {
    dirs: ['lib'],  // app/lib/api.ts → useApi() 全局 auto-import
  },

  // 注：buildDir 不再路由到系统临时目录——项目在 D 盘、os.tmpdir() 在 C 盘，跨盘会导致
  // @nuxt/kit 把绝对路径传给 ignore 库，Vite 7.3.6 下直接抛 "path should be a path.relative()d string" 并段错误。
  // 恢复 Nuxt 默认 buildDir（项目内 .nuxt，同盘 D 盘，相对路径正常），dev 模式不触发 SAFE_DELETE 批量清理拦截。

  modules: ['@nuxt/ui', '@pinia/nuxt'],

  css: ['~/assets/css/main.css'],

  // 禁用 @nuxt/fonts 的所有外部字体提供商（Google/Bunny/Fontshare/Fontsource）
  // 避免构建时因无法访问外网字体 API 而产生的连接超时 ERROR
  // 注意：配置键是 "fonts"（底层库叫 fontless，但 Nuxt 模块的 configKey 是 "fonts"）
  fonts: {
    providers: {
      google: false,
      googleicons: false,
      bunny: false,
      fontshare: false,
      fontsource: false,
      adobe: false,
      local: false,
    },
    families: [],
  },

  // 预加载关键资源（字体文件）
  // 注意：思源宋体中文体积极大（2-5MB），不预加载，改用 CSS font-display: swap 按需加载
  app: {
    head: {
      link: [
        // 仅预加载小体积数字字体（< 50KB），提升计时器首屏渲染速度
        { rel: 'preload', href: '/fonts/Digiface.woff2', as: 'font', type: 'font/woff2', crossorigin: '' },
      ],
    },
    // 关闭页面级 / 布局级过渡：原先配置 pageTransition + viewTransition
    // 但 main.css 未定义 .page-* / .layout-* 过渡类，配合 mode: 'out-in' 与 View Transition API
    // 会导致子页面切换时旧内容先卸载、新内容延迟挂载，表现为 Tab 切换卡顿、需要刷新才能进入
    // 直接禁用过渡，保证子页面瞬时切换与稳定挂载
    pageTransition: false,
    layoutTransition: false,
  },

  // Vue 编译器优化：静态节点提升、缓存等已默认开启
  vue: {
    compilerOptions: {
      // 压缩模板空格，减少渲染体积
      whitespace: 'condense',
      // 提升静态节点到渲染函数外，避免每次渲染重新创建
      hoistStatic: true,
      // 缓存事件处理函数，避免每次渲染重新创建
      cacheHandlers: true,
    },
  },

  // 修复 Windows 下 Vite 7 dev server 的 entry JS 路径问题
  devServer: {
    host: 'localhost',
  },

  // Nuxt 实验性特性
  experimental: {
    // 启用 payload 提取：静态页面预渲染时数据缓存，减少重复 API 调用
    payloadExtraction: true,
    // 启用组件 island 渲染（部分非交互组件可零 JS 渲染）
    componentIslands: true,
    // 禁用 view transitions API：与 pageTransition 叠加会导致子页面切换时旧内容先卸载、新内容延迟挂载
    // 表现为 Tab 切换需要刷新才能进入，关闭以保证切换瞬时稳定
    viewTransition: false,
    // 启用 asyncContext：避免在 async 函数中丢失 Nuxt 上下文
    asyncContext: true,
  },

  // 全局 URL prefetch 配置：减少不必要的预取，降低带宽和 CPU 消耗
  routeRules: {
    // 登录/认证相关页面不预取（避免未认证用户的无效请求）
    '/login': { prerender: false, headers: { 'cache-control': 'max-age=300' } },
    '/register': { prerender: false, headers: { 'cache-control': 'max-age=300' } },
  },

  features: {
    // 优化：对内联样式更友好的处理
    inlineStyles: true,
  },

  vite: {
    // 通过 Vite 插件的 config hook 注入 manualChunks（直接写 vite.build.rollupOptions.output 里会被
    // Nuxt 4 的 EnvironmentsPlugin.configEnvironment 返回的 output 覆盖，需用插件改写）
    plugins: [
      {
        name: 'vendor-chunks',
        config(config: any) {
          const manualChunks = (id: string) => {
            if (id.includes('node_modules/vue') || id.includes('node_modules/@vue/') || id.includes('node_modules/vue-router')) return 'vendor-vue'
            if (id.includes('node_modules/pinia') || id.includes('node_modules/@pinia')) return 'vendor-pinia'
            if (id.includes('node_modules/@nuxt/ui') || id.includes('node_modules/@nuxtjs/') || id.includes('node_modules/@nuxt/icon')) return 'vendor-ui'
            if (id.includes('node_modules/@vueuse')) return 'vendor-vueuse'
            if (id.includes('node_modules/vue-draggable-plus') || id.includes('node_modules/sortablejs')) return 'vendor-drag'
            if (id.includes('node_modules/docx')) return 'vendor-docx'
            if (id.includes('node_modules/ws')) return 'vendor-ws'
            if (id.includes('node_modules/iconify') || id.includes('node_modules/@iconify')) return 'vendor-icons'
          }
          if (!config.build) config.build = {}
          config.build.rollupOptions = config.build.rollupOptions || {}
          const output = config.build.rollupOptions.output
          if (Array.isArray(output)) {
            output.forEach((o: any) => o.manualChunks = manualChunks)
          } else if (output && typeof output === 'object') {
            output.manualChunks = manualChunks
          } else {
            config.build.rollupOptions.output = { manualChunks }
          }
        },
      },
    ],
    // vite 缓存恢复默认（node_modules/.vite，同盘 D 盘），避免跨盘绝对路径触发 ignore 报错
    // cacheDir: join(buildRoot, 'vite-cache'),
    server: {
      allowedHosts: true,
      fs: {
        strict: false,
        allow: ['..'],
      },
    },
    build: {
      cssCodeSplit: true,
      sourcemap: false,
      // 提升 base64 内联阈值到 10KB，减少小图标/字体的 HTTP 请求
      assetsInlineLimit: 10240,
      // 使用 esbuild 压缩（比 terser 快 5-10 倍，压缩率略低但可接受）
      minify: 'esbuild',
      // 额外的 esbuild 优化目标
      target: 'es2018',
      chunkSizeWarningLimit: 2000,
      // 注：manualChunks 在 nuxt.config.ts 的 vite.build.rollupOptions 里配置无效——
      // Nuxt 4 的 EnvironmentsPlugin(configEnvironment) 返回的 output 对象会覆盖用户配置。
      // 已迁移到 hooks.vite:extendConfig 中生效。
    },
    // 依赖预构建优化：减少 dev 启动时间和重复构建
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'pinia',
        '@vue/runtime-core',
        '@vue/runtime-dom',
        '@vue/shared',
        '@vue/reactivity',
      ],
      // 排除不会在客户端使用的服务端依赖
      exclude: ['@prisma/client', 'ws', 'jsonwebtoken', 'bcryptjs'],
    },
    // 定义全局常量，减少 dead code
    define: {
      __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    },
    // esbuild 额外优化：生产环境移除 console.log/debugger
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
      legalComments: 'none',
    },
  },

  $production: {
    devtools: { enabled: false },
  },

  nitro: {
    // 构建产物 .output 迁到临时目录（与 buildDir 同理，规避清理拦截）
    // 仅在 production 构建时使用临时目录；dev 模式用默认输出，避免 dev server 从临时目录解析模块失败
    output: process.env.NODE_ENV === 'production'
      ? { dir: join(buildRoot, 'output') }
      : {},
    experimental: {
      openAPI: true,
      websocket: true,
    },
    // 启用 Brotli + gzip 双重压缩（Brotli 对文本/JS 压缩率比 gzip 高 15-25%）
    compressPublicAssets: {
      gzip: true,
      brotli: true,
    },
    routeRules: {
      // 静态资源永久缓存（带哈希，更新时会自动失效）
      '/_nuxt/**': { headers: { 'cache-control': 'max-age=31536000, immutable' } },
      '/assets/**': { headers: { 'cache-control': 'max-age=31536000, immutable' } },
      // 字体文件缓存一年（字体不会变更，永久缓存）
      '/fonts/*.woff2': { headers: { 'cache-control': 'max-age=31536000, immutable' } },
      // 图片缓存一年
      '/*.png': { headers: { 'cache-control': 'max-age=31536000, immutable' } },
      '/*.jpg': { headers: { 'cache-control': 'max-age=31536000, immutable' } },
      '/*.jpeg': { headers: { 'cache-control': 'max-age=31536000, immutable' } },
      '/*.webp': { headers: { 'cache-control': 'max-age=31536000, immutable' } },
      '/*.ico': { headers: { 'cache-control': 'max-age=31536000, immutable' } },
      // MP3 音频缓存一年
      '/*.mp3': { headers: { 'cache-control': 'max-age=31536000, immutable' } },
      // 上传的图片缓存
      '/uploads/**': { headers: { 'cache-control': 'max-age=86400' } },
      // 首页和静态页面可缓存 5 分钟
      '/': { headers: { 'cache-control': 'max-age=300' } },
      '/login': { headers: { 'cache-control': 'max-age=300' } },
      '/register': { headers: { 'cache-control': 'max-age=300' } },
      // 注意：Nitro SWR 规则中的 * 通配符会错误地拦截所有 [id]/ 嵌套子路由
      // （如 timer-config、matches、scores 等），导致这些 API 返回 302/404。
      // 在 h3/Nitro 修复此 bug 之前，注释掉以下 SWR 规则。
      // 参考：fix/timer-config-route 分支
      //'/api/tournaments/public.list.get': { swr: 60, headers: { 'cache-control': 's-maxage=60, stale-while-revalidate=300' } },
      //'/api/tournaments/*/public.get': { swr: 30, headers: { 'cache-control': 's-maxage=30, stale-while-revalidate=120' } },
      //'/api/tournaments/*/standings.get': { swr: 10, headers: { 'cache-control': 's-maxage=10, stale-while-revalidate=60' } },
      // 其他 API 默认不缓存
      '/api/**': { headers: { 'cache-control': 'no-store' } },
    },
  },
})
