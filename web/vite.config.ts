import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app at /career-plan-app/ (project page under the
  // custom domain); local dev and local builds stay at root.
  base: process.env.PAGES_BASE ?? '/',
  plugins: [react()],
  define: {
    // Stamped at build time; busts the engine-worker + data caches per deploy.
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
})
