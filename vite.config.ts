import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './extension/manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],server: {
    port: 5173,
    strictPort: true, // Ensures the server fails if the port is in use
    hmr: {
      port: 5173,
    },
    cors: true // Explicitly enable CORS
  },
});
