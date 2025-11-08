// D:\usstocks\client\vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/MilesRI/',
  define: {
    __API_BASE__: JSON.stringify('https://api.flinai.com'), // ✅ 改为 HTTPS 域名
  },
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  build: {
    rollupOptions: {
      plugins: [
        {
          name: 'replace-localhost',
          generateBundle(_, bundle) {
            for (const file in bundle) {
              if (bundle[file].type === 'asset' || bundle[file].type === 'chunk') {
                const code = bundle[file].code || bundle[file].source;
                if (code && typeof code === 'string') {
                  bundle[file].code = code.replace(/http:\/\/localhost:5050/g, 'https://api.flinai.com');
                  bundle[file].source = code.replace(/http:\/\/localhost:5050/g, 'https://api.flinai.com');
                }
              }
            }
          },
        },
      ],
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
