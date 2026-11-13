"use strict";
/* Stats NBA - Señales para el próximo partido (M-02 a M-08, M-13): la chance de que cada jugador pase
   (o no) una línea en puntos, tiros, triples, rebotes, asistencias o PRA, con el motivo y su respaldo.
   M-13: calculadora de línea y cuota (con los hitos de bet365) y combinada. */

const SEN_STATS = [["", "Todas"], ["pts", "PTS"], ["fga", "TCI"], ["fgm", "TCM"], ["fg3a", "3PA"], ["fg3m", "3PM"], ["reb", "REB"], ["ast", "AST"], ["pra", "PRA"]];
const SEN_GRAF = { pts: "pts", fga: "fga", fgm: "fgm", fg3a: "fg3a", fg3m: "fg3m", reb: "reb", ast: "ast", pra: "pra" };
const SEN_CORTO = { pts: "PTS", fga: "TCI", fgm: "TCM", fg3a: "3PA", fg3m: "3PM", reb: "REB", ast: "AST", pra: "PRA" };
const SEN_NOMBRE = { pts: "puntos", fga: "tiros de campo", fgm: "tiros de campo metidos", fg3a: "triples intentados", fg3m: "triples metidos", reb: "rebotes", ast: "asistencias", pra: "PRA" };
const SEN_HITOS = { pts: [5, 10, 15, 20, 25, 30, 35, 40], reb: [3, 5, 7, 10, 12, 15], ast: [3, 5, 7, 10, 12, 15], fg3m: [1, 2, 3, 4, 5, 6, 7] };
const PALIZA = 12;            // diferencia esperada desde la que se avisa en los "más"
const pctCh = (p) => p >= 0.995 ? "> 99%" : p <= 0.005 ? "< 1%" : `${nf0.format(p * 100)}%`;
const lineaTxt = (l) => String(l).replace(".", ",");
function filtrosSenales() {
  S.prefs.sen_f = { limite: 15, stat: "", lado: "", fuerza: "", ...(S.prefs.sen_f || {}) };
  return S.prefs.sen_f;
}
const pctSen = (v) => `${v > 0 ? "+" : "−"}${nf0.format(Math.abs(v) * 100)}%`;

const pestanasSenales = () => `<div class="pestanas sen-tabs">${[["senales", "Señales del día"], ["pisos", "Combinada de pisos"], ["calc", "Línea y cuota"], ["registro", "Registro"], ["cal", "Calibración"], ["bajas", "Lista de bajas"]].map(([k, t]) =>
  `<button class="pestana${(S.prefs.sen_tab || "senales") === k ? " activa" : ""}" data-stab="${k}">${t}</button>`).join("")}</div>`;

async function vistaSenales(c) {
  if ((S.prefs.sen_tab || "senales") === "bajas") return vistaBajas(c);
  if (S.prefs.sen_tab === "registro") return vistaRegistro(c);
  if (S.prefs.sen_tab === "calc") return vistaCalc(c);
  if (S.prefs.sen_tab === "pisos") return vistaPisos(c);
  if (S.prefs.sen_tab === "cal") return vistaCalibracion(c);
  if (!c.querySelector(".senales")) c.innerHTML = '<div class="senales"><h1>Señales</h1><div class="vacio">Calculando…</div></div>';
  const d = await llamar("senales", filtrosSenales());
  if (S.ruta.s !== "senales") return;
  S.sen = d;
  pintarSenales(c);
}

function textoRespaldo(r, corto = false) {
  if (!r || !r.n) return '<span class="apagado">Sin casos parecidos en la prueba</span>';
  if (r.desde != null)          // M-13: el tramo de chance en la prueba
    return `<span title="En la prueba (temporadas que el modelo no vio), cuando la chance daba entre ${nf0.format(r.desde * 100)} y ${nf0.format(r.hasta * 100)}%, se cumplió el ${nf0.format(r.acierto * 100)}% de ${nf0.format(r.n)} casos">
      ${corto ? `En la prueba se cumplió <b>${nf0.format(r.acierto * 100)}%</b>` : `En la prueba, las de ${nf0.format(r.desde * 100)} a ${nf0.format(r.hasta * 100)}%: <b>${nf0.format(r.acierto * 100)}%</b> <span class="apagado">(${nf0.format(r.n)} casos)</span>`}</span>`;
  if (r.n < 30) return `<span class="apagado">Pocos casos parecidos en la prueba (${r.n})</span>`;
  const dif = (r.acierto - r.base) * 100;
  return `<span title="En la prueba, ${r.n} señales así se cumplieron el ${nf0.format(r.acierto * 100)}% de las veces; un jugador cualquiera, el ${nf0.format(r.base * 100)}%">
    ${corto ? "" : "En la prueba: "}<b class="${dif >= 5 && r.acierto >= ACIERTO_MIN ? "mas" : ""}">${nf0.format(r.acierto * 100)}%</b> se cumplió <span class="apagado">(al azar ${nf0.format(r.base * 100)}%, ${r.n} casos)</span></span>`;
}

function tarjetaSenal(x, compacta = false) {
  const mas = x.lado === "mas";
  const hora = x.hora_utc ? new Date(x.hora_utc).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "";
  return `<div class="tarjeta sen-tarjeta ${x.lado}${x.fuerza === "fuerte" ? " fuerte" : ""}">
    ${compacta ? "" : `<div class="sen-cab">${avatarJ(x.player_id, x.nombre)}
      <div style="min-width:0;flex:1"><a href="#" class="sen-nombre" data-jugador="${x.player_id}">${esc(x.nombre)}</a>
        <div class="apagado">${esc(x.equipo || "")} ${x.local ? "vs" : "@"} ${esc(x.rival || "")}${hora ? `, ${hora} h` : ""}${x.dudoso ? ' <span class="sen-dudoso">dudoso</span>' : ""}</div></div>
      <span class="sen-fuerza">${x.fuerza === "fuerte" ? "Fuerte" : "Media"}</span></div>`}
    ${x.linea != null ? `<div class="sen-titular"><div class="sen-chance" title="Chance de que se cumpla, calibrada con temporadas que el modelo no vio">${pctCh(x.chance)}</div>
      <div><b>${mas ? "Más" : "Menos"} de ${lineaTxt(x.linea)} ${esc(SEN_CORTO[x.stat] || x.nombre_stat)}</b> ${x.en_casa
          ? `<span class="apagado" title="La línea principal de Stake para este mercado; la chance es la de la app a esa línea">línea de Stake</span>`
          : '<span class="apagado" title="La app elige la línea donde un jugador así queda arriba y abajo parecido; la de tu casa puede ser otra: probala en Línea y cuota">línea de referencia</span>'}
        <div class="sen-numeros"><span class="apagado">Promedio</span> ${nf1.format(x.base)} <span class="apagado">→ esperado</span> <b>${nf1.format(x.esperado)}</b> <span class="sen-pct">${pctSen(x.desvio)}</span></div></div></div>`
    : `<div class="sen-titular"><span class="sen-flecha">${mas ? "▲" : "▼"}</span>
      <div><b>${mas ? "Más" : "Menos"} ${esc(x.nombre_stat)}</b> que su promedio
        <div class="sen-numeros"><span class="apagado">Promedio</span> ${nf1.format(x.base)} <span class="apagado">→ esperado</span> <b>${nf1.format(x.esperado)}</b> <span class="sen-pct">${pctSen(x.desvio)}</span></div></div></div>`}
    ${bloqueCasa(x)}
    ${avisosSenal(x)}
    <ul class="sen-motivos">${x.motivos.map((m) => `<li>${m.k === "historial" ? '<span class="sen-aporte apagado">—</span>' : `<span class="sen-aporte ${m.aporte > 0 ? "mas" : "menos"}">${pctSen(m.aporte)}</span>`}${esc(m.texto)}</li>`).join("")}</ul>
    <div class="sen-pie"><span class="sen-respaldo">${textoRespaldo(x.respaldo, x.linea != null)}</span>${x.debil ? '<span class="sen-debil" title="Este tipo de señal se cumplió menos del 55% en la prueba: no entra al top de Señales">Floja</span>' : ""}<span class="espacio"></span>
      <button class="enlace" data-sgraf="${x.player_id}|${x.stat}">Ver gráfico</button>
      ${x.linea != null ? `<button class="enlace" data-sotra="${x.player_id}|${x.stat}|${x.linea}|${x.lado}">Otra línea</button>` : ""}
      <button class="enlace" data-sanotar="${x.player_id}|${x.stat}|${x.lado}|${x.game_id}">Anotar</button></div>
  </div>`;
}

