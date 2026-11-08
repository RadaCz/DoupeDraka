import vitePluginReact from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, '');
  const ngrokHost = env.NGROK_HOST?.trim();

  return {
    root: frontendRoot,
    plugins: [vitePluginReact()],
    server: {
      port: 5173,
      allowedHosts: ngrokHost ? [ngrokHost] : [],
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});