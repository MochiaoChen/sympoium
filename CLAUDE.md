# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo Layout

This repo is a single Vite SPA living under `app/`. Run all build/dev commands from there.

```
app/                # the actual application
PRD.md              # product spec — seven-act flow, agent personas, data model
AGENTS.md           # detailed engineering guide (read this for deeper context)
ui_guildline.md     # hard UI rules (colors, fonts, anti-patterns)
知乎 api 手册.md     # Zhihu open-platform API reference
plan.md             # MVP staging plan
```

`AGENTS.md` is the authoritative engineering guide and includes a full anti-pattern list, key-file index, and security caveats. Consult it before non-trivial changes.

## Commands

```bash
cd app
npm run dev        # Vite dev server on port 3000, with API proxies
npm run build      # tsc -b && vite build → app/dist
npm run preview    # serve the built bundle
npm run lint       # ESLint
```

No test framework is configured. TypeScript is in strict mode with `noUnusedLocals` / `noUnusedParameters` / `verbatimModuleSyntax` — unused imports break the build.

## Environment

The `.env` file lives at the **repo root** (not under `app/`), because `vite.config.ts` loads env from `path.resolve(__dirname, '..')`. Vite injects keys at build time via `define` as globals: `__KIMI_API_KEY__`, `__DEEPSEEK_API_KEY__`, `__ZHIHU_ACCESS_SECRET__`, `__ZHIHU_APP_ID__`, `__ZHIHU_APP_KEY__`, `__ZHIHU_REDIRECT_URI__`. Both `FOO` and `VITE_FOO` names are accepted.

Dev-server proxies (defined in `vite.config.ts`) bypass CORS for `/api/zhihu`, `/api/zhihu-oauth`, `/api/kimi`, `/api/deepseek`. **There is no backend** — production deploys must replicate these proxies (Edge Functions / Nginx). Keys are baked into the client bundle today; treat that as MVP-only.

## Architecture

**Single-page, seven-act flow.** The product is structured as seven sequential "acts" (起意/择题/寻位/下笔/预演/重审/出酒). `App.tsx` mounts a `HashRouter` with one route; `pages/Home.tsx` renders one of `sections/Act1_…` through `Act6_Publish.tsx` based on `currentAct` in the Zustand store. `components/Layout.tsx` wraps everything with the top `Navbar` timeline, `BottomNav`, Framer Motion act transitions, and keyboard shortcuts (←/→ and 1–7).

**Single source of truth: `src/store/useSymposiumStore.ts`.** All cross-act state (hot list, selected topic/question, star-map answers, said/unsaid sets, skeleton, draft, paragraph reactions, editor-round results, etc.) lives here. Sections read via selectors — **do not pass act data through props**.

**All external calls in `src/services/api.ts`.** Zhihu + Kimi + DeepSeek go through the Vite proxies. Adding a new provider means: add a proxy in `vite.config.ts`, add a `define` constant, and add the call in `api.ts`.

**Agent prompts centralized in `src/data/agentPrompts.ts`.** Includes seven main agents (望气者/测绘师/问难者/执笔者/校雠/刘看山 + 众生读者人格组) plus utility prompts (skeleton generation, paragraph polish, quote hunter, global prediction). Prompts require **JSON-only output** (no Markdown fences). `AGENT_CONFIG` maps each agent codename (pinyin: `wangqi`, `cehui`, `wennan`, `zhibizhe`, `jiaochou`, `liukanshan`) to display name, signature color, and role label used by `AgentBadge`.

## Conventions That Bite

- **Language**: comments, prompts, UI copy in Chinese; identifiers in English or pinyin. Agent codenames are pinyin.
- **Typography**: Chinese body text uses **Noto Serif SC**, UI uses **Noto Sans SC**. Never substitute Inter/Roboto/Arial. Use Tailwind tokens (`font-serif`, `text-h1`, `bg-paper`, `text-ink-1`, `max-w-prose-narrow` …) — the design tokens are exhaustively defined in `tailwind.config.js`.
- **Agent speech UI**: whenever an agent "speaks", lead with `<AgentBadge>` (8×8 color dot + serif name). **No chat bubbles, no circular avatars, no emoji icons.** See `ui_guildline.md` §反模式 for the full prohibition list (no glassmorphism, no purple gradients, no "AI" stickers, no red-green heatmaps — use cyan→orange, etc.).
- **Backgrounds**: never pure white. Page = `#F7F4ED` (`bg-paper`), cards = `#FBF9F3`. Brand 绛红 `#5D2A2C` is reserved for primary CTA / active states / logo.
- **Motion**: signature easing `[0.22, 0.61, 0.36, 1]`, 200–300ms for interactions, ≤400ms for scene transitions. No `bounce`.
