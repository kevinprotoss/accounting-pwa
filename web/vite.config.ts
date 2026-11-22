import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import packageJson from './package.json';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 使用项目现有的 manifest.webmanifest
      // 不让插件重新生成 Manifest
      manifest: false,

      // 新版本等待用户重新打开应用时再激活
      // 避免正在填写单据时被自动刷新
      registerType: 'prompt',

      // 缓存前端构建资源
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webp,woff2,webmanifest}',
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});