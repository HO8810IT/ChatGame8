const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 5173
  }
});
