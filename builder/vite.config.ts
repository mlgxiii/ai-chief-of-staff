import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The page reads ../prompt.md, ../template and ../examples, so they stay the only copy.
// `base: './'` lets the build run from any folder, including GitHub Pages.
export default defineConfig({
  plugins: [svelte()],
  base: './',
  server: { fs: { allow: ['..'] } },
})
