import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const serverUrl = env.DEV_SERVER_PROXY_TARGET ?? 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      // Same-origin in dev: browser talks to Vite, Vite forwards to the game server.
      proxy: {
        '/api': { target: serverUrl, changeOrigin: true },
        '/socket.io': { target: serverUrl, ws: true, changeOrigin: true },
      },
    },
    build: {
      // Phaser alone is ~1.2 MB minified; it is lazy-loaded into its own chunk.
      chunkSizeWarningLimit: 1600,
    },
  };
});
