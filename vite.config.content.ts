import { defineConfig } from 'vite'
import { sharedConfig } from './vite.config'
import { isDev, r } from './scripts/utils'
import packageJson from './package.json'

// bundling the content script using Vite
export default defineConfig({
  ...sharedConfig,
  build: {
    reportCompressedSize: !isDev,
    minify: !isDev,
    watch: isDev ? {} : undefined,
    outDir: r('extension/dist/assets/'),
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: isDev ? 'inline' : false,
    lib: {
      entry: r('src/content_script.ts'),
      name: packageJson.name,
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        entryFileNames: 'content_script.js',
        extend: true,
      },
    },
  },
  plugins: [
    ...sharedConfig.plugins!,
  ],
})
