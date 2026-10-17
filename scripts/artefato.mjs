// Converte dist/index.html (arquivo único gerado pelo Vite) no formato de página do
// Artifact do claude.ai: sem <!doctype>, <html>, <head> ou <body>, com título e estilos no topo.
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(raiz, "dist/index.html"), "utf8");

const pegar = (re) => [...html.matchAll(re)].map((m) => m[0]);
const titulo = pegar(/<title>[\s\S]*?<\/title>/g);
const metas = pegar(/<meta name="claude:[^>]*>/g);
const links = pegar(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g);
const estilos = pegar(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pegar(/<script[^>]*>[\s\S]*?<\/script>/g).map((s) =>
  s.replace(/<script type="module" crossorigin>/, '<script type="module">'),
);

if (titulo.length !== 1 || scripts.length === 0 || estilos.length === 0) {
  throw new Error("dist/index.html não tem o formato esperado; rode `npm run build` antes.");
}

const pagina = [
  ...titulo,
  ...metas,
  ...links,
  ...estilos,
  '<div id="root"></div>',
  ...scripts,
].join("\n");
const saida = path.join(raiz, "dist/artefato.html");
fs.writeFileSync(saida, pagina);
console.log(`Gerado ${path.relative(raiz, saida)} (${Math.round(pagina.length / 1024)} KB)`);
