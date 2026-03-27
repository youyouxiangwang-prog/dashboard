# PKMS - 个人知识管理系统 (Personal Knowledge Management System)

为 Youxiang Wang 构建的现代化知识管理和任务追踪系统。

## 研究洞察 (Research Insights)

### 顶级 PKM 工具分析

| 工具 | 优点 | 缺点 |
|------|------|------|
| **Notion** | 精美的数据库视图, 关系型数据, 协作友好 | 云端, 付费, 不够开源 |
| **Obsidian** | 本地优先, Markdown, 丰富插件, 隐私 | 学习曲线, 无内置同步 |
| **Logseq** | 大纲/outline 格式, 块引用, 双向链接, 开源 | 相对较新 |
| **Roam Research** | 块引用, 每日笔记, Zettelkasten | 订阅制, 昂贵 |

### 本系统设计理念

借鉴最佳实践:
1. **Logseq 风格** - 大纲式笔记组织
2. **Notion 风格** - 精美现代 UI + 数据库视图
3. **Obsidian 风格** - 本地存储, Markdown 支持
4. **块引用** - 笔记间可相互引用
5. **每日笔记** - 自动生成每日回顾

## 功能特性

### 1. 任务管理 (Todo + Deadline)
- ✅ 创建/编辑/删除任务
- ⏰ 截止日期和时间
- 🔔 定时提醒 (通过 cron)
- 📊 状态管理 (待办/进行中/已完成)
- 🏷️ 标签分类

### 2. 知识库 (Knowledge Base)
- 📝 创建笔记 (支持 Markdown)
- 🔗 块引用 (Block References)
- 🏷️ 标签和分类
- 🔍 全文搜索
- 📅 每日笔记自动创建

### 3. Web 仪表盘
- 🌙 现代深色主题
- 📱 响应式设计
- 🇨🇳 中文界面
- ⚡ 实时更新

## 目录结构

```
pkms/
├── server/
│   ├── index.js          # Express 服务器
│   ├── database.js       # SQLite 数据库
│   ├── routes/
│   │   ├── todos.js      # 任务路由
│   │   ├── notes.js      # 笔记路由
│   │   └── search.js     # 搜索路由
│   └── services/
│       ├── reminder.js   # 提醒服务
│       └── analyzer.js   # 内容分析服务
├── data/
│   ├── todos.db          # SQLite 数据库
│   └── notes/            # Markdown 笔记
│       └── daily/        # 每日笔记
├── public/
│   ├── index.html        # 主页面
│   ├── css/
│   │   └── style.css     # 自定义样式
│   └── js/
│       ├── app.js        # 主应用
│       ├── todos.js      # 任务管理
│       └── notes.js      # 笔记管理
├── scripts/
│   └── reminder-cron.js   # Cron 提醒脚本
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖
```bash
cd /home/ubuntu/.openclaw/workspace-coder/pkms
npm install
```

### 2. 启动服务器
```bash
npm start
# 或开发模式
npm run dev
```

### 3. 访问界面
打开浏览器访问: http://localhost:3000

### 4. 设置 Cron 提醒
```bash
# 每分钟检查一次提醒
* * * * * cd /home/ubuntu/.openclaw/workspace-coder/pkms && node scripts/reminder-cron.js
```

## API 接口

### 任务 (Todos)
- `GET    /api/todos` - 获取所有任务
- `POST   /api/todos` - 创建任务
- `PUT    /api/todos/:id` - 更新任务
- `DELETE /api/todos/:id` - 删除任务
- `POST   /api/todos/:id/complete` - 完成任务

### 笔记 (Notes)
- `GET    /api/notes` - 获取所有笔记
- `GET    /api/notes/:id` - 获取单个笔记
- `POST   /api/notes` - 创建笔记
- `PUT    /api/notes/:id` - 更新笔记
- `DELETE /api/notes/:id` - 删除笔记
- `GET    /api/notes/search?q=` - 搜索笔记

### 提醒
- `GET    /api/reminders/due` - 获取即将到期的提醒

## 集成 OpenClaw

系统设计为与 OpenClaw 无缝集成:
- 使用 OpenClaw 的 cron 系统发送提醒
- 通过 Slack 发送通知
- 存储在 OpenClaw 工作空间

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **前端**: Vanilla JS + TailwindCSS
- **Markdown**: marked.js
- **提醒**: node-cron + Slack webhook
