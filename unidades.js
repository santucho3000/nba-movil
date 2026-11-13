"use strict";
/* Stats NBA - Unidades (U-01 a U-17): registro de apuestas simples y parlays, resolución automática
   con las stats de la base, resultado en unidades, gráfico acumulado y desgloses. */

const U_STATS = ["pts", "reb", "ast", "fg3m", "pra", "pr", "pa", "ra", "fga", "fgm", "fg3a", ...Object.keys(MERC_EXTRA)];
const U_ESTADO = { pendiente: "Pendiente", ganada: "Ganada", perdida: "Perdida", nula: "Nula" };
const U_DEPORTES = ["NBA", "Fútbol", "Tenis", "NFL", "MLB", "Otro"];
const nfU = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const nfC = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfP = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const uTxt = (v, signo = true) => (v == null ? "—" : `${signo && v > 0 ? "+" : ""}${nfU.format(v)}`.replace("-", "−") + " u");
const pesos = (v) => {
  const vu = S.unid?.config?.valor_unidad;
  return vu && v != null ? `${v < 0 ? "−" : ""}${S.unid.config.moneda || "$"} ${nfP.format(Math.abs(v * vu))}` : "";
};
const statU = (k) => MERC_EXTRA[k] || STAT_G[k]?.t || k;
const chipEstado = (e, manual) => `<span class="u-estado ${e}"${manual ? ' title="Marcada a mano"' : ""}>${U_ESTADO[e] || e}${manual ? " ✎" : ""}</span>`;
function textoPierna(p, conJugador = true) {
  if (p.deporte !== "NBA") return `${esc(p.deporte)}: ${esc(p.descripcion || "")}`;
  const linea = esc(textoLinea(p.lado, nfU.format(p.linea), p.stat, statU(p.stat)));
  return `${conJugador ? `<b>${esc(p.jugador || "")}</b> ` : ""}${linea} <span class="apagado">${esc(p.descripcion || "")}${p.fecha ? `, ${esc(p.fecha.slice(8, 10) + "/" + p.fecha.slice(5, 7))}` : ""}</span>`;
}
function filtrosUnid() {
  S.prefs.unid_f = { desde: null, hasta: null, estado: "", tipo: "", deporte: "", ...(S.prefs.unid_f || {}) };
  return S.prefs.unid_f;
}

// ---------------------------------------------------------------- vista
async function vistaUnidades(c) {
  if (!c.querySelector(".unidades")) c.innerHTML = '<div class="unidades"><h1>Unidades</h1><div class="vacio">Cargando…</div></div>';
  const d = await llamar("unidades", filtrosUnid());
  if (S.ruta.s !== "unidades") return;
  S.unid = d;
  pintarUnidades(c);
}
async function recargarUnidades() {
  const d = await llamar("unidades", filtrosUnid());
  S.unid = d;
  if (S.ruta.s === "unidades") pintarUnidades($("#contenido"));
}

