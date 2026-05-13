# 「会饮」Symposium — Agent 工程指南

> 本文档供 AI 编码助手阅读。如果你刚接手这个项目，请先读完此文件再动代码。

---

## 1. 项目概述

「会饮」（Symposium）是一个面向知乎创作者的全流程写作陪伴 Web 应用。产品把一次完整的写作流程编排成**七幕**（起意 → 择题 → 寻位 → 下笔 → 预演 → 重审 → 出酒），每一幕由一位（或一组）AI Agent 主持，围绕用户的草稿轮流发言。

核心体验不是"AI 替用户写"，而是**为作者显形其周围的世界**：上游显形（已有高赞答案占领了哪些位置）、下游显形（不同读者人格对草稿的段落级反应）、修订显形（把上游位置诊断与下游读者反应关联起来）。

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建工具 | Vite 7.2.4 |
| 样式 | Tailwind CSS 3.4.19 |
| UI 组件库 | shadcn/ui（`new-york` 风格，非 RSC） |
| 状态管理 | Zustand 5 |
| 动画 | Framer Motion |
| 可视化 | D3.js（答场星图） |
| 路由 | react-router-dom（HashRouter，单路由 `/`） |
| 图标 | Lucide React |
| 字体 | `@fontsource/noto-serif-sc`、`noto-sans-sc`、`jetbrains-mono` |

---

## 3. 目录结构

```
app/
├── index.html              # HTML 入口，加载 Google Fonts
├── vite.config.ts          # Vite 配置 + API 代理
├── tailwind.config.js      # 完整设计 token（颜色、字号、间距、字体）
├── components.json         # shadcn/ui 配置
├── postcss.config.js
├── eslint.config.js
├── tsconfig.json           # Project references（引用 tsconfig.app.json + tsconfig.node.json）
├── tsconfig.app.json       # 应用编译配置（strict: true, noUnusedLocals: true 等）
├── src/
│   ├── main.tsx            # 入口，createRoot 渲染 App，无 StrictMode
│   ├── App.tsx             # HashRouter，单路由挂载 Home
│   ├── index.css           # 全局样式、CSS 变量、scrollbar、中西文混排缓冲
│   ├── App.css             # 未使用，可忽略
│   ├── pages/
│   │   └── Home.tsx        # 主页面，根据 currentAct 动态渲染对应 Section
│   ├── sections/           # 七幕页面组件（核心业务代码）
│   │   ├── Act1_Inspiration.tsx      # 起意：热榜展示 + 话题选择
│   │   ├── Act2_QuestionSelect.tsx   # 择题：问题列表
│   │   ├── Act3_Position.tsx         # 寻位：D3 答场星图 + 间隙清单
│   │   ├── Act4_Draft.tsx            # 下笔：编辑器 + 骨架侧栏
│   │   ├── Act5_Rehearsal.tsx        # 预演：段落热力图 + 弹幕 + 预测
│   │   ├── Act6_Review.tsx           # 重审：圆桌会议布局
│   │   ├── Act7_Publish.tsx          # 出酒：预览 + 发布/导出
│   │   └── index.ts                  # 统一导出
│   ├── components/
│   │   ├── Navbar.tsx        # 顶栏 + 横向七幕时间轴
│   │   ├── BottomNav.tsx     # 底部导航（返回 / 下一步）
│   │   ├── Layout.tsx        # 页面框架 + Framer Motion 幕切换动画 + 键盘快捷键
│   │   ├── AgentBadge.tsx    # 角色徽标（色点 + 名字 + 职责）
│   │   ├── LoadingDots.tsx   # 加载动画（省略号跳动）
│   │   └── ui/               # shadcn/ui 组件（50+ 个，由 CLI 生成）
│   ├── store/
│   │   └── useSymposiumStore.ts   # Zustand 全局状态，持有七幕全部数据
│   ├── services/
│   │   └── api.ts            # 所有外部 API 调用：知乎 API + Kimi API
│   ├── data/
│   │   └── agentPrompts.ts   # 全部 Agent 系统 Prompt + AGENT_CONFIG 映射表
│   ├── hooks/
│   │   └── use-mobile.ts     # 响应式 hook（检测移动端）
│   └── lib/
│       └── utils.ts          # cn() 工具函数（clsx + tailwind-merge）
```

