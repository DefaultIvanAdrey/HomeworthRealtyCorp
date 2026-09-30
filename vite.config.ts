import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Stable file names: a cached index.html can never point at a script that no longer exists after a deploy.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { rollupOptions: { output: { entryFileNames: 'assets/app.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' } } },
})
