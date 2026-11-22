# Accounting PWA

个体户会计管理系统，采用 React PWA + Node.js 后端架构，使用 SQLite 存储业务数据。

系统提供客户、公司信息、进货、销售、库存、费用、车辆、税务及操作审计等管理功能，并集成外部 OCR 服务，实现票据扫描和自动数据录入。

## 1. Technical Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, Lucide |
| Routing | React Router |
| Data Fetching | TanStack Query |
| Internationalization | i18next, react-i18next |
| Backend | Node.js 20+, Fastify 4 |
| Database | SQLite, better-sqlite3 |
| PDF Generation | Playwright, Chromium |
| OCR | External OCR Service |
| Deployment | Docker, Docker Compose |

项目采用 npm Workspaces 管理前后端依赖。

### Project structure

```text
.
├── server/                     # Backend
│   ├── src/
│   │   ├── routes/             # REST API routes
│   │   ├── services/           # Business services
│   │   ├── utils/              # Utilities
│   │   ├── index.js            # Fastify entry point
│   │   └── db.js               # SQLite initialization
│   └── package.json
│
├── web/                        # Frontend
│   ├── src/
│   ├── public/
│   └── package.json
│
├── scripts/                    # Migration and maintenance scripts
├── data/                       # Runtime data (not committed)
├── certs/                      # SSL certificates (not committed)
├── Dockerfile
├── .dockerignore
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

### Application architecture

```text
                  Browser / PWA
                        |
                        | HTTPS :443
                        |
                Accounting Application
                 Node.js + Fastify
                        |
             +----------+----------+
             |          |          |
          REST API   Static Web   SQLite
             |       Resources      |
             |                      |
             |                 /app/data
             |
             | Internal Service API
             |
             v
                 External OCR Service
                        |
                        |
                 Shared Attachments
                 /app/data/attachments
