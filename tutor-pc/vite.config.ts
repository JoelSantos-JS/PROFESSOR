import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  test: {
    // Pure-logic tests run in node (no jsdom dependency required).
    environment: 'node',
    testTimeout: 20_000,  // tolerant of slow CI / low-disk machines
    setupFiles: ['./src/test-setup.ts'],  // locale determinístico (pt-BR) p/ o default de idioma
  },
})
