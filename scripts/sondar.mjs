// Sonda temporária: verifica a autenticação exigida pelos "mais escalados".
const API = "https://api.cartola.globo.com";
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36" };
for (const c of ["auth/mercado/destaques", "auth/mercado/destaques/reservas"]) {
  try {
    const r = await fetch(`${API}/${c}`, { headers: UA });
    console.log(`[${r.status}] ${c} :: ${(await r.text()).slice(0, 300).replace(/\s+/g, " ")}`);
  } catch (e) { console.log(`[erro] ${c} :: ${e.message}`); }
}
const html = await (await fetch("https://cartola.globo.com/", { headers: UA })).text();
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => new URL(m[1], "https://cartola.globo.com/").href);
const achados = new Set();
for (const s of scripts) {
  try {
    const js = await (await fetch(s, { headers: UA })).text();
    for (const re of [/.{0,120}X-GLB-Token.{0,120}/g, /.{0,120}Authorization.{0,120}/g, /.{0,160}mercado\/destaques.{0,160}/g]) {
      for (const m of js.matchAll(re)) achados.add(m[0].replace(/\s+/g, " "));
    }
  } catch {}
}
console.log(`achados (${achados.size}):`);
for (const a of [...achados].slice(0, 30)) console.log("  ", a);