```

- React PWA 提供用户界面和业务操作入口。
- Fastify 提供 REST API，并负责托管前端静态资源。
- SQLite 负责业务数据存储。
- Playwright + Chromium 用于生成 PDF 发票。
- 外部 OCR 服务负责票据内容识别。
- Accounting Backend 负责 OCR 任务调用、状态同步及识别结果处理。
- Accounting 与 OCR 通过内部服务网络通信，并共享必要的附件文件。

## 2. Feature Modules

| Module | Description |
|---|---|
| Customers | 客户管理 |
| Company | 公司信息 |
| Receipts | 进货单及商品明细 |
| Issues | 销售出库及发票 |
| Stock | 库存管理 |
| Expenses | 日常支出 |
| Cars | 公司车辆及车辆费用 |
| Tax | 税务数据 |
| Audit | 操作审计 |
| Attachments | 附件管理 |
| Scans | OCR 扫描及自动数据录入 |

## 3. Development Environment

### Requirements

- Node.js 20+
- npm 10+

### Installation

在项目根目录执行：

```bash
npm install
```

### Development

```bash
npm run dev
```

开发环境：

| Service | URL |
|---|---|
| Backend | http://localhost:3000 |
| Frontend | http://localhost:5173 |

- Frontend 由 Vite 提供开发服务器。
- Backend 由 Fastify 提供 REST API。
- Frontend 的 `/api` 请求通过 Vite Proxy 转发到 Backend。

### Production build (without Docker)

```bash
npm run build
npm run start:prod
```

生产环境下，后端通过 `SERVE_WEB=1` 托管 `web/dist` 静态文件。

具体启动脚本以根目录 `package.json` 中的配置为准。

## 4. Docker Deployment

生产环境推荐使用 Docker Compose 部署。

### 4.1 Deployment architecture

Accounting 应用通过 Docker 镜像运行。

部署设计：

- Accounting 镜像基于 `node:22-bookworm-slim`。
- Frontend 在镜像构建阶段编译。
- Backend 使用 Fastify 同时提供 REST API 和前端静态资源。
- Playwright 根据项目 `package-lock.json` 安装对应版本的 Chromium 及运行依赖。
- Accounting 直接提供 HTTPS，不需要额外部署 Nginx。
- SQLite 和上传文件通过宿主机 Volume 持久化。
- 外部 OCR 服务通过 Docker 内部网络与 Accounting 通信。
- OCR 所需的附件目录通过共享 Volume 提供访问。

### 4.2 Build Accounting image

在项目根目录执行：

```bash
docker build -t accounting-pwa:latest .
```

Dockerfile 使用 npm Workspaces 安装项目依赖。

构建过程：

1. 使用 `npm ci` 根据根目录 `package-lock.json` 安装依赖。
2. 安装与项目 Playwright 版本匹配的 Chromium 及运行依赖。
3. 复制项目源代码。
4. 执行 Frontend production build。
5. 移除开发依赖。
6. 以非 root 用户运行应用。

Playwright 浏览器安装路径：

```text
/ms-playwright
```

浏览器版本由项目安装的 Playwright 版本决定，不需要单独维护 Chromium 版本号。

### 4.3 Prepare directories

在部署目录执行：

```bash
mkdir -p data
mkdir -p certs
```

目录说明：

| Directory | Purpose |
|---|---|
| `data/` | SQLite database and application files |
| `certs/` | SSL certificates |

部署目录示例：

```text
deployment/
├── data/
├── certs/
│   ├── fullchain.pem
│   └── privkey.pem
├── docker-compose.yml
└── .env
```

### 4.4 SSL certificates

将 HTTPS 证书放入 `certs/`：

```text
certs/
├── fullchain.pem
└── privkey.pem
```

- `fullchain.pem`：服务器证书及完整证书链。
- `privkey.pem`：服务器私钥。

证书必须与访问应用时使用的域名或 IP 地址匹配。

不要将私钥提交到 Git 或打包进 Docker 镜像。

建议设置证书文件权限：

```bash
sudo chown root:1000 certs/privkey.pem
sudo chmod 640 certs/privkey.pem

sudo chmod 644 certs/fullchain.pem
```

Accounting 容器以 `node` 用户运行，因此必须确保容器内用户能够读取证书文件。

### 4.5 Docker Compose configuration

在部署目录创建 `docker-compose.yml`：

```yaml
services:
  accounting:
    build:
      context: .
      dockerfile: Dockerfile
    image: accounting-pwa:latest
    restart: unless-stopped

    ports:
      - "443:3000"

    environment:
      NODE_ENV: production
      SERVE_WEB: "1"
      HOST: "0.0.0.0"
      PORT: "3000"

      SSL_CERTFILE: /app/certs/fullchain.pem
      SSL_KEYFILE: /app/certs/privkey.pem

      OCR_URL: http://ocr-service:8000

    volumes:
      - ./data:/app/data
      - ./certs:/app/certs:ro

    depends_on:
      ocr-service:
        condition: service_started

    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "require('https').get({hostname:'127.0.0.1',port:3000,path:'/api/health',rejectUnauthorized:false},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

  ocr-service:
    image: ${OCR_IMAGE:-accounting-ocr:latest}
    restart: unless-stopped

    expose:
      - "8000"

    volumes:
      - ./data:/app/data:ro
