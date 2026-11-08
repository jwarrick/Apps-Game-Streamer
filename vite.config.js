import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';
import path from 'path';

const BUILD_TIME = Date.now();

function versionPlugin() {
  return {
    name: 'version-plugin',
    buildStart() {
      const versionData = { buildTime: BUILD_TIME, version: '1.7.0' };
      try {
        fs.writeFileSync(path.resolve(__dirname, 'public/version.json'), JSON.stringify(versionData));
      } catch (e) {}
    },
    closeBundle() {
      const versionData = { buildTime: BUILD_TIME, version: '1.7.0' };
      try {
        fs.writeFileSync(path.resolve(__dirname, 'dist/version.json'), JSON.stringify(versionData));
      } catch (e) {}
    }
  };
}

export default defineConfig({
  define: {
    __APP_BUILD_TIME__: BUILD_TIME
  },
  plugins: [
    basicSsl(),
    versionPlugin()
  ],
  server: {
    host: true, // Listen on all network interfaces for easy iPhone access
    port: 5173
  }
});
