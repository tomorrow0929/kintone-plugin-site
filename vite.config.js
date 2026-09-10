import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Amplify はドメインのルートで配信するので '/'
  base: '/',
  build: { outDir: 'dist', assetsDir: 'assets' },
})