```

如果使用其他 OCR 服务镜像名称，可以通过 `.env` 配置：

```dotenv
OCR_IMAGE=accounting-ocr:latest
```

配置说明：

| Configuration | Description |
|---|---|
| `443:3000` | 对外提供 HTTPS 服务 |
| `OCR_URL` | OCR 服务内部访问地址 |
| `./data:/app/data` | 持久化业务数据及附件 |
| `./certs:/app/certs:ro` | 只读挂载 SSL 证书 |
| `expose: 8000` | 声明 OCR 内部服务端口，不映射到宿主机 |
| `depends_on` | 控制 Accounting 与 OCR 容器的启动顺序 |

注意：

- Accounting 通过 Docker 内部服务名 `ocr-service` 访问 OCR。
- 不要将 OCR 地址配置为 `localhost`，因为它指向 Accounting 容器自身。
- `depends_on: service_started` 只保证 OCR 容器先启动，不代表 OCR 服务已经完全就绪。
- OCR 暂时不可用时，Accounting 仍可以启动；OCR 相关功能需要等服务恢复后才能正常使用。
- SSL 证书通过只读 Volume 挂载，不包含在镜像中。

### 4.6 Start containers

首先检查 Compose 配置：

```bash
docker compose config
```

构建并启动：

```bash
docker compose up -d --build
```

查看容器状态：

```bash
docker compose ps
```

### 4.7 Access application

浏览器访问：

```text
https://your-domain-or-ip/
```

Backend health check：

```text
https://your-domain-or-ip/api/health
```

Accounting 容器内部通过以下地址访问 OCR：

```text
http://ocr-service:8000
```

OCR 不需要单独配置公网域名或开放宿主机端口。

### 4.8 Environment variables

Accounting 容器使用以下环境变量：

| Environment variable | Value | Description |
|---|---|---|
| `NODE_ENV` | production | Runtime environment |
| `SERVE_WEB` | 1 | Enable frontend static hosting |
| `HOST` | 0.0.0.0 | Listen address |
| `PORT` | 3000 | Internal application port |
| `SSL_CERTFILE` | /app/certs/fullchain.pem | SSL certificate path |
| `SSL_KEYFILE` | /app/certs/privkey.pem | SSL private key path |
| `OCR_URL` | http://ocr-service:8000 | OCR service base URL |

注意：

- `OCR_URL` 必须使用容器内部可访问的服务地址。
- `DATA_DIR` 是否支持自定义，需要以应用实际配置为准；当前部署统一将宿主机 `data/` 挂载到 `/app/data`。
- HTTPS 依赖证书文件可读取，并且应用启动配置与实际证书路径一致。

## 5. Persistent Data

所有运行时数据保存在宿主机 `data/` 目录，并挂载到 Accounting 容器的 `/app/data`。

默认目录结构：

```text
data/
├── system.db
├── system.db-wal
├── system.db-shm
├── attachments/
│   └── YYYYMM/
├── invoices/
└── trash/
```

说明：

| Path | Description |
|---|---|
| `system.db` | SQLite database |
| `system.db-wal` | SQLite Write-Ahead Log |
| `system.db-shm` | SQLite shared memory file |
| `attachments/` | Uploaded invoices, payment receipts and other attachments |
| `attachments/YYYYMM/` | Attachments organized by year and month |
| `invoices/` | Generated PDF invoices |
| `trash/` | Temporarily stored deleted files |

### SQLite

数据库使用 SQLite，并启用：

- WAL mode
- Foreign key constraints
- Write operation queue

WAL 模式允许读取与写入更好地并行工作。

注意：

- 不要将数据库保存在容器内部的临时文件系统。
- 不要在应用运行期间仅复制 `system.db` 而忽略 WAL 文件。
- 建议在停止应用后备份整个 `data/` 目录，或使用适当的 SQLite 在线备份方式。
- 不要让多个 Accounting 实例同时以普通方式操作同一个 SQLite 数据库文件。

### Shared attachments with OCR

Accounting 和 OCR 使用相同的宿主机附件目录：

```text
Host:
./data/attachments/

Accounting:
/app/data/attachments/

