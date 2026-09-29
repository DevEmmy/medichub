import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `SINGLE=1 npm run build` produces one self-contained HTML file (used for the hosted demo).
export default defineConfig(() => ({
  // Relative base so the site works at https://<user>.github.io/<repo>/ (routing uses #, so no server rewrites needed)
  base: './',
  plugins: [react(), ...(process.env.SINGLE ? [viteSingleFile()] : [])],
  build: { outDir: process.env.SINGLE ? 'dist-single' : 'dist', chunkSizeWarningLimit: 900 },
}))