项目根目录下还有以下关键文档：
- `PRD.md` — 完整产品需求文档（七幕流程、Agent 人格、API 映射、数据模型）
- `ui_guildline.md` — 硬规范级 UI 设计指南（色彩、字体、间距、组件规格、反模式清单）
- `plan.md` — 构建计划（MVP 范围、Stage 划分）
- `知乎 api 手册.md` — 知乎开放平台接口文档（Bearer 鉴权、搜索、热榜等）
- `会饮-第六幕-mockup.html` — 第六幕圆桌会议的静态 HTML mockup，作为视觉北极星

---

## 4. 构建与运行

所有命令在 `app/` 目录下执行：

```bash
cd app

# 开发服务器（port 3000，带 API 代理）
npm run dev

# 生产构建（输出到 dist/）
npm run build

# 预览生产构建
npm run preview

# ESLint 检查
npm run lint
```

### 环境变量

项目根目录的 `.env` 文件（被 Vite 读取）需要以下变量：

```
KIMI_API_KEY=<你的 Kimi API Key>
ZHIHU_ACCESS_SECRET=<你的知乎 Access Secret>
ZHIHU_APP_ID=<知乎 App ID>
ZHIHU_APP_KEY=<知乎 App Key>
ZHIHU_REDIRECT_URI=<OAuth 回调地址>
```

Vite 配置中同时读取 `KIMI_API_KEY` / `VITE_KIMI_API_KEY` 以及 `ZHIHU_ACCESS_SECRET` / `VITE_ZHIHU_ACCESS_SECRET` 作为兼容。构建时这些值通过 `define` 注入为全局常量 `__KIMI_API_KEY__` 和 `__ZHIHU_ACCESS_SECRET__`。

**注意：`.env` 文件包含真实密钥，切勿提交到 Git。**

---

## 5. 架构与数据流

### 5.1 单页七幕架构

整个应用是**单页面应用**。`Home.tsx` 根据 `currentAct`（1–7）从 `ACT_COMPONENTS` 数组中取出对应的 Section 组件渲染。`Layout.tsx` 包裹全部内容，提供：

- 顶部固定 `Navbar`（品牌 + 七幕时间轴）
- 底部固定 `BottomNav`（返回 / 下一步 / 当前幕标题）
- 幕切换动画（Framer Motion `AnimatePresence`，水平位移 + 淡入淡出）
- 键盘快捷键：左右箭头切换幕，数字键 1–7 跳转

### 5.2 全局状态（Zustand）

`useSymposiumStore` 是**唯一数据源**，持有跨越七幕的全部状态：

| 状态域 | 对应幕 | 说明 |
|--------|--------|------|
| `hotList`, `selectedTopic` | 第 1 幕 | 知乎热榜、用户选定话题 |
| `selectedQuestion` | 第 2 幕 | 选定的具体问题 |
| `topAnswers`, `saidSet`, `unsaidSet`, `selectedGap` | 第 3 幕 | 高赞答案、已言说集、未言间隙、选定间隙 |
| `skeleton` | 第 4 幕 | 执笔者生成的结构化骨架 |
| `draft`, `targetCircle`, `paragraphReactions`, `globalPrediction`, `quoteHunterResult` | 第 5 幕 | 草稿、目标圈层、段落反应、全局预测、金句 |
| `editorRoundResult`, `roundtableSpeaking` | 第 6 幕 | 主编圆桌结果、当前发言人 |

所有 Section 组件都通过 Zustand selector 读取各自需要的状态，**不通过 props 层层传递**。

### 5.3 API 代理