// U-23: la línea y la cuota de Stake para esa señal, con la chance de la app a esa línea
function bloqueCasa(x) {
  const c = x.casa;
  if (!c) return "";
  const mas = x.lado === "mas";
  const ch = mas ? c.chance_mas : 1 - c.chance_mas, q = mas ? c.cuota_mas : c.cuota_menos, v = mas ? c.valor_mas : c.valor_menos;
  if (!q) return "";
  const pc = c.prob_mas != null ? (mas ? c.prob_mas : 1 - c.prob_mas) : null;
  if (x.alarma) return `<div class="sen-casa alarma"><span class="ambar">⚠ Revisá las bajas</span>
    <span class="apagado">${esc(x.alarma.replace(/^La app/, "La app"))}</span></div>`;
  return `<div class="sen-casa"><span class="apagado">Stake paga</span> <b>${nfC.format(q)}</b>
    <span class="apagado">· la app ${nf0.format(ch * 100)}%${pc != null ? `, la casa ${nf0.format(pc * 100)}%` : ""}${x.linea_ref != null && x.linea_ref !== c.linea ? ` · sin Stake la app ponía ${lineaTxt(x.linea_ref)}` : ""}</span>
    <span class="sen-valor ${v >= 0.03 ? "mas" : v <= -0.05 ? "menos" : "apagado"}" title="Mezcla de la app y Stake corregida × cuota − 1">${v >= 0 ? "paga +" : "le falta "}${nf0.format(Math.abs(v) * 100)}%</span>
    ${otroLado(c, mas)}</div>`;
}

// M-17: el otro lado de la misma línea, con su cuota y su valor
function otroLado(c, mas) {
  const q = mas ? c.cuota_menos : c.cuota_mas, v = mas ? c.valor_menos : c.valor_mas;
  if (!q || v == null) return "";
  return `<span class="sen-otro apagado" title="El otro lado de la misma línea en Stake">${mas ? "Menos" : "Más"} ${nfC.format(q)}: <span class="${v >= 0.03 ? "mas" : v <= -0.05 ? "menos" : ""}">${v >= 0 ? "+" : "−"}${nf0.format(Math.abs(v) * 100)}%</span></span>`;
}

// ---------------------------------------------------------------- M-17: calibración
const CAL_STAT = { pts: "PTS", reb: "REB", ast: "AST", fg3m: "3PM", pra: "PRA", pr: "P+R", pa: "P+A", ra: "R+A", fga: "TCI", fgm: "TCM", fg3a: "3PA", stl: "ROB", blk: "TAP", tov: "PÉR" };
async function vistaCalibracion(c) {
  c.innerHTML = `<div class="senales"><h1>Señales</h1>${pestanasSenales()}<div class="vacio">Midiendo…</div></div>`;
  const d = await llamar("calibracion").catch(() => null);
  if (S.ruta.s !== "senales" || S.prefs.sen_tab !== "cal" || !d) return;
  S.cal = d;
  const pct = (v) => (v == null ? "—" : `${nf1.format(v * 100)}%`);
  const rinde = (v) => (v == null ? "—" : `<span class="${v >= 0 ? "mas" : v <= -0.08 ? "menos" : ""}">${v >= 0 ? "+" : "−"}${nf1.format(Math.abs(v) * 100)}%</span>`);
  const dif = (a, b) => { const x = (a - b) * 100; return `<span class="${Math.abs(x) < 2 ? "apagado" : x > 0 ? "mas" : "menos"}">${x >= 0 ? "+" : "−"}${nf1.format(Math.abs(x))}</span>`; };
  const p = d.patas || {};
  c.innerHTML = `<div class="senales cal">
    <h1>Señales</h1>
    <p class="sub" style="margin:4px 0 16px">Lo que prometían Stake y la app contra lo que salió de verdad. Se actualiza solo con cada partido terminado.</p>
    ${pestanasSenales()}
    ${d.n ? `<section class="tarjeta cal-bloque"><h2>Stake: la chance del Más por tramo</h2>
      <p class="apagado">${nf0.format(d.n)} líneas con resultado, de ${d.dias} día${d.dias === 1 ? "" : "s"} (${esc(d.desde || "")} a ${esc(d.hasta || "")}). "Rinde" es lo que deja apostar siempre ese lado a la cuota de Stake.
        La corrección es lo que la app le suma a la chance de Stake antes de usarla.</p>
      <table class="tabla cal-tabla"><thead><tr><th>Stake le da al Más</th><th>Líneas</th><th>Promete</th><th>Salió</th><th>Diferencia</th><th>Rinde el Más</th><th>Rinde el Menos</th><th>Corrección</th></tr></thead>
      <tbody>${d.tramos.map((t) => `<tr><td>${nf0.format(t.desde * 100)} a ${nf0.format(t.hasta * 100)}%</td><td>${nf0.format(t.n)}</td><td>${pct(t.promete)}</td><td>${pct(t.salio)}</td><td>${dif(t.salio, t.promete)}</td><td>${rinde(t.rinde_mas)}</td><td>${rinde(t.rinde_menos)}</td><td>${t.correccion >= 0 ? "+" : "−"}${nf1.format(Math.abs(t.correccion) * 100)}</td></tr>`).join("")}</tbody></table></section>
    <section class="tarjeta cal-bloque"><h2>Stake: líneas principales por mercado</h2>
      <p class="apagado">La línea principal debería salir mitad y mitad.${d.principales ? ` En total el Más salió <b>${pct(d.principales.salio)}</b>: rinde ${rinde(d.principales.rinde_mas)} el Más y ${rinde(d.principales.rinde_menos)} el Menos.` : ""}</p>
      <table class="tabla cal-tabla"><thead><tr><th>Mercado</th><th>Líneas</th><th>Salió el Más</th><th>Rinde el Más</th><th>Rinde el Menos</th></tr></thead>
      <tbody>${d.mercados.map((m) => `<tr><td>${CAL_STAT[m.stat] || m.stat}</td><td>${nf0.format(m.n)}</td><td>${pct(m.salio)}</td><td>${rinde(m.rinde_mas)}</td><td>${rinde(m.rinde_menos)}</td></tr>`).join("")}</tbody></table></section>`
    : '<div class="vacio">Todavía no hay líneas de Stake con resultado para medir.</div>'}
    ${(d.app || []).length ? `<section class="tarjeta cal-bloque"><h2>La app: sus señales</h2>
      <p class="apagado">Del registro de señales: la chance que daba la app a su línea y cuántas se cumplieron.</p>
      <table class="tabla cal-tabla"><thead><tr><th>Lado</th><th>Chance de la app</th><th>Señales</th><th>Promete</th><th>Salió</th><th>Diferencia</th></tr></thead>
      <tbody>${d.app.map((t) => `<tr><td>${t.lado === "mas" ? "Más" : "Menos"}</td><td>${nf0.format(t.desde * 100)} a ${nf0.format(t.hasta * 100)}%</td><td>${nf0.format(t.n)}</td><td>${pct(t.promete)}</td><td>${pct(t.salio)}</td><td>${dif(t.salio, t.promete)}</td></tr>`).join("")}</tbody></table></section>` : ""}
    ${p.n ? `<section class="tarjeta cal-bloque"><h2>Tus apuestas</h2>
      <p>Patas resueltas: <b>${nf0.format(p.n)}</b>, acertaste el <b>${pct(p.acierto)}</b>${Object.entries(p.por_lado || {}).map(([l, x]) => ` · ${l === "mas" ? "Más" : "Menos"} ${pct(x.acierto)} (${x.n})`).join("")}.
        Apuestas resueltas: <b>${p.apuestas}</b>, ganadas ${p.ganadas}, resultado ${rinde(p.unidades ? p.resultado / p.unidades : null)} (${p.resultado >= 0 ? "+" : "−"}${nfC.format(Math.abs(p.resultado))} u), con ${nf1.format(p.patas_promedio || 0)} patas en promedio.</p>
      <table class="tabla cal-tabla"><thead><tr><th>Patas de la combinada</th>${[2, 3, 4, 6, 8, 10].map((n) => `<th>${n}</th>`).join("")}</tr></thead>
      <tbody><tr><td>Con tu acierto por pata, sale 1 de cada</td>${[2, 3, 4, 6, 8, 10].map((n) => `<td>${nf0.format(Math.round(1 / Math.pow(p.acierto, n)))}</td>`).join("")}</tr></tbody></table></section>` : ""}
  </div>`;
}

