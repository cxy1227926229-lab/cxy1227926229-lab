import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 这里必须写你的GitHub仓库名，末尾加斜杠！
  base: '/cxy1227926229-lab/', 
  plugins: [react()],
});