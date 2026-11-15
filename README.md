# Accounting PWA

个体户会计系统的 PWA 重构版。后端 Node.js + Fastify + SQLite，前端 React + Vite + Tailwind。

## 目录结构

```text
.
├── server/        # Fastify + better-sqlite3
│   └── src/
│       ├── index.js
│       └── db.js
└── web/           # React + Vite + Tailwind
    └── src/
        ├── main.tsx
        └── App.tsx
```

## 环境要求

- Node.js 18.16.0+
- npm 9+

## 安装

```bash
npm install
```

`better-sqlite3` 会自动编译，需要系统有 C++ 工具链（Windows: Visual Studio Build Tools；macOS: Xcode Command Line Tools；Linux: build-essential + python3）。

## 开发

```bash
npm run dev
```

- 后端：http://localhost:3000
- 前端：http://localhost:5173（`/api` 自动代理到 3000）

浏览器打开 http://localhost:5173。桌面显示侧边栏，手机/窄屏显示底部 Tab。客户列表在桌面为表格，手机为卡片。

## 生产

```bash
npm run build
npm run start:prod
```

`start:prod` 会设置 `SERVE_WEB=1`，由后端托管 `web/dist`，访问 http://localhost:3000 即可。

## 数据

SQLite 数据库位于 `server/data/system.db`（可用 `DATA_DIR` 环境变量覆盖）。已开启 WAL、外键、`busy_timeout`。写操作通过 `enqueueWrite()` 串行化，避免并发写冲突。

## 引入 shadcn/ui

骨架使用纯 Tailwind。需要 shadcn/ui 组件时：

```bash
cd web
npx shadcn@latest init
npx shadcn@latest add button card input dialog
```

`init` 会自动配置 CSS 变量和 `tailwind.config.js`，生成 `src/lib/utils.ts`（已有同名文件会被询问，可覆盖或合并）。

## 下一步

- 迁移脚本：旧 `data/system.db` + `company-info.json` + `yabandpay-setting.json` → 新库
- 按模块补 API 和页面：客户 → 进货 → 销售 → 库存 → 支出 → 车辆 → 税务 → 审计 → YabandPay
- 发票 PDF：后端 Playwright 复用现有 HTML 版式
- PWA：`vite-plugin-pwa` 添加 manifest 和 service worker
- HTTPS：Caddy 反代 + 内部 CA