import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://richacarson.github.io/trade-instructions/ on GitHub Pages.
// `base` must match the repo name so asset URLs resolve correctly.
export default defineConfig({
  base: '/trade-instructions/',
  plugins: [react()],
})
