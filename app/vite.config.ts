import path from "path"
import { connect as http2Connect } from "node:http2"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

/**
 * 把 /api/zhihu-oauth/* 走 HTTP/2 转发到 openapi.zhihu.com。
 * Vite 默认的 http-proxy 只能 HTTP/1.1，会被 Zhihu 边缘 LB 直接 405 拒掉。
 */
function zhihuOAuthHttp2Proxy(): Plugin {
  return {
    name: 'zhihu-oauth-http2-proxy',
    configureServer(server) {
      server.middlewares.use('/api/zhihu-oauth', (req, res) => {
        const upstreamPath = req.url || '/'
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(c as Buffer))
        req.on('end', () => {
          const body = Buffer.concat(chunks)
          const client = http2Connect('https://openapi.zhihu.com')
          client.on('error', (err) => {
            if (!res.headersSent) {
              res.statusCode = 502
              res.end(`upstream http2 error: ${String(err)}`)
            }
            client.close()
          })
          const headers: Record<string, string> = {
            ':method': (req.method || 'GET').toUpperCase(),
            ':path': upstreamPath,
            ':scheme': 'https',
            ':authority': 'openapi.zhihu.com',
            'user-agent': 'curl/8.5.0',
          }
          const ct = req.headers['content-type']
          if (ct) headers['content-type'] = Array.isArray(ct) ? ct[0] : ct
          const auth = req.headers['authorization']
          if (auth) headers['authorization'] = Array.isArray(auth) ? auth[0] : auth
          if (body.length > 0) headers['content-length'] = String(body.length)

          const stream = client.request(headers)
          if (body.length > 0) stream.write(body)
          stream.end()

          stream.on('response', (respHeaders) => {
            res.statusCode = Number(respHeaders[':status']) || 200
            for (const [k, v] of Object.entries(respHeaders)) {
              if (k.startsWith(':')) continue
              if (v === undefined) continue
              try { res.setHeader(k, v as string | string[]) } catch { /* ignore */ }
            }
          })
          stream.on('data', (chunk) => res.write(chunk))
          stream.on('end', () => {
            res.end()
            client.close()
          })
          stream.on('error', (err) => {
            if (!res.headersSent) {
              res.statusCode = 502
              res.end(`upstream stream error: ${String(err)}`)
            }
            client.close()
          })
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  return {
    base: './',
    plugins: [zhihuOAuthHttp2Proxy(), inspectAttr(), react()],
    server: {
      port: 3000,
      proxy: {
        '/api/zhihu': {
          target: 'https://developer.zhihu.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/zhihu/, ''),
          configure: (proxy) => {
            // 把浏览器自动加的 Origin/Referer 摘掉，
            // 让上游 nginx 看到的是一个「类 curl」的纯净请求。
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
              proxyReq.removeHeader('referer')
              proxyReq.setHeader('User-Agent', 'curl/8.0')
            })
          },
        },
        // /api/zhihu-oauth 由上面的 zhihuOAuthHttp2Proxy() 自定义中间件处理（HTTP/2）。
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