// avisos que no cambian la chance pero conviene mirar antes de apostar (reglas del 2/11)
function avisosSenal(x) {
  const a = [];
  if (x.dudoso) a.push("Está dudoso: confirmá que juega antes del partido.");
  if (x.dudosos_equipo?.length) a.push(`Dudoso${x.dudosos_equipo.length > 1 ? "s" : ""} en su equipo: ${esc(listaY(x.dudosos_equipo))}. Si ${x.dudosos_equipo.length > 1 ? "juegan" : "juega"}, cambia el reparto.`);
  if (x.lado === "mas" && x.margen != null && x.margen >= PALIZA) a.push(`Puede ser paliza (diferencia esperada de ${nf0.format(x.margen)}): en un "más", si se escapa el partido juega menos.`);
  return a.length ? `<div class="sen-avisos">${a.map((t) => `<div>${t}</div>`).join("")}</div>` : "";
}

const ACIERTO_MIN = 0.55;      // M-12: igual que en senales.py
const listaY = (l) => l.length > 1 ? `${l.slice(0, -1).join(", ")} y ${l[l.length - 1]}` : (l[0] || "");

function pintarSenales(c) {
  const d = S.sen, f = filtrosSenales(), m = d.modelo || {};
  const seg = (k, ops) => `<div class="segmentado" data-sseg="${k}">${ops.map(([v, t]) => `<button data-v="${v}" class="${String(f[k]) === String(v) ? "activo" : ""}">${t}</button>`).join("")}</div>`;
  const dia = d.fecha ? fechaCorta(d.fecha).replace(/<[^>]+>/g, "") : "";
  c.innerHTML = `<div class="senales">
    <h1>Señales</h1>
    <p class="sub" style="margin:4px 0 16px">La chance de que cada jugador pase (o no) una línea en su próximo partido, con el motivo. Van primero las de más chance; se muestran desde 55%.
      Si Stake tiene el mercado, la línea es la principal de Stake y se ve su cuota; si no, la de referencia de la app (probá otra en <a href="#" class="enlace" data-stab="calc">Línea y cuota</a>).
      Las que dicen "Revisá las bajas" son las que la app y Stake ven muy distinto: van al final.</p>
    ${pestanasSenales()}
    <div class="filtros sen-filtros">
      <div class="campo"><span>Mostrar</span>${seg("limite", [[15, "15"], [30, "30"], [50, "50"]])}</div>
      <div class="campo"><span>Stat</span>${seg("stat", SEN_STATS)}</div>
      <div class="campo"><span>Dirección</span>${seg("lado", [["", "Más (y Menos con valor)"], ["mas", "Solo Más"], ["menos", "Menos"], ["todas", "Todas"]])}</div>
      <div class="campo"><span>Chance</span>${seg("fuerza", [["", "55% o más"], ["fuerte", "65% o más"]])}</div>
      <span class="espacio"></span><span class="apagado" id="sen-ms">${nf0.format(d.ms)} ms</span>
    </div>
    ${d.fecha ? `<p class="sen-info">${d.partidos.length} partido${d.partidos.length === 1 ? "" : "s"} el ${esc(dia)}: ${d.partidos.map((p) => `${esc(p.visita)} @ ${esc(p.local)}`).join(", ")}.
      ${d.con_lesiones ? `Con el reporte de lesiones de ESPN (${esc(new Date(d.lesiones.actualizado).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }))}): ${d.lesiones.hoy.filter((x) => x.estado === "afuera").length} afuera y ${d.lesiones.hoy.filter((x) => x.estado === "dudoso").length} dudosos en estos partidos.`
        : '<span class="ambar">Sin reporte de lesiones reciente: las señales no saben quién falta.</span>'}
      <button class="enlace" data-slesiones>Actualizar lesiones</button>
      ${d.total > d.senales.length ? `Mostrando ${d.senales.length} de ${d.total}.` : ""}</p>` : ""}
    ${!d.fecha ? '<div class="vacio">No hay partidos cargados para los próximos días.</div>'
      : !d.senales.length ? '<div class="vacio">No hay señales con 55% de chance o más con estos filtros.</div>'
      : `<div class="sen-grilla">${d.senales.map((x) => tarjetaSenal(x)).join("")}</div>`}
    ${(d.menos_valor || []).length ? `<h2 class="sen-sub">Menos con valor</h2>
      <p class="apagado" style="margin:0 0 10px">Preferís los Más: estos Menos aparecen porque Stake los paga 8% o más de lo que valen según la app (o, sin cuota de Stake, tienen 70% de chance o más).</p>
      <div class="sen-grilla">${d.menos_valor.map((x) => tarjetaSenal(x)).join("")}</div>` : ""}
    ${panelRespaldo(m, d.recalculando)}
  </div>`;
}

