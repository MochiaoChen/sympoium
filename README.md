# 会饮 · Symposium

> 面向知乎创作者的全流程写作陪伴 Web 应用。

把一次完整的写作流程编排成 **六幕** —— 起意、择题、寻位、下笔、预演、出酒；每一幕由一位（或一组）AI Agent 主持，围绕用户的草稿轮流发言。核心体验不是「AI 替你写」，而是 **为作者显形其周围的世界**：上游显形（已有高赞答案占领了哪些位置）、下游显形（不同读者人格对草稿的段落级反应）、修订显形（把上游位置诊断与下游读者反应关联起来）。

---

## 六幕

| # | 幕 | 主持 Agent | 这一幕在做什么 |
|---|---|---|---|
| 1 | 起意 | 望气者 | 拉知乎热榜，依据登录用户的简介关键词重排，给你选定一个话题 |
| 2 | 择题 | 望气者 | 把话题展开成具体问题清单，标注饱和度与回答数 |
| 3 | 寻位 | 测绘师 / 问难者 | D3 答场星图：高赞答案聚类 → 已言说集 → 显著未言间隙 |
| 4 | 下笔 | 执笔者 | Obsidian Live-Preview 风格的 CodeMirror 编辑器 + 骨架侧栏 + 右侧 DeepSeek / 知乎直答双模式问答 |
| 5 | 预演 | 圆桌七人 | 七位读者人格 + 主编圆桌：段落热力图、留存预测、金句、主编综合 |
| 6 | 出酒 | 刘看山 | 终稿预览，导出 / 一键排版 |

---

## 技术栈

| 层级 | 选型 |
|---|---|
| 框架 | React 19 + TypeScript（strict 模式） |
| 构建 | Vite 7 |
| 样式 | Tailwind CSS 3 + shadcn/ui（new-york 风格） |
| 状态 | Zustand 5（单 store，跨幕共享） |
| 编辑器 | CodeMirror 6 + `@codemirror/lang-markdown` |
| 动画 | Framer Motion |
| 可视化 | D3.js（答场星图） |
| LLM | DeepSeek（默认）、Kimi（Moonshot），可在 Navbar 切换 |
| 数据源 | 知乎开放平台（OAuth、热榜、搜索、直答） |

---

## 快速开始

仓库根目录有一份 `.env` 文件（**已 gitignore**，需要本人手动配置）：

```ini
# LLM
DEEPSEEK_API_KEY=sk-xxx
KIMI_API_KEY=sk-kimi-xxx

# Zhihu
ZHIHU_ACCESS_SECRET=xxx               # 用于直答 / 热榜 / 搜索的 Bearer
ZHIHU_APP_ID=xxx                      # 黑客松渠道自动生成
ZHIHU_APP_KEY=xxx
ZHIHU_REDIRECT_URI=http://localhost:3000/   # 与 Zhihu 开发者后台注册值字字相同
```

`.env` 放在 **仓库根目录**（不是 `app/`），因为 `app/vite.config.ts` 用 `path.resolve(__dirname, '..')` 加载。

然后：

```bash
cd app
npm install
npm run dev      # http://localhost:3000
npm run build    # tsc -b && vite build → app/dist
npm run lint
```

没有测试框架。TypeScript 是 strict + `noUnusedLocals` + `noUnusedParameters` + `verbatimModuleSyntax`，未用 import 直接 fail build。

---

## 仓库结构

```
sympoium/
├── README.md                    # 你现在在读
├── AGENTS.md                    # AI 编码助手的工程指南（最详细的一份）
├── CLAUDE.md                    # Claude Code 专用速查
├── .env                         # 密钥（gitignored）
│
├── app/                         # Vite SPA
│   ├── src/
│   │   ├── App.tsx              # HashRouter + OAuth callback handler
│   │   ├── pages/Home.tsx       # 按 currentAct 渲染对应 Section
│   │   ├── sections/            # 七幕主体（核心业务代码）
│   │   ├── components/          # Navbar / Layout / AgentBadge / MarkdownEditor / ChatPanel ...
│   │   ├── store/               # Zustand 单一数据源
│   │   ├── services/api.ts      # 全部外部 API：知乎 / Kimi / DeepSeek
│   │   ├── data/agentPrompts.ts # 七位 Agent + 六位读者人格的系统 Prompt + AGENT_CONFIG
│   │   └── lib/                 # cn() + typography 工具
│   ├── public/avatars/          # 圆桌七人头像（运行时）
│   ├── tailwind.config.js       # 完整设计 token
│   └── vite.config.ts           # 含自定义 HTTP/2 中间件用于 Zhihu OAuth
│
└── docs/
    ├── PRD.md                   # 产品需求（七幕流程、Agent 人格、数据模型）
    ├── ui-guideline.md          # 硬规范级 UI 设计指南 + 反模式清单
    ├── plan.md                  # MVP Stage 划分
    ├── zhihu-api-reference.md   # 知乎开放平台接口手册
    ├── mockups/                 # 静态 HTML mockup（视觉北极星）
    └── personas/                # 七位读者人格肖像源文件
```

