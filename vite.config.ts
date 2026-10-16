import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_PORT = Number(process.env.API_PORT ?? 3001);

export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  server: {
    // host: true → aynı ağdaki telefondan http://<bilgisayar-ip>:5173 ile açılabilir
    host: true,
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/ws': { target: `ws://localhost:${SERVER_PORT}`, ws: true },
      '/health': `http://localhost:${SERVER_PORT}`,
    },
  },
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
});
