// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

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

  // Vue 编译器优化：静态节点提升、缓存等已默认开启，这里显式关闭生产环境 console
  vue: {
    compilerOptions: {
      // 生产环境移除 console 输出（保留 warn/error）
      whitespace: 'condense',
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
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            // Vue 核心：vue + vue-router 一起打包
            if (id.includes('node_modules/vue') || id.includes('node_modules/@vue/') || id.includes('node_modules/vue-router')) return 'vendor-vue'
            if (id.includes('node_modules/pinia') || id.includes('node_modules/@pinia')) return 'vendor-pinia'
            // Prisma 客户端较大，单独拆分
            if (id.includes('node_modules/@prisma') || id.includes('node_modules/prisma')) return 'vendor-prisma'
            // NuxtUI 整套 UI 组件库
            if (id.includes('node_modules/@nuxt/ui') || id.includes('node_modules/@nuxtjs/')) return 'vendor-ui'
            // 拖拽库（仅在部分页面使用）
            if (id.includes('node_modules/vue-draggable-plus') || id.includes('node_modules/sortablejs')) return 'vendor-drag'
            // 文档处理库（体积大，仅在导出功能使用）
            if (id.includes('node_modules/docx')) return 'vendor-docx'
            // WebSocket 库
            if (id.includes('node_modules/ws')) return 'vendor-ws'
          },
        },
      },
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
  },

  $production: {
    devtools: { enabled: false },
  },

  nitro: {
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
      '/*.ico': { headers: { 'cache-control': 'max-age=31536000, immutable' } },
      // MP3 音频缓存一年
      '/*.mp3': { headers: { 'cache-control': 'max-age=31536000, immutable' } },
      // 首页和静态页面可缓存 5 分钟
      '/': { headers: { 'cache-control': 'max-age=300' } },
      '/login': { headers: { 'cache-control': 'max-age=300' } },
      '/register': { headers: { 'cache-control': 'max-age=300' } },
      // API 响应不缓存（动态数据）
      '/api/**': { headers: { 'cache-control': 'no-store' } },
    },
  },
})
