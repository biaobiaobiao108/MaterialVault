<div align="center">

<img src="./public/logo.png" alt="Material Vault Logo" width="128" height="128" style="border-radius: 28px;" />

# Material Vault · 素材证据库

**专为视频创作者打造的：素材收件箱 + 网页证据归档库 + 极速标签检索系统**

[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go)](https://go.dev)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![SQLite FTS5](https://img.shields.io/badge/SQLite-FTS5-003B57?logo=sqlite)](https://sqlite.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-rose.svg)](./LICENSE)

</div>

---

## 📖 产品介绍

**Material Vault** 解决创作者在收集素材时的核心痛点：

```text
发现灵感/证据 → 两步内极速保存 (Ctrl+V，支持 #标签 自动归类) → 自动后台归档正文与快照 → 暂存 Inbox → 毫秒级 FTS5 搜索与标签过滤
```

### 核心特性

- ⚡ **零摩擦极速收集 (Capture Friction 最小化)**：
  - 复制链接直接 `Ctrl + V`（支持页面任意处全局粘贴捕获），无需等待即刻返回 202 保存成功；
  - 同一输入框支持自由记录灵感备忘（Note）、拖入本地文件或直接粘贴截图。
- 🏷️ **智能 `#标签` 自动提取与双向关联**：
  - 在输入框键入 `#` 即时弹出已有标签联想浮层，按 `Tab` / `Enter` 快捷上屏；
  - 保存时自动在数据库中创建不存在的标签并与素材双向关联；
  - 设置页内置「标签管理中心」，支持查看各标签关联素材量、快速重命名与清理。
- 🖼️ **素材卡片缩略图与悬浮快捷动作**：
  - 图片素材与网页截图在卡片直接渲染温润缩略图；
  - 鼠标悬浮即可「一键复制链接/正文」或「新标签页直达原网页」。
- 📋 **一键复制 AI 创作证据引用包**：
  - 证据详情弹窗支持一键将素材标题、来源、标签、备注及正文打包为标准 Markdown 引用块，无缝喂给写稿大模型。
- 🔍 **毫秒级防抖全文检索与多维过滤**：
  - 基于 SQLite FTS5 原生虚拟表与触发器，搜索框 250ms 防抖即时响应；
  - 动态展示当前生效的过滤条件胶囊条，支持一键移除或重置。
- 📦 **纯原生 Go 高性能内核与单二进制分发**：
  - 后端采用纯 Go 原生实现（零 CGO 依赖），常驻内存低至 **10MB ~ 25MB**；
  - 采用 SHA-256 原生内容散列进行资产物理去重；
  - 一键编译输出独立单可执行文件（`.exe` / Linux / Mac），用户无需安装 Node/Bun 环境，双击直接运行。
- 🛡️ **网页证据自动归档 (Archive Resilience)**：
  - 后台异步 Goroutine 流水线自动提取网页 Title、Meta 与 Clean Markdown 正文；
  - 遇到防爬/登录墙导致抓取失败时，**素材本体与笔记绝对不丢失**，提供显式的重新抓取入口。
- 🎨 **温润编辑部 UI 体系**：
  - Stone 纸张灰阶搭配 Rose 主强调色，全自动监听并实时自适应系统深浅色昼夜模式。

---

## 🛠️ 技术架构

本项目采用 **Go 原生后端 + React 18 SPA 前端** 现代架构：

| 领域 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **运行时与服务端** | `Go >= 1.22` (原生 `net/http`) | 纯原生高性能 HTTP 路由、异步 Goroutine 流水线与单二进制分发 |
| **数据库** | `modernc.org/sqlite` | 纯 Go 编写、无 CGO 依赖的嵌入式 SQLite，位于 `./data/vault.db` |
| **全文检索** | `SQLite FTS5` (unicode61) | 毫秒级标题、备注、URL 及正文全文检索，三向触发器自动同步 |
| **正文提取与转换** | `go-readability` + `html-to-markdown` | 网页 Clean Markdown 提取与证据归档 |
| **前端框架** | `React 18` + `TypeScript` + `Vite` | 极速现代前端单页应用，位于 `./src` |
| **数据请求** | `@tanstack/react-query` | 声明式数据获取与实时缓存管理 |
| **样式与图标** | `Tailwind CSS` + `Lucide Icons` | 遵循 Stone + Rose 温润编辑部设计规范 |

---

## 🚀 快速开始

### 1. 运行开发模式

运行完整应用（Go 后端启动在 `3000` 端口，自动托管 API 与前端静态资源）：

```bash
go run ./cmd/server
# 或使用 npm / bun 别名:
bun run dev
```

浏览器访问：`http://localhost:3000`

### 2. 前端独立热更新开发

```bash
# 启动 Vite 前端热更服务 (端口 5173，自动代理 /api 至 3000)
bun run dev:ui
```

### 3. 构建全量生产版本

执行一键构建（前端 Vite 打包 + Go 后端单一可执行程序输出至 `./bin/server.exe`）：

```bash
bun run build
```

### 4. 独立运行

生产环境下直接运行编译生成的单一二进制文件，**机器无需安装 Node/Bun 环境**：

```bash
./bin/server.exe
```

---

## 🧩 官方浏览器插件 (Chrome / Edge 扩展)

项目内置官方浏览器扩展程序（位于 `./extension` 目录，Manifest V3 规范，零编译步骤）：

1. 打开 Chrome/Edge 的扩展管理页（`chrome://extensions` 或 `edge://extensions`）；
2. 开启右上角 **「开发者模式」**；
3. 点击 **「加载已解压的扩展程序」**，选择本项目中的 `extension` 目录即可！
4. **功能特性**：
   - 快捷弹窗（Popup）：自动提取当前标题与 URL，支持输入 `#标签`、笔记与 `Ctrl + Enter` 保存；
   - 右键菜单：一键保存网页、选中文本或图片；
   - 快捷键：`Alt + S` 一键保存当前标签页。

---

## 📂 项目结构

```text
MaterialVault/
├── cmd/
│   └── server/              # Go 服务端主入口 (main.go)
├── internal/                # Go 内部业务与底层核心包
│   ├── config/              # 运行配置与路径管理
│   ├── db/                  # 数据层 (db.go, models.go, seed.go)
│   ├── handlers/            # REST API 路由处理器 (items, tags, search, assets, uploads, stats)
│   ├── services/            # 核心业务 (capture.go, storage.go, search.go)
│   └── utils/               # 响应封装、文本与 URL 清洗
├── data/                    # 本地数据目录 (已 gitignore)
│   ├── vault.db             # SQLite 数据库与 FTS5 虚拟表
│   └── assets/              # SHA-256 二进制文件去重存储池
├── extension/               # 官方浏览器扩展 (Manifest V3，免编译开箱即用)
├── public/                  # 静态资源 (小熊猫 mascot logo.png, favicon.png)
├── src/                     # React 前端代码
│   ├── components/          # 业务组件 (QuickCapture, ItemCard, Modals, BatchBar)
│   │   └── ui/              # 原子 UI 组件 (Button, Badge, Modal, ConfirmDialog, CustomSelect, DateInput)
│   ├── pages/               # 页面 (Inbox, Items, Search, Settings)
│   ├── lib/                 # 工具库 (api.ts, theme.tsx, types.ts, utils.ts)
│   ├── App.tsx              # 路由配置
│   └── index.css            # 基础样式与 Light/Dark 设计令牌
├── go.mod
├── go.sum
├── package.json
└── tsconfig.json
```

---

## 📜 开源协议

本项目采用 [MIT](./LICENSE) 协议开源。