// M-13: cómo se probó la chance (tramos de 5 puntos por stat, en temporadas que el modelo no vio)
const TRAMOS = [[0.55, 0.6], [0.6, 0.65], [0.65, 0.7], [0.7, 0.75], [0.75, 0.8], [0.8, 1.01]];
function tablaCalibracion(prueba) {
  const celda = (b, [a, z]) => {
    const xs = (b || []).filter((t) => t.desde >= a - 1e-9 && t.desde < z - 1e-9);
    const n = xs.reduce((s, t) => s + t.n, 0);
    if (!n) return '<td class="apagado">—</td>';
    const ac = xs.reduce((s, t) => s + t.acierto * t.n, 0) / n;
    return `<td title="${nf0.format(n)} casos"><b>${nf0.format(ac * 100)}%</b></td>`;
  };
  return `<div class="caja-split"><table><thead><tr><th class="izq">La app decía</th>${TRAMOS.map(([a, z]) => `<th>${z > 1 ? `${nf0.format(a * 100)}% o más` : `${nf0.format(a * 100)} a ${nf0.format(z * 100)}%`}</th>`).join("")}</tr></thead>
    <tbody>${Object.keys(SEN_CORTO).filter((k) => prueba[k]).map((k) => `<tr><td class="izq fuerte">${SEN_CORTO[k]}</td>${TRAMOS.map((t) => celda(prueba[k], t)).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function panelChance(pr) {
  if (!pr || !pr.prueba) return "";
  const r = pr.resumen || {};
  const k = (v) => v != null ? `${nf0.format(v * 100)}%` : "—";
  return `<section class="tarjeta sen-respaldo-caja">
    <h2 style="margin:0 0 8px">Cómo se probó la chance</h2>
    <p class="apagado">Se ajustó con la ${esc(r.ajuste || "2024-25")} y se probó, sin tocar nada, con la ${esc(r.prueba || "2025-26 y lo que va de la 2026-27")}: ${nf0.format(r.dias || 0)} días, fecha por fecha, con lo que se sabía antes de cada partido.
      Cada fila dice qué tan seguido se cumplió lo que la app decía: si dice 70%, tiene que cumplirse cerca del 70%.</p>
    ${tablaCalibracion(pr.prueba)}
    <div class="sen-tops">
      <div><span class="apagado">Top 5 de cada día, casa que fija la línea solo con el historial</span><b>${k(r.top5_casa_simple)}</b><span class="apagado">antes ${k(r.viejo_casa_simple)}</span></div>
      <div><span class="apagado">Casa que además sabe la mitad de lo que sabe la app</span><b>${k(r.top5_casa_media)}</b><span class="apagado">antes ${k(r.viejo_casa_media)}</span></div>
    </div>
    <p class="apagado">Las líneas de la prueba son simuladas (no hay líneas reales guardadas de temporadas pasadas): contra las de una casa real la ventaja es menor. Para ganar con cuota 1,85 hace falta acertar 54%.
      La prueba de verdad es el <a href="#" class="enlace" data-stab="registro">Registro</a>.</p>
  </section>`;
}

function panelRespaldo(m, recalculando) {
  if (!m || !m.respaldo) return "";
  const top = m.top_sin_ausencias || m.top || {};
  const filaStat = (s, r) => ["mas", "menos"].map((lado) => {
    const x = (r[s] || {})[lado] || {};
    const celda = (k) => { const v = x[k]; if (!v || !v.n) return '<td class="apagado">—</td>';
      const floja = v.n >= 30 && v.acierto < ACIERTO_MIN;      // M-12
      return `<td${floja ? ' class="sen-floja" title="Se cumplió menos del 55%: estas señales no se muestran en el top"' : ""}>${v.n < 30 || floja ? '<span class="apagado">' : "<b>"}${nf0.format(v.acierto * 100)}%${v.n < 30 || floja ? "</span>" : "</b>"} <span class="apagado">${v.n}${floja ? ", no se muestra" : ""}</span></td>`; };
    const base = x.media?.base ?? x.fuerte?.base;
    return `<tr><td class="izq fuerte">${SEN_CORTO[s]} ${lado === "mas" ? "más" : "menos"}</td>${celda("media")}${celda("fuerte")}<td class="apagado">${base != null ? nf0.format(base * 100) + "%" : "—"}</td></tr>`;
  }).join("");
  const r = m.respaldo_sin_ausencias || m.respaldo;
  return `${panelChance(m.prob)}<details class="tarjeta sen-respaldo-caja sen-viejo"><summary><h2 style="margin:0;display:inline">Cómo se probaron los factores</h2> <span class="apagado">el esperado contra su promedio</span></summary>
    <div class="fila" style="margin:8px 0"><span class="espacio"></span>
      <button class="boton" data-srecalcular ${recalculando ? "disabled" : ""}>${recalculando ? "Haciendo la prueba…" : "Volver a hacer la prueba"}</button></div>
    <p class="apagado">Se recorrió ${esc(listaY(m.temporadas || []))} fecha por fecha sin mirar el futuro: con lo que se sabía cada mañana se armaron las señales y después se miró el partido.
      Se ajustó con los partidos del ${esc(fechaCorta(m.ajuste?.[0] || "").replace(/<[^>]+>/g, ""))} al ${esc(fechaCorta(m.ajuste?.[1] || "").replace(/<[^>]+>/g, ""))} y se probó, sin tocar nada, con los siguientes (${nf0.format(m.casos || 0)} casos en total).</p>
    <div class="sen-tops">${["15", "30", "50"].map((k) => top[k] ? `<div><span class="apagado">Top ${k} de cada día</span><b>${nf0.format(top[k].acierto * 100)}%</b><span class="apagado">${nf0.format(top[k].n)} señales</span></div>` : "").join("")}</div>
    <div class="caja-split"><table><thead><tr><th class="izq">Señal</th><th>Media (8 a 15%)</th><th>Fuerte (15% o más)</th><th>Al azar</th></tr></thead>
      <tbody>${Object.keys(SEN_CORTO).filter((s) => r[s]).map((s) => filaStat(s, r)).join("")}</tbody></table></div>
    <p class="apagado" style="margin-top:8px">Porcentaje de veces que se cumplió (al lado, cuántos casos; en gris, menos de 30, poco confiable, o menos del 55%, que no se muestra). "Al azar": qué tan seguido un jugador cualquiera pasa (o queda abajo de) su promedio.
      Sin reporte de lesiones. Lo que más pesa son los minutos recientes y los compañeros que faltan; el rival suma poco salvo en triples intentados.
      Prueba hecha ${m.creado ? `el ${esc(new Date(m.creado).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })).replace(/\.$/, "")}` : "con la app"}.</p>
  </details>`;
}

// bloque en el perfil del jugador (M-06)
async function senalesDelJugador(caja, pid) {
  try {
    const d = await llamar("senales", { player_id: pid, limite: 10 });
    if (!caja.isConnected) return;
    if (!d.senales.length) { caja.innerHTML = ""; return; }
    caja.innerHTML = `<div class="sen-perfil"><div class="fila" style="margin-bottom:8px"><h2 style="margin:0">Señales para el próximo partido</h2>
      <span class="apagado">contra su promedio</span><span class="espacio"></span><a href="#" data-sec="senales" class="enlace">Ver todas</a></div>
      <div class="sen-grilla">${d.senales.map((x) => tarjetaSenal(x, true)).join("")}</div></div>`;
    entrar(caja);
  } catch (e) { caja.innerHTML = ""; }
}

