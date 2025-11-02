import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      process: "process/browser",
      buffer: "buffer",
    },
  },
  optimizeDeps: {
    include: ["@apollo/client", "graphql", "date-fns"],
    exclude: ["onnxruntime-web"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true,
        }),
      ],
    },
  },
  server: {
    host: false, // allows access from local network
    port: 5175, // updated to match your working port
    https: false,
  },
  // Ensure WASM files are treated as assets
  assetsInclude: ["**/*.wasm"],
});