function pintarUnidades(c) {
  const d = S.unid, r = d.resumen, f = filtrosUnid(), cfg = d.config;
  const racha = r.racha ? `${r.racha.n} ${r.racha.estado === "ganada" ? (r.racha.n === 1 ? "ganada" : "ganadas") : (r.racha.n === 1 ? "perdida" : "perdidas")}` : "—";
  const kpi = (k, v, det = "", cl = "") => `<div class="kpi"><div class="k">${k}</div><div class="v ${cl}">${v}</div><div class="d apagado">${det}</div></div>`;
  const hayFiltro = f.desde || f.hasta || f.estado || f.tipo || f.deporte;
  const tab = S.prefs.unid_tab || "apuestas";
  const pestanas = `<div class="pestanas u-tabs">${[["apuestas", "Apuestas"], ["anotador", `Anotador${d.anotador?.length ? ` <span class="u-cuenta">${d.anotador.length}</span>` : ""}`]].map(([k, t]) =>
    `<button class="pestana${tab === k ? " activa" : ""}" data-utab="${k}">${t}</button>`).join("")}</div>`;
  if (tab === "anotador") {
    c.innerHTML = `<div class="unidades">
      <div class="fila u-cab">
        <div><h1>Unidades</h1><p class="sub" style="margin:4px 0 0">Líneas y cuotas que te gustaron, sin apostar. Cuando el partido termina, ves cómo hubieran salido.</p></div>
        <span class="espacio"></span>
        <button class="boton primario" data-uanotar>Anotar línea</button>
      </div>
      ${pestanas}
      ${panelAnotador(d.anotador || [])}
    </div>`;
    return;
  }
  c.innerHTML = `<div class="unidades">
    <div class="fila u-cab">
      <div><h1>Unidades</h1><p class="sub" style="margin:4px 0 0">Tus apuestas. Las de NBA se resuelven solas cuando el partido termina y está en la base.</p></div>
      <span class="espacio"></span>
      <label class="u-valor" title="Para ver el equivalente en plata (U-10). Vacío: solo unidades">1 u =
        <span class="apagado">${esc(cfg.moneda || "$")}</span><input type="number" class="control" min="0" step="100" data-uvalor value="${cfg.valor_unidad ?? ""}" placeholder="sin valor"></label>
      <button class="boton" data-unueva="parlay">Nuevo parlay</button>
      <button class="boton primario" data-unueva="simple">Nueva simple</button>
    </div>
    ${pestanas}
    <section class="tarjeta u-vivo" id="u-vivo" hidden></section>
    ${d.total ? `<div class="kpis u-kpis">
      ${kpi("Resultado", uTxt(r.resultado), pesos(r.resultado) || `${r.n} apuesta${r.n === 1 ? "" : "s"}`, r.resultado > 0 ? "mas" : r.resultado < 0 ? "menos" : "")}
      ${kpi("Acierto", r.acierto == null ? "—" : `${nf0.format(r.acierto * 100)}%`, `${r.ganadas} G, ${r.perdidas} P${r.nulas ? `, ${r.nulas} nula${r.nulas === 1 ? "" : "s"}` : ""}`)}
      ${kpi("Yield", r.yield == null ? "—" : `${r.yield > 0 ? "+" : ""}${nf1.format(r.yield * 100)}%`.replace("-", "−"), `sobre ${uTxt(r.apostado, false)} apostadas`, r.yield > 0 ? "mas" : r.yield < 0 ? "menos" : "")}
      ${kpi("Cuota promedio", r.cuota_promedio ? nfC.format(r.cuota_promedio) : "—", "de las resueltas")}
      ${kpi("Racha actual", racha, "", r.racha ? (r.racha.estado === "ganada" ? "mas" : "menos") : "")}
      ${kpi("En juego", uTxt(r.en_juego, false), r.pendientes ? `${r.pendientes} pendiente${r.pendientes === 1 ? "" : "s"}, a ganar ${uTxt(r.a_ganar, false)}` : "nada pendiente")}
    </div>
    <section class="tarjeta u-curva-caja"><div class="fila"><h2 style="margin:0">Unidades acumuladas</h2>
      <span class="apagado">${hayFiltro ? "con los filtros de abajo" : "todas las apuestas resueltas, en orden"}</span></div>
      <div class="u-curva" id="u-curva"></div><div class="graf-tip" hidden></div></section>` : ""}
    <div class="filtros u-filtros">
      <label class="campo"><span>Desde</span><input type="date" class="control" data-uf="desde" value="${f.desde || ""}"></label>
      <label class="campo"><span>Hasta</span><input type="date" class="control" data-uf="hasta" value="${f.hasta || ""}"></label>
      <div class="campo"><span>Estado</span><div class="segmentado" data-useg="estado">${[["", "Todas"], ...Object.entries(U_ESTADO)].map(([v, t]) =>
        `<button data-v="${v}" class="${f.estado === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
      <div class="campo"><span>Tipo</span><div class="segmentado" data-useg="tipo">${[["", "Todas"], ["simple", "Simples"], ["parlay", "Parlays"]].map(([v, t]) =>
        `<button data-v="${v}" class="${f.tipo === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
      <label class="campo"><span>Deporte</span><select class="control" data-uf="deporte"><option value="">Todos</option>
        ${d.deportes.map((x) => `<option ${f.deporte === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
      <span class="espacio"></span><span class="apagado">${d.apuestas.length} de ${d.total}</span>
    </div>
    ${tablaApuestas(d.apuestas)}
    ${d.apuestas.some((a) => a.estado !== "pendiente") ? panelDesgloses(d) : ""}
  </div>`;
  if (d.total) dibujarCurva();
  contarKpis(c.querySelector(".u-kpis"));
  pintarUnidadesVivo();          // U-16: las de hoy, con su barrita
}

// ---------------------------------------------------------------- tabla (U-01, U-11)
function tablaApuestas(lista) {
  if (!S.unid.total) {
    return `<div class="tarjeta u-vacio"><h2>Todavía no cargaste apuestas</h2>
      <p class="apagado">Cargá una simple o un parlay con los botones de arriba, o desde el gráfico de cualquier jugador con "Registrar apuesta" y "+ Parlay": se completan solos el jugador, la stat, la línea y el próximo partido.</p></div>`;
  }
  if (!lista.length) return '<div class="vacio">No hay apuestas con estos filtros.</div>';
  const abiertas = new Set(S.unidAbiertas || []);
  return `<div class="tabla-caja u-tabla"><table><thead><tr><th class="izq">Fecha</th><th class="izq">Apuesta</th><th>Cuota</th><th>Unidades</th>
    <th class="izq">Estado</th><th>Resultado</th><th></th></tr></thead><tbody>
    ${lista.map((a) => {
      const parlay = a.tipo === "parlay", ab = abiertas.has(a.id);
      const desc = parlay
        ? `<button class="u-desplegar" data-uabrir="${a.id}" aria-expanded="${ab}"><span class="u-flecha">${ab ? "▾" : "▸"}</span> ${a.grupos?.length > 1 ? `Ticket de ${a.grupos.length} combinadas (${a.piernas.length} patas)` : `Parlay de ${a.piernas.length} piernas`}</button>
           <span class="apagado">${a.piernas.map((p) => `<i class="u-punto ${p.estado}" title="${esc(U_ESTADO[p.estado])}"></i>`).join("")}</span>`
        : textoPierna(a.piernas[0]);
      const valor = !parlay && a.piernas[0].valor != null && a.piernas[0].deporte === "NBA" ? ` <span class="apagado">(hizo ${nfU.format(a.piernas[0].valor)})</span>` : "";
      let html = `<tr class="u-fila ${a.estado}"><td class="izq">${esc(fechaCorta(a.fecha).replace(/<[^>]+>/g, ""))}</td>
        <td class="izq u-desc">${desc}${valor}${a.casa ? ` <span class="u-casa">${esc(a.casa)}</span>` : ""}${a.aviso ? `<div class="u-aviso">${esc(a.aviso)}</div>` : ""}${a.nota ? `<div class="apagado u-nota">${esc(a.nota)}</div>` : ""}</td>
        <td>${nfC.format(a.cuota_final || a.cuota)}${a.cuota_final && a.cuota_final !== a.cuota ? ` <span class="apagado" title="Cuota original">(${nfC.format(a.cuota)})</span>` : ""}</td>
        <td>${nfU.format(a.unidades)}</td>
        <td class="izq">${chipEstado(a.estado, a.manual)}</td>
        <td class="fuerte ${a.resultado > 0 ? "mas" : a.resultado < 0 ? "menos" : ""}">${a.resultado == null ? '<span class="apagado">—</span>' : uTxt(a.resultado)}</td>
        <td><button class="boton-menu" data-umenu="apuesta|${a.id}" title="Editar, marcar o borrar">⋯</button></td></tr>`;
      if (parlay && ab) {
        let previo = null;
        html += a.piernas.map((p) => {
          const g = a.grupos && p.grupo != null ? a.grupos[p.grupo] : null;
          const cab = g && p.grupo !== previo ? `<tr class="u-grupo"><td></td><td class="izq" colspan="6">Combinada ${p.grupo + 1}: ${esc(g.partido || "")}${g.cuota ? ` <span class="apagado">cuota ${nfC.format(g.cuota)}</span>` : ""}</td></tr>` : "";
          previo = p.grupo;
          return cab + `<tr class="u-pierna"><td></td><td class="izq">${textoPierna(p)}${p.valor != null && p.deporte === "NBA" ? ` <span class="apagado">(hizo ${nfU.format(p.valor)})</span>` : ""}</td>
          <td>${p.cuota ? nfC.format(p.cuota) : '<span class="apagado">—</span>'}</td><td></td>
          <td class="izq">${chipEstado(p.estado, p.manual)}</td><td></td>
          <td><button class="boton-menu" data-umenu="pierna|${p.id}" title="Marcar esta pierna">⋯</button></td></tr>`; }).join("");
      }
      return html;
    }).join("")}</tbody></table></div>`;
}

// ---------------------------------------------------------------- gráfico acumulado (U-07)
function dibujarCurva() {
  const caja = $("#u-curva");
  if (!caja) return;
  const cv = S.unid.curva, pts = cv.puntos;
  if (!pts.length) { caja.innerHTML = '<div class="vacio" style="padding:24px">Cuando se resuelva la primera apuesta, acá vas a ver cómo van tus unidades.</div>'; return; }
  const W = Math.max(320, caja.clientWidth), H = 220, izq = 52, der = 18, arr = 22, abj = 26;
  const vals = [0, ...pts.map((p) => p.acum)];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  const { tope, paso } = escalaLinda((hi - lo) * 1.1);
  const base = Math.floor(lo / paso) * paso, techo = Math.max(base + tope, Math.ceil(hi / paso) * paso);
  const x = (i) => izq + (i / Math.max(1, pts.length)) * (W - izq - der);
  const y = (v) => arr + (1 - (v - base) / (techo - base)) * (H - arr - abj);
  const linea = [`${x(0)},${y(0)}`, ...pts.map((p, i) => `${x(i + 1)},${y(p.acum)}`)].join(" ");
  let s = `<svg width="${W}" height="${H}" class="graf-svg">`;
  for (let v = base; v <= techo + 1e-9; v += paso) {
    s += `<line x1="${izq}" x2="${W - der}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "#3a4657" : COLOR.grilla}" stroke-width="1"${v === 0 ? "" : ""}/>
      <text x="${izq - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${COLOR.apagado}">${(v > 0 ? "+" : "") + nfU.format(v).replace("-", "−")}</text>`;
  }
  const pc = cv.peor_caida;
  if (pc) {
    const a = pc.desde, b = pc.hasta;
    s += `<rect x="${x(a)}" y="${arr - 6}" width="${Math.max(2, x(b) - x(a))}" height="${H - arr - abj + 6}" fill="${COLOR.rojo}" fill-opacity=".07" rx="4"/>
      <text x="${(x(a) + x(b)) / 2}" y="${arr - 9}" text-anchor="middle" font-size="11" font-weight="600" fill="${COLOR.rojo}">Peor caída ${uTxt(pc.caida)}</text>`;
  }
  s += `<polygon points="${x(0)},${y(0)} ${linea} ${x(pts.length)},${y(0)}" fill="var(--acento)" fill-opacity=".08"/>
    <polyline class="u-linea" points="${linea}" fill="none" stroke="var(--acento)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const iMax = pts.findIndex((p) => p.acum === cv.maximo);
  if (cv.maximo > 0 && iMax >= 0) {
    const mx = x(iMax + 1), my = y(cv.maximo);
    s += `<circle cx="${mx}" cy="${my}" r="4.5" fill="var(--acento)" stroke="var(--panel)" stroke-width="2"/>
      <text x="${Math.min(mx, W - der - 60)}" y="${my - 10}" text-anchor="middle" font-size="11" font-weight="600" fill="${COLOR.texto}">Máximo ${uTxt(cv.maximo)}</text>`;
  }
  const ult = pts[pts.length - 1];
  s += `<circle cx="${x(pts.length)}" cy="${y(ult.acum)}" r="4" fill="var(--acento)"/>`;
  const f = (p) => p.fecha.slice(8, 10) + "/" + p.fecha.slice(5, 7);
  s += `<text x="${x(1)}" y="${H - 6}" font-size="10.5" fill="${COLOR.apagado}" text-anchor="start">${f(pts[0])}</text>
    <text x="${x(pts.length)}" y="${H - 6}" font-size="10.5" fill="${COLOR.apagado}" text-anchor="end">${f(ult)}</text>
    <line class="u-cruz" x1="0" x2="0" y1="${arr}" y2="${H - abj}" stroke="${COLOR.tenue}" stroke-dasharray="3 3" opacity="0"/>
    <circle class="u-cruz-p" r="5" fill="var(--acento)" stroke="var(--panel)" stroke-width="2" opacity="0"/>
    <rect x="${izq}" y="0" width="${W - izq - der}" height="${H}" fill="transparent" class="u-zona"/></svg>`;
  caja.innerHTML = s;
  // detalle al pasar el mouse: la apuesta de ese punto y cómo quedó el acumulado
  const svg = caja.querySelector("svg"), tip = caja.parentElement.querySelector(".graf-tip");
  const cruz = svg.querySelector(".u-cruz"), punto = svg.querySelector(".u-cruz-p");
  svg.onmousemove = (e) => {
    const rect = svg.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - izq) / (W - izq - der)) * pts.length);
    if (i < 1 || i > pts.length) { tip.hidden = true; cruz.setAttribute("opacity", 0); punto.setAttribute("opacity", 0); return; }
    const p = pts[i - 1], a = S.unid.apuestas.find((z) => z.id === p.id);
    cruz.setAttribute("x1", x(i)); cruz.setAttribute("x2", x(i)); cruz.setAttribute("opacity", 0.6);
    punto.setAttribute("cx", x(i)); punto.setAttribute("cy", y(p.acum)); punto.setAttribute("opacity", 1);
    tip.innerHTML = `<div class="tip-cab">${esc(f(p))}, apuesta ${i} de ${pts.length}</div>
      ${a ? `<div class="tip-sub">${a.tipo === "parlay" ? `Parlay de ${a.piernas.length}` : textoPierna(a.piernas[0])}</div>` : ""}
      <div class="tip-linea ${p.resultado > 0 ? "mas" : p.resultado < 0 ? "menos" : ""}">${uTxt(p.resultado)}${pesos(p.resultado) ? ` <span class="apagado">${pesos(p.resultado)}</span>` : ""}</div>
      <div class="tip-sub" style="margin-top:6px">Acumulado <b>${uTxt(p.acum)}</b>${pesos(p.acum) ? ` <span class="apagado">${pesos(p.acum)}</span>` : ""}</div>`;
    tip.hidden = false;
    const caj = tip.parentElement.getBoundingClientRect();
    let left = e.clientX - caj.left + 14;
    if (left + 260 > caj.width) left -= 280;
    tip.style.left = left + "px";
    tip.style.top = e.clientY - caj.top + 14 + "px";
  };
  svg.onmouseleave = () => { tip.hidden = true; cruz.setAttribute("opacity", 0); punto.setAttribute("opacity", 0); };
  if (caja._obs) caja._obs.disconnect();
  let ancho = caja.clientWidth;
  caja._obs = new ResizeObserver(() => { if (caja.isConnected && Math.abs(caja.clientWidth - ancho) > 4) { ancho = caja.clientWidth; dibujarCurva(); } });
  caja._obs.observe(caja);
}

