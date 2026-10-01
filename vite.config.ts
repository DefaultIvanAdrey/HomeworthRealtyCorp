import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const IMG = /\.(jpe?g|png|webp|avif|gif)$/i
const photos = () => { const d = path.resolve('public/photos'); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => IMG.test(f)).sort() : [] }
// Lists every image in public/photos at build time (GitHub Pages cannot list a folder at runtime).
const photoIndex = (): Plugin => ({
  name: 'photo-index',
  configureServer(s) { s.middlewares.use('/photos/index.json', (_q, r) => { r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify(photos())) }) },
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'photos/index.json', source: JSON.stringify(photos()) }) },
})

// Stable file names: a cached index.html can never point at a script that no longer exists after a deploy.
export default defineConfig({
  base: './',
  plugins: [react(), photoIndex()],
  build: { rollupOptions: { output: { entryFileNames: 'assets/app.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' } } },
})
