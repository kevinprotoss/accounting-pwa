FROM node:22-bookworm-slim

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# 安装基础系统证书。
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖清单。
# 前后端使用根目录统一的 package-lock.json。
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json

# 严格按 package-lock.json 安装依赖。
RUN npm ci

# 安装与项目 Playwright 版本匹配的 Chromium，
# 同时安装 Chromium 在 Debian 上所需的系统依赖。
RUN npx playwright install --with-deps chromium

# 复制项目源码。
COPY . .

# 构建前端，然后移除开发依赖。
RUN npm run build \
    && npm prune --omit=dev

# 准备数据目录和浏览器目录的访问权限。
RUN mkdir -p /app/data \
    && chown -R node:node /app /ms-playwright

ENV NODE_ENV=production
ENV SERVE_WEB=1
ENV HOST=0.0.0.0
ENV PORT=3000

# 不以 root 用户运行应用。
USER node

EXPOSE 3000

CMD ["node", "server/src/index.js"]
