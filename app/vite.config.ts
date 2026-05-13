import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  return {
    base: './',
    plugins: [inspectAttr(), react()],
    server: {
      port: 3000,
      proxy: {
        '/api/zhihu': {
          target: 'https://developer.zhihu.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/zhihu/, ''),
        },
        '/api/zhihu-oauth': {
          target: 'https://openapi.zhihu.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/zhihu-oauth/, ''),
        },
        '/api/kimi': {
          target: 'https://api.moonshot.cn/v1',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/kimi/, ''),
        },
        '/api/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/deepseek/, ''),
        },
      },
    },
    define: {
      __KIMI_API_KEY__: JSON.stringify(env.KIMI_API_KEY || env.VITE_KIMI_API_KEY || ''),
      __ZHIHU_ACCESS_SECRET__: JSON.stringify(env.ZHIHU_ACCESS_SECRET || env.VITE_ZHIHU_ACCESS_SECRET || ''),
      __DEEPSEEK_API_KEY__: JSON.stringify(env.DEEPSEEK_API_KEY || env.VITE_DEEPSEEK_API_KEY || ''),
      __ZHIHU_APP_ID__: JSON.stringify(env.ZHIHU_APP_ID || env.VITE_ZHIHU_APP_ID || ''),
      __ZHIHU_APP_KEY__: JSON.stringify(env.ZHIHU_APP_KEY || env.VITE_ZHIHU_APP_KEY || ''),
      __ZHIHU_REDIRECT_URI__: JSON.stringify(env.ZHIHU_REDIRECT_URI || env.VITE_ZHIHU_REDIRECT_URI || ''),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
