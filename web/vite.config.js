import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://richacarson.github.io/Trade-Instructions/ on GitHub Pages.
// `base` must match the repo name (case-sensitive) so asset URLs resolve correctly.
export default defineConfig({
  base: '/Trade-Instructions/',
  plugins: [react()],
})
