# 「会饮」Symposium - 构建计划

## 概述
构建一个全流程知乎写作伙伴 Web 应用，核心是多 Agent 协作的写作陪伴体验。

## 技术栈
- React + TypeScript + Tailwind CSS + shadcn/ui
- Framer Motion（动画）
- D3.js（星图可视化）
- Kimi API (OpenAI compatible)

## 核心功能模块 (MVP)
- **第一/二幕 (简化)**: 话题选择与问题输入
- **第三幕 (核心)**: 测绘师 - 答场星图分析
- **第四幕**: 执笔者 - 结构化骨架生成
- **第五幕 (视觉巅峰)**: 众生 - 多人格读者预演（弹幕+热力图）
- **第六幕 (智识巅峰)**: 刘看山主编圆桌总结
- **第七幕**: 发布/导出

## Stage 1: 读取 vibecoding-webapp-swarm 技能
- 加载技能文件，了解构建规范

## Stage 2: 初始化项目 + 基础架构
- 初始化 Next.js 项目（使用 vibecoding-webapp-swarm）
- 安装依赖：framer-motion, d3, recharts
- 配置 Kimi API 客户端
- 构建核心数据模型和类型定义
- 构建全局状态管理 (Zustand)

## Stage 3: 核心页面构建
- 起意/择题页面（简化版）
- 寻位页面（星图可视化）
- 下笔页面（骨架生成）
- 预演页面（弹幕+热力图）
- 重审页面（圆桌会议）
- 出酒页面（发布/导出）

## Stage 4: AI 集成
- 集成 Kimi API 调用
- 实现各 Agent 的 prompt 模板
- 实现流式响应

## Stage 5: 部署
- 构建并部署到 Vercel