// ---------------------------------------------------------------- desgloses (U-09, U-17)
const U_DESGLOSES = [["stat", "Por stat"], ["lado", "Más o menos"], ["cuota", "Por cuota"], ["mes", "Por mes"], ["tipo", "Simple o parlay"],
  ["deporte", "Por deporte"], ["piernas", "Piernas"]];
function panelDesgloses(d) {
  const k = S.prefs.unid_desglose || "stat";
  const pct = (v) => (v == null ? "—" : `${nf0.format(v * 100)}%`);
  const tabla = (filas, titulo) => `<table><thead><tr><th class="izq">${titulo}</th><th>Apuestas</th><th>G-P</th><th>Acierto</th><th>Apostado</th><th>Resultado</th><th>Yield</th></tr></thead><tbody>
    ${filas.map((r) => `<tr><td class="izq fuerte">${esc(k === "mes" ? mesLargo(r.clave) : r.clave || "—")}</td><td>${r.n}</td><td>${r.ganadas}-${r.perdidas}</td><td>${pct(r.acierto)}</td>
      <td>${nfU.format(r.apostado)}</td><td class="fuerte ${r.resultado > 0 ? "mas" : r.resultado < 0 ? "menos" : ""}">${uTxt(r.resultado)}</td>
      <td class="${r.yield > 0 ? "mas" : r.yield < 0 ? "menos" : ""}">${r.yield == null ? "—" : `${r.yield > 0 ? "+" : ""}${nf1.format(r.yield * 100)}%`.replace("-", "−")}</td></tr>`).join("")}</tbody></table>`;
  const tablaPiernas = (filas, titulo) => `<div><h3 class="u-sub">${titulo}</h3><table><thead><tr><th class="izq"></th><th>Piernas</th><th>Acierto</th><th title="Piernas perdidas que hicieron perder un parlay">Tumbaron</th></tr></thead><tbody>
    ${filas.length ? filas.map((r) => `<tr><td class="izq fuerte">${esc(r.clave)}</td><td>${r.n}</td><td>${pct(r.acierto)}</td><td>${r.tumbaron || '<span class="apagado">0</span>'}</td></tr>`).join("")
      : '<tr><td colspan="4" class="apagado izq">Sin piernas resueltas</td></tr>'}</tbody></table></div>`;
  const cuerpo = k === "piernas"
    ? `<div class="u-piernas">${tablaPiernas(d.por_pierna.stat, "Por stat")}${tablaPiernas(d.por_pierna.lado, "Más o menos")}${tablaPiernas(d.por_pierna.jugador.slice(0, 15), "Por jugador")}</div>
       <p class="apagado" style="margin-top:8px">Cuenta cada pierna de NBA resuelta, sea de una simple o de un parlay. "Tumbaron": piernas perdidas que hicieron perder un parlay.</p>`
    : `<div class="caja-split">${tabla(d.desgloses[k] || [], U_DESGLOSES.find((x) => x[0] === k)[1].replace("Por ", "").replace(/^./, (m) => m.toUpperCase()))}</div>
       ${k === "stat" || k === "lado" ? '<p class="apagado" style="margin-top:8px">Las simples de NBA van por su stat; los parlays, juntos en "Parlay" (el detalle por pierna está en "Piernas").</p>' : ""}`;
  return `<section class="tarjeta u-desgloses"><div class="fila" style="margin-bottom:10px"><h2 style="margin:0">Dónde ganás y dónde perdés</h2></div>
    <div class="segmentado u-desg-tabs">${U_DESGLOSES.map(([v, t]) => `<button data-udesg="${v}" class="${k === v ? "activo" : ""}">${t}</button>`).join("")}</div>
    <div class="u-desg-cuerpo">${cuerpo}</div></section>`;
}
function mesLargo(ym) {
  if (!ym) return "—";
  const [a, m] = ym.split("-");
  return `${MESES[Number(m) - 1][0].toUpperCase() + MESES[Number(m) - 1].slice(1)} ${a}`;
}

