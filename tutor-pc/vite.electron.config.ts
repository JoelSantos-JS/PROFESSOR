import { defineConfig } from 'vite'
import { builtinModules } from 'module'
import { resolve } from 'path'

const externals = [
  'electron',
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
]

// preload.js — must stay CJS (contextBridge runs before ESM is available)
export default defineConfig({
  build: {
    outDir: 'dist-electron',
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: { preload: resolve('electron/preload.ts') },
      output: {
        format: 'cjs',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
      external: externals,
    },
  },
})