`vite.config.ts` 中配置了两个开发服务器代理，用于绕过 CORS：

- `/api/zhihu` → `https://developer.zhihu.com`
- `/api/kimi` → `https://api.moonshot.cn/v1`

生产部署时，这些代理需要由部署平台（如 Nginx、Vercel rewrites）或独立后端提供。当前代码库**没有独立后端**，API 调用全部发生在浏览器端（通过代理）。

### 5.4 Agent 与 Prompt 组织

所有系统 Prompt 集中在 `src/data/agentPrompts.ts`，包括：

- 七位主 Agent：望气者、测绘师、问难者、执笔者、校雠、刘看山
- 六位读者人格（众生席）：考据组、抬杠侠、破防选手、截图怪、划走预备役、业内观察
- 通用 Prompt：全局预测、金句猎人、段落润色、骨架生成

每个 Prompt 都要求**严格 JSON-only 输出**，不含 Markdown。`AGENT_CONFIG` 对象同时维护每个 Agent 的显示名称、签名色、职责标签，供 `AgentBadge` 组件使用。

---

## 6. 代码风格与约定

### 6.1 语言

- **所有注释、文档、Prompt、UI 文案使用中文。** 变量和类型名使用英文（或拼音缩写，如 `cehui`、`wangqi`）。
- Agent 的内部代号使用拼音：`wangqi`（望气者）、`cehui`（测绘师）、`wennan`（问难者）、`zhibizhe`（执笔者）、`jiaochou`（校雠）、`liukanshan`（刘看山）。

### 6.2 样式规范

项目遵循一份非常严格的 UI 规范（`ui_guildline.md`），核心原则：

- **背景色**：`#F7F4ED`（宣纸米白），绝不用纯白做大面积背景。
- **品牌色**：绛红 `#5D2A2C`，仅用于关键 CTA、激活状态、logo。
- **字体**：中文正文用 **Noto Serif SC（思源宋体）**，UI 元素用 **Noto Sans SC（思源黑体）**。严禁使用 Inter、Roboto、Arial 作为主字体。
- **字号阶梯**：`display`(44px) > `h1`(32px) > `h2`(24px) > `h3`(20px) > `body-lg`(18px) > `body`(16px) > `ui`(14px) > `caption`(13px) > `micro`(12px)。
- **间距**：4pt 体系（4, 8, 12, 16, 24, 32, 48, 64, 96, 128）。
- **圆角**：默认 `4px`，极少例外。
- **动效签名曲线**：`[0.22, 0.61, 0.36, 1]`，普通交互 200–300ms，大型场景转换不超过 400ms。

Tailwind 配置已完整覆盖这些 token，请优先使用 Tailwind 类名（如 `bg-paper`, `text-ink-1`, `font-serif`, `text-h1`, `max-w-prose-narrow`）。

### 6.3 组件规范

- **角色徽标（AgentBadge）**：任何 Agent "说话"的地方，发言前必须带 `AgentBadge`。规格：8×8 色点 + 思源宋体 Medium 14px 名字 + 可选 caption。**禁止用圆形头像或 emoji。**
- **卡片**：背景 `#FBF9F3`，圆角 4px，边框 `1px solid #E8E3D8`，padding 24px，默认无阴影，hover 时极淡阴影。
- **按钮**：主按钮绛红底白字，次按钮透明底+墨色边框，文字按钮带下划线。
- **输入框**：背景 `#FBF9F3`，边框 `#E8E3D8`，focus 时边框变绛红，无 box-shadow。

### 6.4 反模式清单（严禁）

以下是被显式禁止的设计/代码模式：

