import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const DADOS = path.resolve(__dirname, "data/cartola.json");

// Em desenvolvimento, serve os dados coletados em /data.json (no Artifact, data.json é publicado ao lado da página).
function dadosLocais(): Plugin {
  return {
    name: "dados-cartola",
    configureServer(server) {
      server.middlewares.use("/data.json", (_req, res) => {
        if (!fs.existsSync(DADOS)) {
          res.statusCode = 404;
          res.end("Rode `npm run coletar` primeiro.");
          return;
        }
        res.setHeader("content-type", "application/json");
        res.end(fs.readFileSync(DADOS));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), dadosLocais()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  publicDir: false,
});