let senTimer;
document.addEventListener("click", async (e) => {
  const t = e.target;
  const g = t.closest("[data-sgraf]");
  if (g) { e.preventDefault(); const [pid, s] = g.dataset.sgraf.split("|"); return irGrafico(pid, SEN_GRAF[s] || s); }
  const an = t.closest("[data-sanotar]");
  if (an) {
    const [pid, s, lado, gid] = an.dataset.sanotar.split("|");
    const j = S.jugadorPorId[pid];
    const x = (S.sen?.senales || []).find((z) => z.player_id === Number(pid) && z.stat === s);
    return abrirFormulario({ modo: "anotar", piernas: [{ deporte: "NBA", player_id: Number(pid), jugador: j?.nombre || "", stat: s,
      linea: x ? (x.linea ?? Math.floor(x.base) + 0.5) : "", lado, game_id: gid }],
      nota: x ? `Señal${x.chance ? ` ${pctCh(x.chance)}` : ""}: ${x.motivos.map((m) => m.texto).slice(0, 2).join("; ")}` : "" });
  }
  if (S.ruta?.s !== "senales") return;
  const sg = t.closest("[data-sseg] button");
  if (sg) {
    const k = sg.parentElement.dataset.sseg;
    filtrosSenales()[k] = k === "limite" ? Number(sg.dataset.v) : sg.dataset.v;
    guardarPrefs();
    clearTimeout(senTimer);
    senTimer = setTimeout(() => vistaSenales($("#contenido")), 80);
    return;
  }
  if (t.closest("[data-slesiones]")) {
    const b = t.closest("[data-slesiones]"); b.textContent = "Actualizando…";
    const r = await llamar("actualizar_lesiones");
    if (!r.ok) aviso(`No se pudo bajar el reporte de lesiones: ${r.detalle}`, 7000);
    else aviso(`Lesiones actualizadas: ${r.cantidad} jugadores en el reporte.${r.sin_cruzar.length ? ` Sin cruzar: ${r.sin_cruzar.slice(0, 3).join(", ")}${r.sin_cruzar.length > 3 ? "…" : ""}` : ""}`, 6000);
    return vistaSenales($("#contenido"));
  }
  if (t.closest("[data-srecalcular]")) {
    await llamar("recalcular_senales");
    aviso("Haciendo la prueba de nuevo con toda la base. Tarda alrededor de un minuto.");
    const b = t.closest("[data-srecalcular]"); b.disabled = true; b.textContent = "Haciendo la prueba…";
    const espera = setInterval(async () => {
      const d = await llamar("senales", filtrosSenales());
      if (!d.recalculando) { clearInterval(espera); S.sen = d; if (S.ruta.s === "senales") pintarSenales($("#contenido")); aviso("Prueba terminada."); }
    }, 4000);
  }
});

// ---------------------------------------------------------------- lista de bajas (M-09)
const ESTADO_BAJA = { afuera: "Afuera", dudoso: "Dudoso", probable: "Probable" };
function filtrosBajas() {
  S.prefs.bajas_f = { estado: "", solo_juegan: false, ...(S.prefs.bajas_f || {}) };
  return S.prefs.bajas_f;
}
async function vistaBajas(c) {
  if (!c.querySelector(".bajas")) c.innerHTML = `<div class="senales bajas"><h1>Señales</h1>${pestanasSenales()}<div class="vacio">Cargando…</div></div>`;
  const d = await llamar("bajas");
  if (S.ruta.s !== "senales") return;
  S.bajas = d;
  pintarBajas(c);
}
function pintarBajas(c) {
  const d = S.bajas, f = filtrosBajas();
  const dia = d.fecha ? fechaCorta(d.fecha).replace(/<[^>]+>/g, "") : "";
  const equipos = d.equipos
    .filter((g) => !f.solo_juegan || g.juega)
    .map((g) => ({ ...g, jugadores: g.jugadores.filter((j) => !f.estado || j.estado === f.estado) }))
    .filter((g) => g.jugadores.length);
  const total = (e) => d.equipos.reduce((a, g) => a + g.jugadores.filter((j) => j.estado === e).length, 0);
  const seg = (k, ops) => `<div class="segmentado" data-bseg="${k}">${ops.map(([v, t]) => `<button data-v="${v}" class="${String(f[k]) === String(v) ? "activo" : ""}">${t}</button>`).join("")}</div>`;
  const prom = (p) => p ? `${nf0.format(p.min)} min, ${nf1.format(p.pts)} PTS, ${nf1.format(p.reb)} REB, ${nf1.format(p.ast)} AST${p.temporada !== S.datos?.temporada_actual ? ` <span class="apagado">(${esc(p.temporada)})</span>` : ""}` : '<span class="apagado">Sin partidos recientes</span>';
  const hora = (h) => h ? new Date(h).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "";
  c.innerHTML = `<div class="senales bajas">
    <h1>Señales</h1>
    <p class="sub" style="margin:4px 0 16px">Todos los jugadores del reporte de lesiones, por equipo. Primero los que juegan${dia ? ` el ${esc(dia)}` : ""}.</p>
    ${pestanasSenales()}
    <div class="filtros sen-filtros">
      <div class="campo"><span>Estado</span>${seg("estado", [["", "Todos"], ["afuera", `Afuera (${total("afuera")})`], ["dudoso", `Dudosos (${total("dudoso")})`], ["probable", `Probables (${total("probable")})`]])}</div>
      <label class="interruptor" style="align-self:center;margin-top:16px"><input type="checkbox" data-bsolo ${f.solo_juegan ? "checked" : ""}>Solo los equipos que juegan${dia ? ` el ${esc(dia)}` : ""}</label>
      <span class="espacio"></span>
    </div>
    <p class="sen-info">${d.actualizado ? `Reporte de ESPN (actualizado el ${esc(new Date(d.actualizado).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }))})${d.vigente ? "" : ' <span class="ambar">Tiene más de 30 horas: actualizalo.</span>'}` : '<span class="ambar">Todavía no hay reporte de lesiones.</span>'}
      <button class="enlace" data-slesiones>Actualizar lesiones</button></p>
    ${!d.actualizado ? '<div class="vacio">Tocá "Actualizar lesiones" para bajar el reporte.</div>'
      : !equipos.length ? '<div class="vacio">No hay bajas con estos filtros.</div>'
      : `<div class="bajas-grilla">${equipos.map((g) => `<section class="tarjeta baja-equipo">
          <div class="baja-cab">${logoMini(g.team_id)}<a href="#" data-equipo="${g.team_id}" class="fuerte">${esc(`${g.ciudad || ""} ${g.nombre || ""}`.trim() || g.tricode || "")}</a>
            <span class="espacio"></span>${g.juega ? `<span class="baja-juega">${g.juega.local ? "vs" : "@"} ${esc(g.juega.rival)}, ${esc(hora(g.juega.hora_utc))} h</span>` : '<span class="apagado">No juega</span>'}</div>
          ${g.jugadores.map((j) => `<div class="baja-fila">
            ${avatarJ(j.player_id, j.nombre, "chico")}
            <div class="baja-nombre"><a href="#" data-jugador="${j.player_id}">${esc(j.nombre)}</a>
              <span class="apagado">${esc(j.detalle || "")}${j.estado_fuente && ESTADO_BAJA[j.estado] !== j.estado_fuente ? `${j.detalle ? ", " : ""}${esc(j.estado_fuente)}` : ""}</span>
              <span class="baja-prom">${prom(j.prom)}</span></div>
            <span class="u-estado baja-${j.estado}">${ESTADO_BAJA[j.estado] || esc(j.estado)}</span></div>`).join("")}
        </section>`).join("")}</div>`}
  </div>`;
}
document.addEventListener("click", (e) => {
  if (S.ruta?.s !== "senales") return;
  const tb = e.target.closest("[data-stab]");
  if (tb) { e.preventDefault(); S.prefs.sen_tab = tb.dataset.stab; guardarPrefs(); vistaSenales($("#contenido")).then(() => entrar($(".senales"))); return; }
  const bs = e.target.closest("[data-bseg] button");
  if (bs) { filtrosBajas()[bs.parentElement.dataset.bseg] = bs.dataset.v; guardarPrefs(); return pintarBajas($("#contenido")); }
});
document.addEventListener("change", (e) => {
  if (S.ruta?.s !== "senales" || !e.target.matches("[data-bsolo]")) return;
  filtrosBajas().solo_juegan = e.target.checked; guardarPrefs(); pintarBajas($("#contenido"));
});

