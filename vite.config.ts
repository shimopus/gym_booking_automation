import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isAIStudio = Boolean(process.env.APPLET_ID || process.env.DEFAULT_APP_PORT);
  const serverPort = isAIStudio 
    ? 3000 
    : (process.env.PORT ? parseInt(process.env.PORT, 10) : 4137);

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: serverPort,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
