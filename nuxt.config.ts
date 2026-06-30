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
      google: false,       // 禁用 Google Fonts
      googleicons: false,  // 禁用 Google Material Icons
      bunny: false,        // 禁用 Bunny Fonts
      fontshare: false,    // 禁用 FontShare
      fontsource: false,   // 禁用 FontSource
      adobe: false,        // 禁用 Adobe Fonts
      local: false,        // 禁用本地字体扫描
    },
    families: [],
  },

  // 修复 Windows 下 Vite 7 dev server 的 entry JS 路径问题
  // Nuxt 4 + Vite 7 在 Windows 上可能丢失 @fs/ 前缀导致 JS 加载失败
  vite: {
    server: {
      fs: {
        strict: false,
        allow: ['..'],
      },
    },
  },

  nitro: {
    experimental: {
      openAPI: true,
      websocket: true,
    },
  },
})