---

## 架构要点

**单页七幕。** `App.tsx` 挂 `HashRouter`，单路由 `/` 渲染 `Home.tsx`。`Home.tsx` 按 store 里的 `currentAct` 从 `ACT_COMPONENTS` 里挑对应 Section 渲染。`Layout.tsx` 包裹一切，提供顶栏（Navbar 时间轴）、底栏（BottomNav）、Framer Motion 幕切换动画、数字键 1–7 跳转。

**Zustand 单一数据源。** `useSymposiumStore` 持有全部跨幕状态（热榜、选定话题/问题、星图簇、间隙、骨架、草稿、段落反应、主编综合、知乎登录态、LLM provider 偏好）。所有 Section 通过 selector 读取，**不靠 props 透传**。

**所有外部调用都在 `services/api.ts`。** 知乎接口通过 Vite 代理（开发期）；新加 provider = 在 `vite.config.ts` 加 proxy + 在 `define` 加常量 + 在 `api.ts` 加调用。

**关键设计取舍：**

- **OAuth token exchange 走 HTTP/2** —— `openapi.zhihu.com` 对 HTTP/1.1 POST 直接 405，所以 `vite.config.ts` 里有一个自定义 `zhihuOAuthHttp2Proxy()` 插件用 `node:http2` 转发。
- **`zhida-thinking-1p5` 必须 streaming** —— 非 stream 模式下推理 17s 后被 TencentEdgeOne CDN 切回 554。`ChatPanel` 用 `callZhidaStream` 把 `reasoning_content` 和 `content` 分开累计。
- **Act 4 编辑器是 CodeMirror 6 + lang-markdown**，做 Obsidian Live Preview 风格的单栏实时预览；不是双栏拆分。
- **Agent prompts 强制 JSON-only 输出**；解析端 `callLLMJson` 自带 fence-stripping 兜底。

更深入的工程约定（命名、字体、颜色、反模式清单）请读 [`AGENTS.md`](./AGENTS.md) 和 [`docs/ui-guideline.md`](./docs/ui-guideline.md)。

---

## 部署

`npm run build` 输出到 `app/dist/`，是标准静态文件。

部署时必须重建以下代理（生产没有内置后端）：

| 路径 | 转发到 | 备注 |
|---|---|---|
| `/api/zhihu` | `https://developer.zhihu.com` | 走 HTTP/1.1 没问题（搜索、热榜、直答） |
| `/api/zhihu-oauth/*` | `https://openapi.zhihu.com` | **必须 HTTP/2**，否则 405 |
| `/api/kimi` | `https://api.moonshot.cn/v1` | |
| `/api/deepseek` | `https://api.deepseek.com` | |

LLM / Zhihu 的密钥目前是 build-time `define` 注入到前端 bundle 的 —— 任何能看到 JS 的人都能提取。生产化前应把所有外部调用搬到自有后端 / Edge Function，密钥放服务端。

---

## 相关文档

- [`AGENTS.md`](./AGENTS.md) — 给 AI 编码助手的完整工程指南（命名约定、强类型规则、反模式清单）
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code 的项目速查（启动命令、约束、最容易踩的坑）
- [`docs/PRD.md`](./docs/PRD.md) — 产品需求文档
- [`docs/ui-guideline.md`](./docs/ui-guideline.md) — UI 设计规范
- [`docs/zhihu-api-reference.md`](./docs/zhihu-api-reference.md) — 知乎开放平台接口手册
- [`docs/personas/README.md`](./docs/personas/README.md) — 圆桌七人头像对照表
