// Sonda temporária: descobre o endpoint atual dos "mais escalados" da API do Cartola.
const API = "https://api.cartola.globo.com";
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36" };
const candidatos = [
  "mercado/destaques", "mercado/destaques/escalados", "mercado/destaques/titulares",
  "mercado/destaques/reservas", "mercado/destaques/capitaes", "mercado/selecao",
  "mercado/mais-escalados", "atletas/mais-escalados", "atletas/destaques", "destaques",
  "pos-rodada/destaques", "mercado/atletas/destaques", "rodada/destaques", "atletas/escalados",
];
for (const c of candidatos) {
  try {
    const r = await fetch(`${API}/${c}`, { headers: UA });
    const t = await r.text();
    console.log(`[${r.status}] ${c} :: ${t.slice(0, 300).replace(/\s+/g, " ")}`);
  } catch (e) { console.log(`[erro] ${c} :: ${e.message}`); }
}
// Procura nomes de endpoints no código do site.
try {
  const html = await (await fetch("https://cartola.globo.com/", { headers: UA })).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => new URL(m[1], "https://cartola.globo.com/").href);
  console.log(`site: ${html.length} bytes, ${scripts.length} scripts`);
  const achados = new Set();
  for (const s of scripts.slice(0, 40)) {
    try {
      const js = await (await fetch(s, { headers: UA })).text();
      for (const m of js.matchAll(/["'`][^"'`\s]{0,60}(destaque|escalad|mais_escal|maisEscal)[^"'`\s]{0,60}["'`]/gi)) achados.add(m[0]);
    } catch {}
  }
  console.log(`achados (${achados.size}):`);
  for (const a of [...achados].slice(0, 80)) console.log("  ", a);
} catch (e) { console.log("site indisponível:", e.message); }