OCR:
/app/data/attachments/
```

附件处理流程：

1. 用户上传票据图片。
2. Accounting 将图片保存到 `data/attachments/YYYYMM/`。
3. Accounting 将附件相对路径传递给 OCR 服务。
4. OCR 服务通过共享目录读取对应图片。
5. OCR 返回结构化识别结果。
6. Accounting 接收并处理识别结果。
7. 识别结果被映射到相应业务记录。

传递给 OCR 的相对路径示例：

```text
202611/invoice-001.jpg
```

OCR 实际读取路径：

```text
/app/data/attachments/202611/invoice-001.jpg
```

OCR 对附件目录只需要读取权限，因此使用只读 Volume。

### Data persistence

- SQLite 数据库和业务文件保存在宿主机 `data/` 目录。
- Accounting 容器重建不会删除宿主机上的持久化数据。
- OCR 与 Accounting 共享附件目录，但不共享 SQLite 数据库。
- SSL 证书单独保存在 `certs/` 目录。
- 建议定期备份整个 `data/` 目录及 `certs/` 目录。

## 6. HTTPS and PWA

生产环境通过 HTTPS 访问应用。

HTTPS 对 PWA 的安装能力非常重要，特别是手机浏览器对安全上下文的要求。

当前部署由 Fastify 直接提供 HTTPS，不需要额外部署 Nginx 或其他反向代理。

注意：

- 证书必须有效且与访问地址匹配。
- 手机必须信任证书颁发机构。
- 使用内网 IP 或自定义域名时，需要确保相应地址包含在证书 SAN 中。
- 使用自建 CA 时，需要在手机上安装并信任对应 CA 证书。
- PWA 的实际安装能力还取决于 Web App Manifest、Service Worker 等前端配置。

如果使用自签名证书，浏览器可能显示安全警告。仅仅能够通过 HTTPS 打开网页，并不代表手机已经信任该证书。

## 7. External Services

### OCR Service

OCR 是 Accounting PWA 依赖的外部服务，负责票据图片的内容识别，并向 Accounting 提供结构化识别结果。

Accounting 与 OCR 的职责分离：

**Accounting PWA 负责：**

- 上传和管理票据图片。
- 创建 OCR 识别任务。
- 调用 OCR 服务。
- 同步 OCR 任务状态。
- 获取结构化识别结果。
- 将识别结果映射到会计业务数据。
- 管理最终业务记录及其关联附件。

**OCR Service 负责：**

- 接收识别请求。
- 读取指定票据图片。
- 执行票据内容识别。
- 返回结构化识别结果。
- 提供识别任务状态。

### Service communication

Accounting Backend 通过内部服务地址访问 OCR：

```text
http://ocr-service:8000
```

OCR 不直接对浏览器开放，也不需要独立的公网访问入口。

所有 OCR 调用均由 Accounting Backend 发起。

### Attachment sharing

Accounting 和 OCR 通过共享目录访问票据图片：

```text
Accounting:
  /app/data/attachments/

OCR:
  /app/data/attachments/
```

Accounting 负责上传和保存原始附件，OCR 根据 Accounting 提供的相对路径读取图片。

OCR 只需要读取附件，不应直接修改或删除 Accounting 管理的原始文件。

### Data flow

```text
User
 |
 | Upload invoice image
 v
Accounting Frontend
 |
 v
Accounting Backend
 |
 | Save attachment
 v
Shared Attachment Directory
 |
 | Submit OCR request
 v
OCR Service
 |
 | Read image
 | Recognize invoice content
 |
 | Return task status / structured result
 v
Accounting Backend
 |
 | Validate and process result
 | Map fields to business records
 v
SQLite Database
```

### Service dependency

Accounting 与 OCR 之间存在以下依赖关系：

- Accounting 需要 OCR 服务可访问，才能执行票据识别。
- OCR 需要访问 Accounting 提供的共享附件目录，才能读取待识别图片。
- Accounting 负责维护识别任务与业务记录之间的关联。
- OCR 服务不可用时，不影响 Accounting 的其他独立业务功能。
- OCR 识别结果最终由 Accounting 接收和管理。

OCR 服务的接口契约、请求参数、响应结构及任务状态定义，应与 Accounting Backend 的调用实现保持一致。