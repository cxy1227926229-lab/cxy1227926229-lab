import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 如果部署到子路径，取消下面的注释并设置正确的路径
  // base: '/your-repo-name/',
});