1. 用 Inter / Roboto / Arial 作为中文产品主字体
2. 紫色或紫蓝渐变作为品牌色
3. "AI" 字样的 badge 或贴纸
4. 聊天气泡 + 圆形头像的对话 UI
5. 玻璃拟态（backdrop-filter blur）
6. 长文区域用纯白背景（一律 `#FBF9F3` 或 `#F7F4ED`）
7. 用 emoji 作为功能图标
8. 霓虹光晕 CTA 按钮
9. 热力图做成红绿双极（必须用青到橙渐变）
10. 12 列僵硬栅格
11. 动效中出现 bounce（spring 自然 overshoot 除外）
12. 默认暗黑模式
13. 角色徽标里用真实人脸或卡通形象
14. 刘看山用知乎官方 3D 卡通版本（必须用极简几何剪影）

### 6.5 TypeScript 严格模式

`tsconfig.app.json` 启用了：

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `verbatimModuleSyntax: true`
- `noUncheckedSideEffectImports: true`

**未使用的变量或导入会导致编译失败。**

---

## 7. 测试

当前项目**没有配置测试框架**（无 Jest、Vitest、Playwright、Cypress）。如果需要添加测试，建议在 `app/` 下安装 Vitest + @testing-library/react，并遵循现有 TypeScript 严格配置。

---

## 8. 部署

### 8.1 构建产物

`npm run build` 输出到 `app/dist/`，是标准的静态文件（HTML + JS + CSS + 字体）。

### 8.2 部署注意事项

1. **API 代理**：生产环境必须提供 `/api/zhihu` 和 `/api/kimi` 的代理，否则浏览器端直接请求会触发 CORS 错误。
2. **环境变量**：构建时需要注入 `KIMI_API_KEY` 和 `ZHIHU_ACCESS_SECRET`。
3. **HashRouter**：前端路由使用 HashRouter（`/#/`），部署到任何静态托管服务都无需服务端路由配置。
4. **字体**：Google Fonts 在 `index.html` 中通过 `<link>` 加载，确保部署环境能访问 `fonts.googleapis.com`。

### 8.3 推荐的部署平台

- Vercel / Netlify / Cloudflare Pages（静态托管 + Edge Functions 做 API 代理）
- 或自有服务器（Nginx 反向代理 + 静态文件服务）

---

## 9. 安全

- **密钥管理**：Kimi API Key 和知乎 Access Secret 在构建时通过 `define` 硬编码进前端 bundle。这意味着**任何能访问前端代码的用户都能提取这些密钥**。当前架构是 MVP 阶段的权宜之计，生产化时应迁移到：
  - 自建后端中转所有 API 请求，密钥保存在服务端；或
  - 使用 Edge Function / Serverless Function 做代理，密钥保存在环境变量中。
- **输入校验**：当前代码对用户输入（草稿、话题等）主要做前端校验，后端/API 层没有额外的清洗逻辑。
- **XSS**：React 的 JSX 转义提供了基础防护。草稿内容通过 `dangerouslySetInnerHTML` 渲染的地方（如有）需格外注意，目前代码中未使用。

---

## 10. 关键文件速查

| 想了解什么 | 读哪个文件 |
|------------|-----------|
| 产品逻辑与七幕流程 | `PRD.md` |
| 视觉设计规范 | `ui_guildline.md` |
| 知乎 API 接口详情 | `知乎 api 手册.md` |
| 全局状态与数据模型 | `app/src/store/useSymposiumStore.ts` |
| 所有 API 调用 | `app/src/services/api.ts` |
| 所有 Agent Prompt | `app/src/data/agentPrompts.ts` |
| 七幕路由与布局 | `app/src/pages/Home.tsx`、`app/src/components/Layout.tsx` |
| 答场星图实现 | `app/src/sections/Act3_Position.tsx` |
| 预演/弹幕/热力图 | `app/src/sections/Act5_Rehearsal.tsx` |
| 圆桌会议实现 | `app/src/sections/Act6_Review.tsx` |
| 设计 token（Tailwind） | `app/tailwind.config.js` |
| 全局样式与 CSS 变量 | `app/src/index.css` |

---

*本文档基于项目实际内容编写。若项目结构或技术栈发生变化，请及时更新此文件。*