// ---------------------------------------------------------------- registro de señales (M-11)
const ESTADO_REG = { cumplida: "Se cumplió", fallada: "No se cumplió", no_jugo: "No jugó", pendiente: "Pendiente" };
async function vistaRegistro(c) {
  if (!c.querySelector(".registro")) c.innerHTML = `<div class="senales registro"><h1>Señales</h1>${pestanasSenales()}<div class="vacio">Cargando…</div></div>`;
  const d = await llamar("registro_senales");
  if (S.ruta.s !== "senales") return;
  S.reg = d;
  pintarRegistro(c);
}
function pintarRegistro(c) {
  const d = S.reg;
  const pc = (v) => (v == null ? "—" : `${nf0.format(v * 100)}%`);
  const kpi = (t, b, det) => `<div class="kpi"><div class="k">${t}</div><div class="v ${b.acierto != null && b.azar != null ? (b.acierto > b.azar ? "mas" : "menos") : ""}">${pc(b.acierto)}</div>
    <div class="d apagado">${b.n ? `${b.cumplidas} de ${b.n}${det ? `, ${det}` : ""}` : "todavía sin resultados"}</div></div>`;
  const fila = (t, b) => `<tr><td class="izq fuerte">${t}</td><td>${b.n || "—"}</td><td class="fuerte">${pc(b.acierto)}</td><td class="apagado">${pc(b.esperado)}</td><td class="apagado">${pc(b.azar)}</td></tr>`;
  const g = d.general;
  c.innerHTML = `<div class="senales registro">
    <h1>Señales</h1>
    <p class="sub" style="margin:4px 0 16px">Todas las señales que mostró la app, guardadas antes de cada partido, y si se cumplieron. Es la prueba real: la prueba con temporadas pasadas dice lo que <i>debería</i> pasar; esto, lo que pasa.
      Las que tienen línea se miden contra la línea; las anteriores a la versión 0.9, contra su promedio.</p>
    ${pestanasSenales()}
    ${!d.total ? `<div class="tarjeta u-vacio"><h2>Todavía no hay señales registradas</h2>
        <p class="apagado">Se guardan solas cada vez que se calculan (al abrir la app y al entrar a Señales), antes de que empiece cada partido. Los días en que no abrís la app no quedan registrados.</p></div>` : `
    <div class="kpis u-kpis">
      ${kpi("Todas", g, g.esperado != null ? `la prueba esperaba ${pc(g.esperado)}` : "")}
      ${kpi("Top 5 de cada día", d.top5 || {})}
      ${kpi("Top 15 de cada día", d.top15)}
      ${kpi("Con reporte de lesiones", d.con_lesiones)}
      <div class="kpi"><div class="k">Al azar</div><div class="v">${pc(g.azar)}</div><div class="d apagado">un jugador cualquiera</div></div>
      <div class="kpi"><div class="k">Pendientes</div><div class="v">${nf0.format(d.pendientes)}</div><div class="d apagado">partidos sin terminar</div></div>
      <div class="kpi"><div class="k">No jugó</div><div class="v">${nf0.format(d.no_jugo)}</div><div class="d apagado">no cuentan</div></div>
    </div>
    ${g.n && g.n < 100 ? `<p class="sen-info ambar">Con ${g.n} señales resueltas el margen de error todavía es grande (±${nf0.format(100 / Math.sqrt(g.n))} puntos): mirá la tendencia en unas semanas.</p>` : ""}
    <div class="caja-split" style="max-width:720px;margin-bottom:18px"><table><thead><tr><th class="izq"></th><th>Resueltas</th><th>Se cumplió</th><th>La prueba esperaba</th><th>Al azar</th></tr></thead><tbody>
      ${Object.entries(SEN_CORTO).filter(([k]) => d.por_stat[k]?.n).map(([k, t]) => fila(t, d.por_stat[k])).join("")}
      ${fila("Más", d.por_lado.mas)}${fila("Menos", d.por_lado.menos)}${fila("Medias", d.por_fuerza.media)}${fila("Fuertes", d.por_fuerza.fuerte)}
    </tbody></table></div>
    ${d.dias.map((dia) => `<section class="tarjeta reg-dia">
      <div class="fila" style="margin-bottom:6px"><h2 style="margin:0">${esc(fechaCorta(dia.fecha).replace(/<[^>]+>/g, ""))}</h2>
        <span class="apagado">${dia.n ? `${dia.cumplidas} de ${dia.n} se cumplieron (${pc(dia.acierto)})` : "sin resultados todavía"}</span></div>
      <div class="caja-split"><table><thead><tr><th>#</th><th class="izq">Jugador</th><th class="izq">Señal</th><th>Chance</th><th>Promedio</th><th>Esperado</th><th>Hizo</th><th class="izq">Resultado</th></tr></thead><tbody>
        ${dia.senales.map((x) => `<tr title="${esc(x.motivos.join(" / "))}"><td class="apagado">${x.puesto ?? ""}</td>
          <td class="izq"><a href="#" data-jugador="${x.player_id}">${esc(x.nombre)}</a> <span class="apagado">${esc(x.equipo || "")} ${x.local ? "vs" : "@"} ${esc(x.rival || "")}</span></td>
          <td class="izq"><span class="${x.lado === "mas" ? "mas" : "menos"}">${x.lado === "mas" ? "▲ Más" : "▼ Menos"}</span>${x.linea != null ? ` de ${lineaTxt(x.linea)}` : ""} ${esc(SEN_CORTO[x.stat] || x.stat)} <span class="apagado">${x.linea != null ? "" : pctSen(x.desvio)}</span></td>
          <td>${x.chance != null ? pctCh(x.chance) : '<span class="apagado">—</span>'}</td><td>${nf1.format(x.base)}</td><td>${nf1.format(x.esperado)}</td><td class="fuerte">${x.real == null ? "—" : nf0.format(x.real)}</td>
          <td class="izq"><span class="u-estado reg-${x.estado}">${ESTADO_REG[x.estado] || x.estado}</span></td></tr>`).join("")}
      </tbody></table></div></section>`).join("")}`}
  </div>`;
}

// ---------------------------------------------------------------- línea y cuota (M-13)
function estadoCalc() {
  const def = { pid: null, nombre: "", stat: "pts", modo: "hito", linea: "", hito: 15, cuota: "", lado: "mas" };
  S.prefs.calc = S.prefs.calc || {};
  for (const k in def) if (!(k in S.prefs.calc)) S.prefs.calc[k] = def[k];      // el mismo objeto: no perder cambios
  if (!Array.isArray(S.prefs.combi)) S.prefs.combi = [];
  return S.prefs.calc;
}
const lineaCalc = (f) => f.modo === "hito" && SEN_HITOS[f.stat] ? Number(f.hito) - 0.5 : parseFloat(String(f.linea).replace(",", "."));
const cuotaNum = (v) => { const c = parseFloat(String(v ?? "").replace(",", ".")); return c > 1 ? c : null; };