// ---------------------------------------------------------------- anotador (U-18)
const SALIO = { ganada: "Hubiera ganado", perdida: "Hubiera perdido", nula: "Nula", pendiente: "Por jugarse" };
function panelAnotador(lista) {
  if (!lista.length) {
    return `<div class="tarjeta u-vacio"><h2>Tu anotador está vacío</h2>
      <p class="apagado">Guardá acá las líneas y cuotas que te gustan aunque no las apuestes: con "Anotar línea", o desde el gráfico de cualquier jugador con "Anotar". Cuando se juegue el partido vas a ver si hubiera salido.</p></div>`;
  }
  const jugadas = lista.filter((a) => a.salio === "ganada" || a.salio === "perdida");
  const acert = jugadas.filter((a) => a.salio === "ganada").length;
  const fila = (a) => {
    const p = { ...a };
    const hizo = a.valor != null && a.deporte === "NBA" ? ` <span class="apagado">(hizo ${nfU.format(a.valor)})</span>` : "";
    return `<tr class="u-fila"><td class="izq">${a.fecha ? esc(fechaCorta(a.fecha).replace(/<[^>]+>/g, "")) : '<span class="apagado">—</span>'}</td>
      <td class="izq u-desc">${textoPierna(p)}${a.casa ? ` <span class="u-casa">${esc(a.casa)}</span>` : ""}${a.nota ? `<div class="apagado u-nota">${esc(a.nota)}</div>` : ""}</td>
      <td>${a.cuota ? nfC.format(a.cuota) : '<span class="apagado">—</span>'}</td>
      <td class="izq"><span class="u-estado ${a.salio === "pendiente" ? "" : a.salio}">${SALIO[a.salio] || a.salio}</span>${hizo}</td>
      <td class="u-acciones">${a.salio === "pendiente" ? `<button class="boton" data-uaapostar="${a.id}">Apostar</button><button class="boton" data-uaparlay="${a.id}">+ Parlay</button>` : ""}
        <button class="boton-menu" data-uaeditar="${a.id}" title="Editar">✎</button><button class="boton-menu" data-uaborrar="${a.id}" title="Borrar">✕</button></td></tr>`;
  };
  return `${jugadas.length ? `<p class="apagado" style="margin:0 0 10px">De las ya jugadas, <b class="${acert / jugadas.length >= 0.5 ? "mas" : "menos"}">${acert} de ${jugadas.length}</b> hubieran salido.</p>` : ""}
    <div class="tabla-caja u-tabla"><table><thead><tr><th class="izq">Fecha</th><th class="izq">Línea</th><th>Cuota</th><th class="izq">Cómo salió</th><th></th></tr></thead>
    <tbody>${lista.map(fila).join("")}</tbody></table></div>`;
}
function piernaDeAnotacion(a) {
  return piernaNueva({ deporte: a.deporte, player_id: a.player_id, jugador: a.jugador, stat: a.stat, linea: a.linea, lado: a.lado,
    cuota: a.cuota ?? "", descripcion: a.deporte === "NBA" ? "" : a.descripcion, fecha: a.fecha || "", game_id: a.game_id });
}

