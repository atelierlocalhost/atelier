import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

const shared = path.resolve(import.meta.dirname, '../../shared')

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': shared } },
  server: { fs: { allow: ['..', shared] } },
})
