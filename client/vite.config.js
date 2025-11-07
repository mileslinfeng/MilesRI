// D:\usstocks\client\vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

import path from 'path'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [react()],
  base: isProd ? '/MilesRI/' : '/', // ✅ 本地用 '/'，部署时自动 '/MilesRI/'
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