// ---------------------------------------------------------------- menú de una fila
function menuApuesta(boton, tipo, id) {
  document.querySelectorAll(".u-menu").forEach((m) => m.remove());
  const m = document.createElement("div");
  m.className = "fav-menu u-menu desplegar-lista";
  m.innerHTML = `${tipo === "apuesta" ? '<button data-uacc="editar">Editar</button>' : ""}
    <h4>Marcar a mano</h4>
    ${["ganada", "perdida", "nula", "pendiente"].map((e) => `<button data-uacc="marcar|${e}">${U_ESTADO[e]}</button>`).join("")}
    <button data-uacc="marcar|auto" title="Que la app la resuelva sola con las stats">Automático</button>
    ${tipo === "apuesta" ? '<h4></h4><button data-uacc="borrar" class="u-peligro">Borrar</button>' : ""}`;
  document.body.appendChild(m);
  const r = boton.getBoundingClientRect();
  m.style.top = `${Math.min(window.innerHeight - m.offsetHeight - 8, r.bottom + 4)}px`;
  m.style.left = `${Math.max(8, r.right - m.offsetWidth)}px`;
  m.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-uacc]");
    if (!b) return;
    m.remove();
    const [acc, val] = b.dataset.uacc.split("|");
    if (acc === "editar") return abrirFormulario(apuestaAFormulario(S.unid.apuestas.find((a) => a.id === id)));
    if (acc === "borrar") {
      if (await confirmar("¿Borrar esta apuesta?", "No se puede deshacer.", "Borrar")) { await llamar("borrar_apuesta", id); aviso("Apuesta borrada."); recargarUnidades(); }
      return;
    }
    if (acc === "marcar") { await llamar("marcar_apuesta", tipo, id, val === "auto" ? null : val); recargarUnidades(); }
  });
  setTimeout(() => document.addEventListener("click", function fuera(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("click", fuera); } }), 0);
}
function confirmar(titulo, texto, si = "Aceptar") {
  return new Promise((ok) => {
    const fondo = document.createElement("div");
    fondo.className = "dialogo-fondo";
    fondo.innerHTML = `<div class="dialogo desplegar-lista"><h2>${esc(titulo)}</h2><p class="apagado">${esc(texto)}</p>
      <div class="fila" style="margin-top:14px"><span class="espacio"></span><button class="boton" data-d="no">Cancelar</button><button class="boton primario" data-d="si">${esc(si)}</button></div></div>`;
    document.body.appendChild(fondo);
    const cerrar = (v) => { fondo.remove(); ok(v); };
    fondo.addEventListener("click", (e) => { const b = e.target.closest("[data-d]"); if (b) cerrar(b.dataset.d === "si"); else if (e.target === fondo) cerrar(false); });
    fondo.querySelector("[data-d=si]").focus();
  });
}

// ---------------------------------------------------------------- formulario (U-01, U-03, U-06, U-12)
function piernaNueva(base = {}) {
  return { deporte: "NBA", player_id: null, jugador: "", stat: "pts", linea: "", lado: "mas", cuota: "", descripcion: "", fecha: "", game_id: null, ...base };
}
function apuestaAFormulario(a) {
  return {
    id: a.id, cuota: a.cuota, unidades: a.unidades, casa: a.casa || "", nota: a.nota || "", grupos: a.grupos || null,
    piernas: a.piernas.map((p) => piernaNueva({ deporte: p.deporte, player_id: p.player_id, jugador: p.jugador, stat: p.stat, linea: p.linea,
      lado: p.lado, cuota: p.cuota ?? "", descripcion: p.deporte === "NBA" ? "" : p.descripcion, fecha: p.fecha || "", game_id: p.game_id, grupo: p.grupo })),
  };
}
const numero = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };

