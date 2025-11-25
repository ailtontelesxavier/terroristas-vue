import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api/onu": {
        target:
          "https://unsolprodfiles.blob.core.windows.net/publiclegacyxmlfiles/EN",
        changeOrigin: true,
        secure: true,
        rewrite: () => "/consolidatedLegacyByPRN.xml",
      },
    },
  },
});