async function vistaCalc(c) {
  const f = estadoCalc();
  if (!SEN_HITOS[f.stat] && f.modo === "hito") f.modo = "linea";
  c.innerHTML = `<div class="senales calc">
    <h1>Señales</h1>
    <p class="sub" style="margin:4px 0 16px">Cargá el jugador, la línea de tu casa y la cuota: te dice la chance de la app, la cuota que valdría y si la de la casa paga de más.
      En bet365 los hitos "15+" son "más de 14,5".</p>
    ${pestanasSenales()}
    <section class="tarjeta calc-form">
      <label class="campo calc-jug"><span>Jugador</span>
        <input type="text" id="calc-jug" autocomplete="off" placeholder="Nombre o apodo" value="${esc(f.nombre)}">
        <div class="calc-sug" id="calc-sug"></div></label>
      <div class="campo"><span>Stat</span><div class="segmentado" data-cseg="stat">${SEN_STATS.slice(1).map(([v, t]) => `<button data-v="${v}" class="${f.stat === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
      ${SEN_HITOS[f.stat] ? `<div class="campo"><span>Tipo</span><div class="segmentado" data-cseg="modo">${[["hito", "Hito de bet365"], ["linea", "Línea"]].map(([v, t]) => `<button data-v="${v}" class="${f.modo === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>` : ""}
      ${f.modo === "hito" && SEN_HITOS[f.stat]
        ? `<div class="campo"><span>Hito</span><div class="segmentado" data-cseg="hito">${SEN_HITOS[f.stat].map((h) => `<button data-v="${h}" class="${Number(f.hito) === h ? "activo" : ""}">${h}+</button>`).join("")}</div></div>`
        : `<label class="campo"><span>Línea</span><input type="text" inputmode="decimal" id="calc-linea" value="${esc(String(f.linea))}" placeholder="14,5" style="width:80px"></label>
           <div class="campo"><span>Lado</span><div class="segmentado" data-cseg="lado">${[["mas", "Más"], ["menos", "Menos"]].map(([v, t]) => `<button data-v="${v}" class="${f.lado === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>`}
      <label class="campo"><span>Cuota</span><input type="text" inputmode="decimal" id="calc-cuota" value="${esc(String(f.cuota))}" placeholder="1,85" style="width:80px"></label>
      <button class="boton primario" data-ccalcular>Calcular</button>
    </section>
    <div id="calc-res">${f.pid ? '<div class="vacio">Calculando…</div>' : '<div class="vacio">Elegí un jugador para empezar.</div>'}</div>
    <div id="calc-combi">${pintarCombi()}</div>
  </div>`;
  if (f.pid) await calcular();
}

async function calcular() {
  const f = estadoCalc(), caja = $("#calc-res");
  if (!caja) return;
  const L = lineaCalc(f);
  if (!f.pid) { caja.innerHTML = '<div class="vacio">Elegí un jugador de la lista.</div>'; return; }
  if (!(L >= 0)) { caja.innerHTML = '<div class="vacio">Poné la línea (por ejemplo 14,5).</div>'; return; }
  const lado = f.modo === "hito" && SEN_HITOS[f.stat] ? "mas" : f.lado;
  const r = await llamar("chance_linea", f.pid, f.stat, L, cuotaNum(f.cuota), lado);
  if (S.ruta?.s !== "senales" || !$("#calc-res")) return;
  S.calcRes = r;
  caja.innerHTML = pintarCalc(r);
}

function pintarCalc(r) {
  if (r.falta) return `<div class="vacio">${esc(r.falta)}</div>`;
  const mas = r.lado === "mas", corto = SEN_CORTO[r.stat] || r.stat;
  const hora = r.partido?.hora_utc ? new Date(r.partido.hora_utc).toLocaleString("es-AR", { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "";
  const valor = r.valor != null ? `<div class="calc-dato"><span class="apagado">Con cuota ${nf2(r.cuota)}</span>
      <b class="${r.valor >= 0.03 ? "mas" : r.valor < 0 ? "menos" : ""}">${r.valor >= 0 ? "+" : "−"}${nf0.format(Math.abs(r.valor) * 100)}%</b>
      <span class="apagado">${r.valor >= 0.03 ? "paga más de lo que vale" : r.valor >= 0 ? "casi justa" : "paga menos de lo que vale"} (la casa le da ${nf0.format(r.chance_casa * 100)}%)</span></div>` : "";
  const hitos = SEN_HITOS[r.stat] && r.escalera?.length ? `<div class="calc-escalera"><span class="apagado">Todos los hitos</span>
      ${r.escalera.map((e) => `<button class="calc-hito${Math.abs(e.linea - r.linea) < 1e-9 ? " activo" : ""}" data-chito="${e.linea + 0.5}" title="Superó ${lineaTxt(e.linea)} en ${e.arriba} de sus últimos ${e.n}">
        <span>${e.linea + 0.5}+</span><b>${pctCh(e.chance_mas)}</b><span class="apagado">cuota justa ${e.chance_mas > 0.01 ? nf2(1 / e.chance_mas) : "—"}</span></button>`).join("")}</div>` : "";
  return `<section class="tarjeta calc-tarjeta ${r.lado}">
    <div class="sen-cab">${avatarJ(r.player_id, r.nombre)}
      <div style="min-width:0;flex:1"><a href="#" class="sen-nombre" data-jugador="${r.player_id}">${esc(r.nombre)}</a>
        <div class="apagado">${r.partido ? `${r.partido.local ? "vs" : "@"} ${esc(r.partido.rival || "")}${hora ? `, ${esc(hora)} h` : ""}` : "No tiene partido en los próximos días: se calcula con su promedio, sin los factores del día"}</div></div></div>
    <div class="calc-fila">
      <div class="calc-grande"><div class="sen-chance">${pctCh(r.chance)}</div><div><b>${mas ? "Más" : "Menos"} de ${lineaTxt(r.linea)} ${esc(corto)}</b>
        <div class="apagado">${mas ? "Menos" : "Más"}: ${pctCh(mas ? r.chance_menos : r.chance_mas)}</div></div></div>
      <div class="calc-dato"><span class="apagado">Cuota justa</span><b>${r.cuota_justa ? nf2(r.cuota_justa) : "—"}</b><span class="apagado">por debajo de esto, no conviene</span></div>
      ${valor}
      <div class="calc-dato"><span class="apagado">Promedio → esperado</span><b>${nf1.format(r.base)} → ${nf1.format(r.esperado)}</b><span class="apagado">superó ${lineaTxt(r.linea)} en ${r.historial.arriba} de sus últimos ${r.historial.n}</span></div>
    </div>
    ${avisosSenal({ ...r, dudosos_equipo: [] })}${r.afuera ? '<div class="sen-avisos"><div>Figura afuera en el reporte de lesiones.</div></div>' : ""}
    ${r.motivos?.length ? `<ul class="sen-motivos">${r.motivos.map((m) => `<li><span class="sen-aporte ${m.aporte > 0 ? "mas" : "menos"}">${pctSen(m.aporte)}</span>${esc(m.texto)}</li>`).join("")}</ul>` : ""}
    ${hitos}
    <div class="sen-pie"><span class="sen-respaldo">${textoRespaldo(r.respaldo_mas)}</span><span class="espacio"></span>
      <button class="enlace" data-sgraf="${r.player_id}|${r.stat}">Ver gráfico</button>
      <button class="enlace" data-ccombi>Sumar a la combinada</button></div>
  </section>`;
}
const nf2 = (v) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function pintarCombi() {
  const l = S.prefs.combi || [];
  if (!l.length) return "";
  // patas del mismo jugador, stat y lado (30+ y 25+ de puntos): si sale la más exigente salen todas, cuenta una sola
  const grupos = {};
  for (const x of l) { const k = `${x.player_id}|${x.stat}|${x.lado}`; grupos[k] = Math.min(grupos[k] ?? 1, x.chance); }
  const anidadas = Object.keys(grupos).length < l.length;
  const ch = Object.values(grupos).reduce((a, v) => a * v, 1);
  const cuotas = l.every((x) => x.cuota) ? l.reduce((a, x) => a * x.cuota, 1) : null;
  const mismo = new Set(l.map((x) => x.game_id).filter(Boolean)).size < l.filter((x) => x.game_id).length;
  return `<section class="tarjeta calc-combi">
    <div class="fila" style="margin-bottom:8px"><h2 style="margin:0">Combinada</h2><span class="apagado">${l.length} pata${l.length === 1 ? "" : "s"}</span><span class="espacio"></span><button class="enlace" data-cvaciar>Vaciar</button></div>
    <div class="caja-split"><table><thead><tr><th class="izq">Pata</th><th>Chance</th><th>Cuota</th><th></th></tr></thead><tbody>
      ${l.map((x, i) => `<tr><td class="izq"><b>${esc(x.nombre)}</b> ${x.lado === "mas" ? "más" : "menos"} de ${lineaTxt(x.linea)} ${esc(SEN_CORTO[x.stat] || x.stat)} <span class="apagado">${esc(x.rival ? `${x.local ? "vs" : "@"} ${x.rival}` : "")}</span></td>
        <td class="fuerte">${pctCh(x.chance)}</td><td>${x.cuota ? nf2(x.cuota) : '<span class="apagado">—</span>'}</td><td><button class="enlace" data-cquitar="${i}">Quitar</button></td></tr>`).join("")}
    </tbody></table></div>
    <div class="calc-fila" style="margin-top:10px">
      <div class="calc-dato"><span class="apagado">Chance de que salgan todas</span><b>${pctCh(ch)}</b><span class="apagado">cuota justa ${ch > 0 ? nf2(1 / ch) : "—"}</span></div>
      ${cuotas ? `<div class="calc-dato"><span class="apagado">Cuota de la combinada</span><b>${nf2(cuotas)}</b>
        <span class="${ch * cuotas - 1 >= 0 ? "mas" : "menos"}">${ch * cuotas - 1 >= 0 ? "+" : "−"}${nf0.format(Math.abs(ch * cuotas - 1) * 100)}% ${ch * cuotas - 1 >= 0 ? "a favor" : "en contra"}</span></div>` : '<div class="calc-dato"><span class="apagado">Cargá la cuota de cada pata para ver si la combinada conviene.</span></div>'}
    </div>
    <p class="apagado" style="margin-top:8px">Cada pata que sumás multiplica el riesgo: con 7 patas de 75%, salen todas 13 de cada 100 veces. Las patas del mismo partido no son independientes${mismo ? " (acá hay varias del mismo partido)" : ""}: si se escapa el partido, fallan juntas.
      ${anidadas ? "Hay patas del mismo jugador y stat: para la chance cuenta solo la más exigente." : ""}</p>
  </section>`;
}

function sugerirCalc() {
  const caja = $("#calc-sug"), t = $("#calc-jug")?.value || "";
  if (!caja) return;
  const res = buscar(t, 12).filter((r) => r.tipo === "j" && r.item.activo).slice(0, 6);
  caja.innerHTML = t && res.length ? res.map((r) => `<button data-cjug="${r.item.id}">${esc(r.item.nombre)} <span class="apagado">${esc(r.item.eq || "")}</span></button>`).join("") : "";
}
function leerCampos() {
  const f = estadoCalc();
  if ($("#calc-linea")) f.linea = $("#calc-linea").value;
  if ($("#calc-cuota")) f.cuota = $("#calc-cuota").value;
}

document.addEventListener("input", (e) => {
  if (S.ruta?.s !== "senales") return;
  if (e.target.id === "calc-jug") sugerirCalc();
});
document.addEventListener("keydown", (e) => {
  if (S.ruta?.s !== "senales" || e.key !== "Enter") return;
  if (e.target.id === "calc-jug") { const b = $("#calc-sug button"); if (b) b.click(); }
  else if (e.target.id === "calc-linea" || e.target.id === "calc-cuota") { leerCampos(); guardarPrefs(); calcular(); }
});
document.addEventListener("click", (e) => {
  const t = e.target;
  const otra = t.closest("[data-sotra]");
  if (otra) {
    e.preventDefault();
    const [pid, s, linea, lado] = otra.dataset.sotra.split("|");
    const f = estadoCalc(), h = Number(linea) + 0.5;
    Object.assign(f, { pid: Number(pid), nombre: S.jugadorPorId[pid]?.nombre || "", stat: s, linea: lineaTxt(linea), lado, cuota: "" });
    f.modo = lado === "mas" && (SEN_HITOS[s] || []).includes(h) ? "hito" : "linea";
    if (f.modo === "hito") f.hito = h;
    S.prefs.sen_tab = "calc"; guardarPrefs();
    if (S.ruta?.s !== "senales") return ir({ s: "senales" });
    return vistaCalc($("#contenido"));
  }
  if (S.ruta?.s !== "senales" || S.prefs.sen_tab !== "calc") return;
  const j = t.closest("[data-cjug]");
  if (j) {
    e.preventDefault();
    const f = estadoCalc(); f.pid = Number(j.dataset.cjug); f.nombre = S.jugadorPorId[f.pid]?.nombre || "";
    $("#calc-jug").value = f.nombre; $("#calc-sug").innerHTML = "";
    leerCampos(); guardarPrefs(); return calcular();
  }
  const sg = t.closest("[data-cseg] button");
  if (sg) {
    const f = estadoCalc(), k = sg.parentElement.dataset.cseg;
    leerCampos();
    const antes = f.stat;
    f[k] = k === "hito" ? Number(sg.dataset.v) : sg.dataset.v;
    if (k !== "lado") f.cuota = "";             // la cuota es de otra apuesta
    if (k === "stat" && SEN_HITOS[f.stat] && !SEN_HITOS[antes]) f.modo = "hito";
    if (k === "stat" && SEN_HITOS[f.stat] && !SEN_HITOS[f.stat].includes(Number(f.hito))) f.hito = SEN_HITOS[f.stat][Math.min(2, SEN_HITOS[f.stat].length - 1)];
    guardarPrefs(); return vistaCalc($("#contenido"));
  }
  const ht = t.closest("[data-chito]");
  if (ht) { const f = estadoCalc(); leerCampos(); f.modo = "hito"; f.hito = Number(ht.dataset.chito); f.cuota = ""; guardarPrefs(); return vistaCalc($("#contenido")); }
  if (t.closest("[data-ccalcular]")) { leerCampos(); guardarPrefs(); return calcular(); }
  if (t.closest("[data-ccombi]")) {
    const r = S.calcRes; if (!r || r.falta) return;
    S.prefs.combi.push({ player_id: r.player_id, nombre: r.nombre, stat: r.stat, linea: r.linea, lado: r.lado, chance: r.chance, cuota: r.cuota || null,
      rival: r.partido?.rival, local: r.partido?.local, game_id: r.partido ? `${r.partido.hora_utc}|${[S.jugadorPorId[r.player_id]?.eq, r.partido.rival].sort().join("-")}` : null });
    guardarPrefs(); $("#calc-combi").innerHTML = pintarCombi(); aviso("Sumada a la combinada."); return;
  }
  const q = t.closest("[data-cquitar]");
  if (q) { S.prefs.combi.splice(Number(q.dataset.cquitar), 1); guardarPrefs(); $("#calc-combi").innerHTML = pintarCombi(); return; }
  if (t.closest("[data-cvaciar]")) { S.prefs.combi = []; guardarPrefs(); $("#calc-combi").innerHTML = ""; }
});
