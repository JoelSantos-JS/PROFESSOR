import { defineConfig } from 'vite'
import { builtinModules } from 'module'
import { resolve } from 'path'

const externals = [
  'electron',
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
  'node-edge-tts',
]

// main.mjs — ESM so Electron 28+ handles `import { app } from 'electron'` natively
export default defineConfig({
  build: {
    outDir: 'dist-electron',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: { main: resolve('electron/main.ts') },
      output: {
        format: 'es',
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs',
      },
      external: externals,
    },
  },
})