function abrirFormulario(inicial = {}) {
  document.querySelectorAll(".u-form-fondo").forEach((x) => x.remove());
  const anotar = inicial.modo === "anotar";        // U-18: una sola línea, sin unidades
  const st = { cuota: "", unidades: S.prefs.unid_ultima ?? 1, casa: "", nota: "", ...inicial };
  st.piernas = (st.piernas && st.piernas.length ? st.piernas : [piernaNueva()]).map((p) => piernaNueva(p));
  if (inicial.tipo === "parlay" && st.piernas.length < 2) st.piernas.push(piernaNueva());
  const fondo = document.createElement("div");
  fondo.className = "dialogo-fondo u-form-fondo";
  document.body.appendChild(fondo);
  const partidosDe = {};      // player_id -> lista de partidos

  async function cargarPartidos(p) {
    if (!p.player_id) return;
    if (!partidosDe[p.player_id]) partidosDe[p.player_id] = (await llamar("partidos_apuesta", p.player_id)).partidos || [];
    const lista = partidosDe[p.player_id];
    if (!p.game_id || !lista.some((x) => x.game_id === p.game_id)) {
      const g = lista.find((x) => x.proximo) || lista.filter((x) => x.estado === 3).pop() || lista[0];
      p.game_id = g ? g.game_id : null;
    }
  }
  const productoCuotas = () => {
    const cs = st.piernas.map((p) => numero(p.cuota));
    return cs.every((c) => c && c > 1) ? cs.reduce((a, b) => a * b, 1) : null;
  };
  function pintarForm() {
    const parlay = st.piernas.length > 1;
    const prod = productoCuotas();
    const cuota = parlay ? numero(st.cuota) : numero(st.piernas[0].cuota);
    const u = numero(st.unidades);
    const ganancia = cuota && u ? u * (cuota - 1) : null;
    const filaPierna = (p, i) => {
      const nba = p.deporte === "NBA";
      const partidos = partidosDe[p.player_id] || [];
      const dia = (g) => `${DIAS[new Date(g.fecha + "T12:00:00").getDay()]} ${g.fecha.slice(8, 10)}/${g.fecha.slice(5, 7)}`;
      return `<div class="u-pierna-form" data-i="${i}">
        <div class="u-pierna-cab"><b>${parlay ? `Pierna ${i + 1}` : "Apuesta"}</b>
          <select class="control u-dep" data-pf="deporte">${U_DEPORTES.map((x) => `<option ${p.deporte === x ? "selected" : ""}>${x}</option>`).join("")}</select>
          <span class="espacio"></span>${parlay ? `<button class="enlace" data-pquitar="${i}">Quitar</button>` : ""}</div>
        ${nba ? `<div class="u-grid">
          <div class="campo u-jug"><span>Jugador</span>${p.player_id
            ? `<div class="u-elegido">${avatarJ(p.player_id, p.jugador, "chico")}<b>${esc(p.jugador)}</b><button class="enlace" data-pcambiar="${i}">Cambiar</button></div>`
            : `<div class="u-selector" data-psel="${i}"></div>`}</div>
          <label class="campo"><span>Partido</span><select class="control" data-pf="game_id" ${partidos.length ? "" : "disabled"}>
            ${partidos.length ? partidos.map((g) => `<option value="${g.game_id}" ${p.game_id === g.game_id ? "selected" : ""}>${esc(g.texto)}, ${dia(g)}${g.estado === 3 ? " (jugado)" : g.proximo ? " (próximo)" : ""}</option>`).join("")
              : `<option>${p.player_id ? "Sin partidos" : "Elegí el jugador"}</option>`}</select></label>
          <label class="campo"><span>Stat</span><select class="control" data-pf="stat">${U_STATS.map((k) => `<option value="${k}" ${p.stat === k ? "selected" : ""}>${esc(statU(k))}</option>`).join("")}</select></label>
          <div class="campo"><span>Lado</span><div class="segmentado" data-plado="${i}">
            <button data-v="mas" class="${p.lado === "mas" ? "activo" : ""}">${SI_NO.has(p.stat) ? "Sí" : "Más"}</button><button data-v="menos" class="${p.lado === "menos" ? "activo" : ""}">${SI_NO.has(p.stat) ? "No" : "Menos"}</button></div></div>
          ${SI_NO.has(p.stat) ? '<div class="campo"><span>Línea</span><span class="apagado u-sn">Sí o No</span></div>'
            : `<label class="campo"><span>Línea</span><input type="number" class="control" step="0.5" min="0" data-pf="linea" value="${p.linea ?? ""}" placeholder="24,5"></label>`}
          <label class="campo"><span>Cuota</span><input type="number" class="control" step="0.01" min="1.01" data-pf="cuota" value="${p.cuota ?? ""}" placeholder="${parlay ? "opcional" : "1,85"}"></label>
        </div>` : `<div class="u-grid u-grid-otro">
          <label class="campo u-desc-campo"><span>Qué apostaste</span><input class="control" maxlength="200" data-pf="descripcion" value="${esc(p.descripcion || "")}" placeholder="Por ejemplo: River gana, más de 2,5 goles"></label>
          <label class="campo"><span>Fecha</span><input type="date" class="control" data-pf="fecha" value="${p.fecha || ""}"></label>
          <label class="campo"><span>Cuota</span><input type="number" class="control" step="0.01" min="1.01" data-pf="cuota" value="${p.cuota ?? ""}" placeholder="${parlay ? "opcional" : "1,85"}"></label>
        </div>`}</div>`;
    };
    fondo.innerHTML = `<div class="dialogo u-form desplegar-lista" role="dialog" aria-label="Apuesta">
      <div class="fila"><h2 style="margin:0">${anotar ? (st.id ? "Editar anotación" : "Anotar línea") : st.id ? "Editar apuesta" : parlay ? "Nuevo parlay" : "Nueva apuesta simple"}</h2><span class="espacio"></span>
        <button class="boton-atras" data-fcerrar title="Cerrar (Esc)">✕</button></div>
      <div class="u-piernas-form">${st.piernas.map(filaPierna).join("")}</div>
      ${anotar ? "" : `<button class="boton u-agregar" data-pagregar>${parlay ? "Agregar otra pierna" : "Convertir en parlay (agregar pierna)"}</button>`}
      <div class="u-grid u-pie">
        ${parlay ? `<label class="campo"><span>Cuota total del parlay</span><input type="number" class="control" step="0.01" min="1.01" data-sf="cuota" value="${st.cuota ?? ""}" placeholder="${prod ? nfC.format(prod) : "4,50"}">
          ${prod ? `<small class="apagado">Producto de las piernas: ${nfC.format(prod)} <button class="enlace" data-usarprod>usar</button></small>` : ""}</label>` : ""}
        ${anotar ? "" : `<label class="campo"><span>Unidades</span><input type="number" class="control" step="0.25" min="0.01" data-sf="unidades" value="${st.unidades ?? ""}"></label>`}
        <label class="campo"><span>Casa (opcional)</span><input class="control" maxlength="40" data-sf="casa" value="${esc(st.casa || "")}" list="u-casas" placeholder="Stake, Bet365…">
          <datalist id="u-casas">${[...new Set((S.unid?.apuestas || []).map((a) => a.casa).filter(Boolean))].map((x) => `<option value="${esc(x)}">`).join("")}</datalist></label>
        <label class="campo u-nota-campo"><span>Nota (opcional)</span><input class="control" maxlength="500" data-sf="nota" value="${esc(st.nota || "")}"></label>
      </div>
      <div class="fila u-final">
        <span class="u-ganancia">${anotar ? '<span class="apagado">Queda en el Anotador; no cuenta en tus unidades.</span>' : ganancia != null ? `Si sale, ganás <b class="mas">${uTxt(ganancia)}</b>${pesos(ganancia) ? ` <span class="apagado">${pesos(ganancia)}</span>` : ""}` : '<span class="apagado">Completá cuota y unidades para ver cuánto ganás</span>'}</span>
        <span class="espacio"></span><span class="u-error" role="alert"></span>
        <button class="boton" data-fcerrar>Cancelar</button>
        <button class="boton primario" data-fguardar>${anotar ? "Anotar" : st.id ? "Guardar cambios" : parlay ? "Guardar parlay" : "Guardar apuesta"}</button>
      </div></div>`;
    fondo.querySelectorAll("[data-psel]").forEach((caja) => {
      const i = Number(caja.dataset.psel);
      selectorJugador(caja, { placeholder: "Buscar jugador…", alElegir: async (id) => {
        const p = st.piernas[i], j = S.jugadorPorId[id];
        Object.assign(p, { player_id: id, jugador: j?.nombre || "", game_id: null });
        await cargarPartidos(p);
        pintarForm();
      } });
    });
  }
  // solo actualiza lo que depende de números (sin volver a dibujar todo: no se pierde el foco)
  function refrescarTotales() {
    const parlay = st.piernas.length > 1, prod = productoCuotas();
    const cuota = parlay ? numero(st.cuota) : numero(st.piernas[0].cuota), u = numero(st.unidades);
    const g = cuota && u ? u * (cuota - 1) : null;
    const el = fondo.querySelector(".u-ganancia");
    if (el && !anotar) el.innerHTML = g != null ? `Si sale, ganás <b class="mas">${uTxt(g)}</b>${pesos(g) ? ` <span class="apagado">${pesos(g)}</span>` : ""}` : '<span class="apagado">Completá cuota y unidades para ver cuánto ganás</span>';
    const inp = fondo.querySelector("[data-sf=cuota]");
    if (inp) {
      inp.placeholder = prod ? nfC.format(prod) : "4,50";
      const peq = inp.parentElement.querySelector("small");
      if (prod && !peq) inp.insertAdjacentHTML("afterend", `<small class="apagado">Producto de las piernas: ${nfC.format(prod)} <button class="enlace" data-usarprod>usar</button></small>`);
      else if (peq) peq.innerHTML = prod ? `Producto de las piernas: ${nfC.format(prod)} <button class="enlace" data-usarprod>usar</button>` : "";
    }
  }
  const cerrar = () => { fondo.remove(); document.removeEventListener("keydown", tecla); };
  const tecla = (e) => { if (e.key === "Escape" && !document.querySelector(".selector-lista.abierta")) cerrar(); };
  document.addEventListener("keydown", tecla);

  fondo.addEventListener("input", (e) => {
    const t = e.target, fila = t.closest("[data-i]");
    if (t.dataset.pf && fila) st.piernas[Number(fila.dataset.i)][t.dataset.pf] = t.value;
    if (t.dataset.sf) st[t.dataset.sf] = t.value;
    refrescarTotales();
  });
  fondo.addEventListener("change", (e) => {
    const t = e.target, fila = t.closest("[data-i]");
    if (t.dataset.pf === "deporte" && fila) { st.piernas[Number(fila.dataset.i)].deporte = t.value; pintarForm(); }
    if (t.dataset.pf === "stat" && fila) {                 // U-22: doble-doble, triple-doble y primer canasto son Sí / No
      const pp = st.piernas[Number(fila.dataset.i)];
      pp.stat = t.value;
      if (SI_NO.has(t.value)) pp.linea = 0.5;
      pintarForm();
    }
  });
  fondo.addEventListener("click", async (e) => {
    const t = e.target;
    if (t === fondo) return;            // no se cierra con un clic afuera: se perdería lo cargado
    if (t.closest("[data-fcerrar]")) return cerrar();
    const lado = t.closest("[data-plado] button");
    if (lado) { st.piernas[Number(lado.parentElement.dataset.plado)].lado = lado.dataset.v; lado.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("activo", b === lado)); return; }
    if (t.closest("[data-pagregar]")) { st.piernas.push(piernaNueva({ deporte: st.piernas[st.piernas.length - 1].deporte === "NBA" ? "NBA" : st.piernas[st.piernas.length - 1].deporte })); pintarForm(); return; }
    const q = t.closest("[data-pquitar]");
    if (q) { st.piernas.splice(Number(q.dataset.pquitar), 1); pintarForm(); return; }
    const cb = t.closest("[data-pcambiar]");
    if (cb) { Object.assign(st.piernas[Number(cb.dataset.pcambiar)], { player_id: null, jugador: "", game_id: null }); pintarForm(); fondo.querySelector(`[data-psel="${cb.dataset.pcambiar}"] input`)?.focus(); return; }
    if (t.closest("[data-usarprod]")) { st.cuota = productoCuotas().toFixed(2); pintarForm(); return; }
    if (t.closest("[data-fguardar]") && anotar) {
      const p = st.piernas[0];
      const datos = p.deporte === "NBA"
        ? { id: st.id, deporte: "NBA", player_id: p.player_id, game_id: p.game_id, stat: p.stat, linea: p.linea, lado: p.lado, cuota: p.cuota, casa: st.casa, nota: st.nota }
        : { id: st.id, deporte: p.deporte, descripcion: p.descripcion, fecha: p.fecha, cuota: p.cuota, casa: st.casa, nota: st.nota };
      const r = await window.pywebview.api.guardar_anotacion(datos);
      if (r && r.error) { fondo.querySelector(".u-error").textContent = r.error; return; }
      cerrar();
      aviso(st.id ? "Anotación actualizada." : "Línea anotada.");
      if (S.ruta.s === "unidades") recargarUnidades();
      return;
    }
    if (t.closest("[data-fguardar]")) {
      const datos = { id: st.id, cuota: st.piernas.length > 1 ? st.cuota : st.piernas[0].cuota, unidades: st.unidades, casa: st.casa, nota: st.nota,
        grupos: st.grupos || null,
        piernas: st.piernas.map((p) => p.deporte === "NBA"
          ? { deporte: "NBA", player_id: p.player_id, game_id: p.game_id, stat: p.stat, linea: p.linea, lado: p.lado, cuota: p.cuota, grupo: p.grupo ?? null }
          : { deporte: p.deporte, descripcion: p.descripcion, fecha: p.fecha, cuota: p.cuota }) };
      const r = await window.pywebview.api.guardar_apuesta(datos);
      if (r && r.error) { fondo.querySelector(".u-error").textContent = r.error; return; }
      S.prefs.unid_ultima = numero(st.unidades) || 1;
      if (inicial.desdeCarrito) { S.prefs.carrito = []; pintarCarrito(); }
      guardarPrefs();
      cerrar();
      aviso(st.id ? "Apuesta actualizada." : st.piernas.length > 1 ? "Parlay guardado." : "Apuesta guardada.");
      if (S.ruta.s === "unidades") recargarUnidades();
    }
  });
  pintarForm();
  Promise.all(st.piernas.map(cargarPartidos)).then(pintarForm).catch(() => {});
  setTimeout(() => fondo.querySelector(".u-selector input, [data-pf=linea]")?.focus(), 60);
}

