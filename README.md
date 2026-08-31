<div align="center">

<img src="./public/logo.png" alt="Material Vault Logo" width="128" height="128" style="border-radius: 28px;" />

# Material Vault · 素材证据库

**专为视频创作者打造的：素材收件箱 + 网页与视频证据归档库 + 极速标签检索系统**

[![Bun Version](https://img.shields.io/badge/Bun-1.2+-fbf0df?logo=bun)](https://bun.sh)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![SQLite FTS5](https://img.shields.io/badge/SQLite-FTS5-003B57?logo=sqlite)](https://sqlite.org)
[![Showcase Page](https://img.shields.io/badge/Showcase-GitHub%20Pages-rose)](https://biaobiaobiao108.github.io/MaterialVault/)
[![License: MIT](https://img.shields.io/badge/License-MIT-rose.svg)](./LICENSE)

[🌐 访问在线介绍展示页 (GitHub Pages)](https://biaobiaobiao108.github.io/MaterialVault/)

</div>

---

## 📖 产品介绍

**Material Vault** 专为视频创作者解决灵感记录、证据抓取与素材检索的核心痛点：

```text
发现灵感/证据/视频 → 两步内极速保存 (Ctrl+V，支持 #标签 自动归类) → 自动后台归档正文与高清封面 → 暂存 Inbox → 毫秒级 FTS5 搜索与标签过滤
```

### 核心特性

- ⚡ **零摩擦极速收集 (Capture Friction 最小化)**：
  - 复制链接直接 `Ctrl + V`（支持页面任意处全局粘贴捕获），无需等待即刻返回 202 保存成功；
  - 同一输入框支持自由记录灵感备忘（Note）、拖入本地文件或直接粘贴截图。
- 🎬 **Bilibili / YouTube 视频原生高清封面与证据归档**：
  - 自动识别 Bilibili（`bilibili.com`、`b23.tv` 短链重定向展开）与 YouTube 视频链接；
  - 自动解析并下载 UP 主/创作者原生上传的 **1080P/720P 级别最高清封面**（杜绝网页截图与带黑边的缩略图），存入本地 SHA-256 去重资产库；
  - 卡片顶部 16:9 比例展示高清封面与 Glassmorphism 半透明播放徽标，详情页支持一键直达原平台播放。
- 🧱 **0 空隙响应式 3 列卡片瀑布流 (Masonry Grid)**：
  - 智能解决视频大卡片与纯文本小卡片混排时的行高空白问题；
  - 按左右轮流由新到旧紧凑堆叠排版，在桌面端（3 列）、平板端（2 列）与移动端（1 列）自适应流畅呈现。
- 📝 **Markdown 富文本排版渲染与双模式切换**：
  - 卡片与详情弹窗全面内置现代 GFM Markdown 渲染引擎，支持标题、列表、表格、代码块与引用块排版；
  - 提供**「排版预览 / 查看源码」**一键双模式切换与 Markdown 证据文件直接下载。
- 🏷️ **智能 `#标签` 自动提取与双向关联**：
  - 在输入框键入 `#` 即时弹出已有标签联想浮层，按 `Tab` / `Enter` 快捷上屏；
  - 保存时自动在数据库中创建不存在的标签并与素材双向关联；
  - 设置页内置「标签管理中心」，支持查看各标签关联素材量、快速重命名与清理。
- 🔍 **毫秒级防抖全文检索与多维过滤**：
  - 基于 SQLite FTS5 原生虚拟表与触发器，搜索框 250ms 防抖即时响应；
  - 动态展示当前生效的过滤条件胶囊条，支持一键移除或重置。
- ⚡ **原生 Bun 全栈内核与零外部依赖**：
  - 后端全面采用 TypeScript + Bun 原生运行时（`Bun.serve` + `bun:sqlite` + `Bun.CryptoHasher`），**常驻内存仅约 15MB**；
  - 原生 C 绑定 SQLite 极速引擎，原生 SHA-256 物理资产去重；
  - 零额外后端依赖，极速纯粹。
- 🛡️ **网页证据自动归档 (Archive Resilience)**：
  - 后台异步流水线自动提取网页 Title、Meta 与 Clean Markdown 正文；
  - 遇到防爬/登录墙导致抓取失败时，**素材本体与笔记绝对不丢失**，提供显式的重新抓取入口。
- 🎨 **温润编辑部 UI 体系**：
  - Stone 纸张灰阶搭配 Rose 主强调色，全自动监听并实时自适应系统深浅色昼夜模式。

---

## 🛠️ 技术架构

本项目采用 **TypeScript + Bun 原生全栈单体** 现代架构：

| 领域 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **运行时与服务端** | `Bun >= 1.2` (`Bun.serve`) | 纯原生高性能 HTTP 路由、SPA 静态资源托管与毫秒级热重载 |
| **数据库** | `bun:sqlite` | 原生 C 绑定嵌入式 SQLite，位于 `./data/vault.db` |
| **全文检索** | `SQLite FTS5` (unicode61) | 毫秒级标题、备注、URL 及正文全文检索，三向触发器自动同步 |
| **资产与哈希去重** | `Bun.CryptoHasher("sha256")` + `Bun.file/write` | 原生零拷贝 SHA-256 物理资产去重存储 |
| **前端框架** | `React 18` + `TypeScript` + `Vite` | 现代极速单页应用，位于 `./src` |
| **数据请求** | `@tanstack/react-query` | 声明式数据获取与实时缓存管理 |
| **富文本与排版** | `react-markdown` + `remark-gfm` | 现代化 Markdown 渲染与 GFM 表格/清单支持 |
| **样式与图标** | `Tailwind CSS` + `Lucide Icons` | 遵循 Stone + Rose 温润编辑部设计规范 |

---

## 🚀 快速开始

### 1. 运行开发模式

```bash
bun run dev
```

浏览器访问：`http://localhost:3000`

### 2. 前端独立热更新开发

```bash
# 启动 Vite 前端热更服务 (端口 5173，自动代理 /api 至 3000)
bun run dev:ui
```

### 3. 构建全量生产版本

```bash
bun run build
```

### 4. 运行生产服务

```bash
bun start
```

### 5. 🐳 Docker 容器化部署

#### 方式 A：Docker Compose 一键启动 (推荐)

```bash
docker compose up -d
```

#### 方式 B：直接运行容器

```bash
docker run -d \
  --name material-vault \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  ghcr.io/biaobiaobiao108/materialvault:latest
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
├── server/                  # Bun 原生服务端源码
│   ├── index.ts             # 服务端主入口 (Bun.serve 路由分发与静态托管)
│   ├── db.ts                # 数据库核心 (bun:sqlite 初始化、表结构与 FTS5 触发器)
│   ├── utils.ts             # 响应包装、URL 清洗与标签提取
│   ├── routes/              # REST API 路由处理器 (items, tags, search, uploads, assets, stats)
│   └── services/            # 核心业务 (capture.ts, video.ts, storage.ts)
├── data/                    # 本地数据目录 (已 gitignore)
│   ├── vault.db             # SQLite 数据库与 FTS5 虚拟表
│   └── assets/              # SHA-256 二进制文件去重存储池
├── extension/               # 官方浏览器扩展 (Manifest V3，免编译开箱即用)
├── public/                  # 静态资源 (小熊猫 mascot logo.png, favicon.png)
├── src/                     # React 前端代码
│   ├── components/          # 业务组件 (QuickCapture, ItemCard, Modals, BatchBar)
│   │   └── ui/              # 原子 UI 组件 (MasonryGrid, MarkdownRenderer, Button, Badge, Modal...)
│   ├── pages/               # 页面 (Inbox, Items, Search, Settings)
│   ├── lib/                 # 工具库 (api.ts, theme.tsx, types.ts, utils.ts)
│   ├── App.tsx              # 路由配置
│   └── index.css            # 基础样式与 Light/Dark 设计令牌
├── package.json
└── tsconfig.json
```

---

## 📜 开源协议

本项目采用 [MIT](./LICENSE) 协议开源。