// ---------------------------------------------------------------- carrito de parlay (U-13)
function agregarAlParlay(pierna) {
  S.prefs.carrito = [...(S.prefs.carrito || []), pierna].slice(0, 20);
  guardarPrefs();
  pintarCarrito(true);
  aviso(`Agregada al parlay (${S.prefs.carrito.length} pierna${S.prefs.carrito.length === 1 ? "" : "s"}).`);
}
function pintarCarrito(latir = false) {
  let el = $("#carrito");
  const n = (S.prefs?.carrito || []).length;
  if (!n) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "carrito"; el.className = "carrito"; document.body.appendChild(el); entrar(el); }
  el.innerHTML = `<div class="carrito-txt"><b>Parlay en armado</b><span class="apagado">${n} pierna${n === 1 ? "" : "s"}: ${S.prefs.carrito.map((p) => esc(p.deporte && p.deporte !== "NBA" ? (p.descripcion || p.deporte) : (p.jugador || "").split(" ").slice(-1)[0] + " " + statU(p.stat))).join(", ")}</span></div>
    <button class="boton primario" data-carrito="armar">Armar</button><button class="boton-atras" data-carrito="vaciar" title="Vaciar">✕</button>`;
  if (latir) { el.classList.remove("latir"); void el.offsetWidth; el.classList.add("latir"); }
}
document.addEventListener("click", async (e) => {
  const c = e.target.closest("[data-carrito]");
  if (c) {
    if (c.dataset.carrito === "armar") abrirFormulario({ piernas: S.prefs.carrito.map((p) => ({ ...p })), desdeCarrito: true, tipo: "parlay" });
    else if (await confirmar("¿Vaciar el parlay en armado?", "Se sacan todas las piernas que agregaste.", "Vaciar")) { S.prefs.carrito = []; guardarPrefs(); pintarCarrito(); }
    return;
  }
  if (S.ruta?.s !== "unidades") return;
  const t = e.target;
  const tb = t.closest("[data-utab]");
  if (tb) { S.prefs.unid_tab = tb.dataset.utab; guardarPrefs(); pintarUnidades($("#contenido")); return entrar($(".unidades")); }
  if (t.closest("[data-uanotar]")) return abrirFormulario({ modo: "anotar" });
  const an = (k) => { const el = t.closest(`[data-${k}]`); return el ? (S.unid.anotador || []).find((a) => a.id === Number(el.dataset[k.replace(/-([a-z])/g, (m, x) => x.toUpperCase())])) : null; };
  let a;
  if ((a = an("uaapostar"))) return abrirFormulario({ piernas: [piernaDeAnotacion(a)], casa: a.casa || "", nota: a.nota || "" });
  if ((a = an("uaparlay"))) return agregarAlParlay(piernaDeAnotacion(a));
  if ((a = an("uaeditar"))) return abrirFormulario({ modo: "anotar", id: a.id, piernas: [piernaDeAnotacion(a)], casa: a.casa || "", nota: a.nota || "" });
  if ((a = an("uaborrar"))) {
    if (await confirmar("¿Borrar esta anotación?", "Se saca del Anotador.", "Borrar")) { await llamar("borrar_anotacion", a.id); recargarUnidades(); }
    return;
  }
  const n = t.closest("[data-unueva]");
  if (n) return abrirFormulario({ tipo: n.dataset.unueva });
  const ab = t.closest("[data-uabrir]");
  if (ab) {
    const id = Number(ab.dataset.uabrir), s = new Set(S.unidAbiertas || []);
    s.has(id) ? s.delete(id) : s.add(id);
    S.unidAbiertas = [...s];
    return pintarUnidades($("#contenido"));
  }
  const m = t.closest("[data-umenu]");
  if (m) { e.stopPropagation(); const [tipo, id] = m.dataset.umenu.split("|"); return menuApuesta(m, tipo, Number(id)); }
  const seg = t.closest("[data-useg] button");
  if (seg) { filtrosUnid()[seg.parentElement.dataset.useg] = seg.dataset.v; guardarPrefs(); return recargarUnidades(); }
  const dg = t.closest("[data-udesg]");
  if (dg) { S.prefs.unid_desglose = dg.dataset.udesg; guardarPrefs(); const caja = $(".u-desgloses"); caja.outerHTML = panelDesgloses(S.unid); return; }
});
document.addEventListener("change", async (e) => {
  if (S.ruta?.s !== "unidades") return;
  const t = e.target;
  if (t.dataset.uf) { filtrosUnid()[t.dataset.uf] = t.value || (t.dataset.uf === "deporte" ? "" : null); guardarPrefs(); return recargarUnidades(); }
  if (t.matches("[data-uvalor]")) { await llamar("config_unidades", t.value === "" ? null : Number(t.value)); return recargarUnidades(); }
});
