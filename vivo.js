"use strict";
/* Stats NBA - Fase 7, el en vivo (L-01 a L-17, U-16, F-05, F-11).
   La app le pregunta seguido al motor en vivo (local, no cuesta nada) y solo redibuja lo que cambió:
   el marcador del día, la pantalla del partido abierto, las barritas de Unidades, los favoritos que
   están jugando y las alertas nuevas. */

const V = { ver: -1, alerta: null, marcador: [], favs: {}, enJuego: 0, silencio: 0, sinLeer: 0, primera: true,
  pver: -1, vp: null, apuestas: null, timer: null, ocupado: false };

// ---------------------------------------------------------------- el pulso
async function tickVivo() {
  clearTimeout(V.timer);
  if (V.ocupado || !window.pywebview?.api?.vivo_resumen) { V.timer = setTimeout(tickVivo, 1500); return; }
  V.ocupado = true;
  try {
    const r = await window.pywebview.api.vivo_resumen(V.ver, V.alerta ?? 0);
    if (r && !r.error) {
      V.enJuego = r.en_juego; V.sinLeer = r.sin_leer; V.silencio = r.silencio_hasta || 0;
      if (V.alerta === null) V.alerta = r.ultimo_alerta;          // al abrir: lo viejo queda en la bandeja, sin avisos
      else if (r.alertas_nuevas?.length) { V.alerta = r.ultimo_alerta; mostrarAlertas(r.alertas_nuevas); }
      pintarCampana();
      if (r.version !== V.ver) {
        V.ver = r.version;
        if (r.marcador) V.marcador = r.marcador;
        if (r.favoritos) V.favs = r.favoritos;
        alCambiarVivo();
      }
    }
  } catch (e) { /* la próxima */ }
  V.ocupado = false;
  const rapido = V.enJuego > 0 || S.ruta?.s === "partido";
  V.timer = setTimeout(tickVivo, document.hidden ? 5000 : rapido ? 1500 : 6000);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) tickVivo(); });

function alCambiarVivo() {
  pintarChipVivo();
  const r = S.ruta?.s;
  if (r === "vivo" && P.dia && P.dia.fecha === P.dia.hoy) actualizarListaVivo();
  else if (r === "partido") refrescarPartidoVivo();
  else if (r === "unidades") pintarUnidadesVivo();
  else if (r === "favoritos") pintarFavoritosVivo();
  else if (r === "inicio") pintarInicioVivo();
}

function pintarChipVivo() {
  const c = $("#vivo-chip");
  if (!c) return;
  c.hidden = !V.enJuego;
  c.innerHTML = V.enJuego ? `<i class="punto-vivo"></i>${V.enJuego} en vivo` : "";
}

const relojP = (m) => (m.periodo ? `${m.periodo <= 4 ? `${m.periodo}C` : m.periodo === 5 ? "OT" : `${m.periodo - 4}OT`} ${m.reloj || ""}`.trim() : "");

// lista de Partidos (hoy): marcadores en vivo sin volver a pedir todo
async function actualizarListaVivo() {
  const d = await llamar("partidos_dia", P.dia.fecha).catch(() => null);
  if (!d || S.ruta.s !== "vivo") return;
  P.dia = d;
  const g = $(".pa-grilla");
  if (!g) return pintarPartidos($("#contenido"));
  g.innerHTML = d.partidos.map(tarjetaPartidoDia).join("");
}

// Inicio: el marcador en vivo en cada tarjeta de partido
function pintarInicioVivo() {
  for (const m of V.marcador) {
    const el = document.querySelector(`[data-ppvivo="${m.game_id}"]`);
    if (!el) continue;
    el.innerHTML = m.estado === "por_empezar" ? "" : `<b>${esc(m.visita.tricode)} ${m.visita.pts ?? 0} - ${m.local.pts ?? 0} ${esc(m.local.tricode)}</b>
      <span class="apagado">${m.estado === "final" ? "Final" : esc(relojP(m))}</span>`;
    el.closest(".tarjeta-partido")?.classList.toggle("en-vivo", m.estado === "en_juego");
  }
}

// F-05: en la tarjeta de cada favorito que está jugando
function pintarFavoritosVivo() {
  document.querySelectorAll("[data-fvivo]").forEach((el) => {
    const f = V.favs[el.dataset.fvivo];
    el.hidden = !f;
    if (!f) return;
    const s = f.stats;
    el.innerHTML = `<a href="#" data-partido="${f.game_id}" class="fav-vivo-link">${f.estado === "en_juego" ? '<i class="punto-vivo"></i>' : ""}
      <span class="apagado">${f.estado === "final" ? "Terminó" : `${esc(relojP(f))}`} vs ${esc(f.rival)}${f.en_cancha ? ", en cancha" : f.estado === "en_juego" ? ", en el banco" : ""}</span>
      <span><b>${s.pts ?? 0}</b> PTS <b>${s.reb ?? 0}</b> REB <b>${s.ast ?? 0}</b> AST <b>${s.fg3m ?? 0}</b> 3PM
        <span class="${s.pf >= 5 ? "menos" : s.pf >= 4 ? "ambar" : "apagado"}">${s.pf ?? 0} FAL</span> <span class="apagado">${nf0.format(s.min || 0)} min</span></span></a>`;
  });
}

// ---------------------------------------------------------------- barrita de una pata (U-16, L-17)
function barraPata(x, opts = {}) {
  const v = x.vivo;
  const lineaTxt = esc(x.linea_txt || textoLinea(x.lado, x.linea, x.stat, x.nombre_stat || x.stat));
  const nombre = `<a href="#" data-jugador="${x.player_id}" class="bp-jug">${esc(x.jugador || "")}</a>`;
  if (!v) return `<div class="bp sin-datos">${nombre} <span class="apagado">${lineaTxt}</span></div>`;
  const est = v.estado || "pendiente";
  const menos = x.lado === "menos";
  const pct = Math.round((v.progreso || 0) * 100);
  const sinEmpezar = !v.estado_partido || v.estado_partido === "por_empezar";
  const clase = est === "cumplida" || est === "ganada" ? "ok" : est === "fallada" || est === "perdida" ? "mal" : est === "peligro" ? "peligro" : menos ? "menos" : "";
  const extra = [];
  if (v.proyeccion != null && !sinEmpezar && !["cumplida", "fallada"].includes(est)) {
    extra.push(`<span>Proyecta <b>${nf1.format(v.proyeccion)}</b>${v.rango ? ` <span class="apagado">(${nf0.format(v.rango[0])} a ${nf0.format(v.rango[1])})</span>` : ""}</span>`);
    if (v.chance != null) extra.push(`<span>chance <b class="${v.chance >= 0.6 ? "mas" : v.chance < 0.4 ? "menos" : ""}">${nf0.format(v.chance * 100)}%</b></span>`);
  }
  const det = [];
  if (v.historial) det.push(`Cuando llegó al final del ${v.historial.cuartos}.º cuarto con ${nf0.format(v.actual)} o más, terminó arriba en ${v.historial.arriba} de ${v.historial.n}`);
  if (v.segundo_tiempo != null && !sinEmpezar && (v.periodo || 0) <= 2) det.push(`Suele hacer el ${nf0.format(v.segundo_tiempo * 100)}% en el segundo tiempo`);
  (v.factores || []).forEach((f) => det.push(f));
  const estadoTxt = { cumplida: "Cumplida", fallada: "Fallada", peligro: "En peligro", ganada: "Ganada", perdida: "Perdida", nula: "Nula" }[est];
  return `<div class="bp ${clase}${opts.apagada ? " apagada" : ""}" data-bpjug="${x.player_id}">
    <div class="bp-cab">${nombre}<span class="bp-linea">${lineaTxt}</span><span class="espacio"></span>
      ${estadoTxt ? `<span class="bp-estado">${estadoTxt}</span>` : ""}
      <span class="bp-num">${sinEmpezar ? `<span class="apagado">${v.hora_utc ? esc(horaCorta(v.hora_utc)) + " h" : "Por empezar"}</span>`
        : x.si_no ? (v.detalle ? `<span class="apagado">${esc(v.detalle)}</span>` : "") : `<b>${nf0.format(v.actual)}</b><span class="apagado">/${v.meta}</span>`}</span></div>
    <div class="bp-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${v.meta}" aria-valuenow="${v.actual}" aria-label="${esc(x.jugador || "")}: ${v.actual} de ${v.meta}">
      <i style="width:${sinEmpezar ? 0 : pct}%"></i></div>
    ${extra.length || (!sinEmpezar && v.estado_partido === "en_juego") ? `<div class="bp-pie">${v.estado_partido === "en_juego" ? `<span class="apagado">${esc(relojP(v))}${v.min != null ? `, ${nf0.format(v.min)} min` : ""}${v.pf ? `, ${v.pf} fal.` : ""}</span>` : ""}${extra.join("")}</div>` : ""}
    ${det.length && !opts.corta ? `<div class="bp-det apagado">${det.map(esc).join(". ")}.</div>` : ""}
  </div>`;
}

function tarjetaApuestaVivo(a, gid = null) {
  const est = { ganada: "Ganada", perdida: "Perdida", en_juego: "En juego", pendiente: "Por empezar" }[a.estado] || a.estado;
  const otras = gid ? a.patas.filter((x) => (x.vivo?.game_id || x.game_id) !== gid) : [];
  const propias = gid ? a.patas.filter((x) => (x.vivo?.game_id || x.game_id) === gid) : a.patas;
  return `<div class="ap-vivo ${a.estado}">
    <div class="ap-cab"><b>${a.tipo === "parlay" ? `Combinada de ${a.n}` : "Simple"}</b>
      <span class="apagado">cuota ${nfC.format(a.cuota)}, ${nfU.format(a.unidades)} u${a.casa ? `, ${esc(a.casa)}` : ""}</span><span class="espacio"></span>
      ${a.tipo === "parlay" ? `<span class="apagado">${a.cumplidas} de ${a.n}</span>` : ""}
      <span class="ap-estado ${a.estado}">${est}</span></div>
    ${propias.map((x) => barraPata(x, { corta: !!gid && false })).join("")}
    ${otras.length ? `<div class="ap-otras"><span class="apagado">Las otras patas:</span>${otras.map((x) => { const e = x.vivo?.estado || x.estado;
      return `<span class="ap-mini ${e}">${esc((x.jugador || "").split(" ").slice(-1)[0])} ${x.si_no ? esc((x.lado === "menos" ? "No " : "") + (x.nombre_stat || "")) : `${x.lado === "menos" ? "−" : "+"}${String(x.linea).replace(".", ",")} ${esc(x.nombre_stat || "")}`}
        ${x.vivo && x.vivo.estado_partido !== "por_empezar" && !x.si_no ? `<b>${nf0.format(x.vivo.actual)}</b>` : ""}</span>`; }).join("")}</div>` : ""}
    ${a.estado === "en_juego" || a.estado === "pendiente" ? `<div class="ap-pie apagado">Chance de que salga: <b>${nf0.format(a.chance * 100)}%</b>${a.tipo === "parlay" ? " (si las patas fueran independientes)" : ""}</div>` : ""}
  </div>`;
}

// ---------------------------------------------------------------- Unidades: lo que está en juego (U-16)
async function pintarUnidadesVivo() {
  const caja = $("#u-vivo");
  if (!caja) return;
  let d;
  try { d = await llamar("vivo_apuestas"); } catch (e) { return; }
  if (!caja.isConnected) return;
  const lista = d.apuestas.filter((a) => a.estado !== "pendiente" || a.patas.some((x) => x.vivo && x.vivo.estado_partido));
  caja.hidden = !lista.length;
  caja.innerHTML = lista.length ? `<div class="fila" style="margin-bottom:10px"><h2 style="margin:0">Hoy</h2><span class="apagado">tus apuestas de los partidos de hoy, con cómo van</span>
    ${d.error ? `<span class="espacio"></span><span class="ambar" title="${esc(d.error)}">Sin conexión con el en vivo de la NBA: se reintenta solo</span>` : ""}</div>
    <div class="ap-grilla">${lista.map((a) => tarjetaApuestaVivo(a)).join("")}</div>` : "";
}

// ---------------------------------------------------------------- pantalla del partido en vivo (L-13 a L-17)
const PESTANAS_V = [["vivo", "En vivo"], ["box", "Box score"], ["jugadas", "Jugadas"], ["tiros", "Tiros"], ["apostar", "Apostar"]];

// convierte lo del motor en vivo al formato del box de la base, para reusar tablas y filtros
function partidoDesdeVivo(p) {
  const eq = (e) => ({ team_id: e.team_id, tricode: e.tricode, nombre: e.nombre, ciudad: e.ciudad, pts: e.pts, cuartos: e.cuartos,
    jugadores: Object.values(e.jugadores).filter((j) => j.jugo || j.en_cancha).map((j) => ({ ...j, posicion_partido: j.titular ? j.pos : null }))
      .sort((a, b) => b.titular - a.titular || b.min - a.min),
    totales: e.totales, por_cuarto: [] });
  const tiros = p.jugadas.filter((j) => j.tiro > 1 && j.x != null).map((j) => [j.x, j.y, j.ok, j.player_id, j.team_id, j.periodo, null, String(j.tiro)]);
  return { game_id: p.game_id, fecha: P.partido?.fecha || (p.hora_utc || "").slice(0, 10), hora_utc: p.hora_utc, fase: P.partido?.fase || "Regular Season",
    estado: p.estado, equipos: [eq(p.visita), eq(p.local)], lideres: {}, tiros, vivo: true };
}

async function refrescarPartidoVivo() {
  if (S.ruta.s !== "partido") return;
  const gid = S.ruta.id;
  let r;
  try { r = await llamar("vivo_partido", gid, V.pver); } catch (e) { return; }
  if (S.ruta.s !== "partido" || S.ruta.id !== gid || r.igual || !r.hay) return;
  const antes = V.vp;
  V.pver = r.version; V.vp = r;
  const nuevo = partidoDesdeVivo(r.partido);
  P.partido = { ...nuevo, fecha: P.partido?.fecha || nuevo.fecha, fase: P.partido?.fase || nuevo.fase };
  P.jugadas = { jugadas: r.partido.jugadas };
  if (!antes || !$(".pv")) return pintarPartidoVivo($("#contenido"));
  pintarMarcadorVivo();
  panelPartidoVivo(true);
}

function pintarPartidoVivo(c) {
  const tab = S.prefs.partido_vtab || "vivo";
  c.innerHTML = `<div class="partido pv"><div id="pv-marcador"></div>
    <div class="pestanas pt-tabs">${PESTANAS_V.map(([k, t]) => `<button class="pestana${tab === k ? " activa" : ""}" data-pvtab="${k}">${t}</button>`).join("")}
      <span class="espacio"></span><span class="apagado pv-act" id="pv-act"></span></div>
    <div id="pt-panel"></div></div>`;
  pintarMarcadorVivo();
  panelPartidoVivo();
  pintarMiga();
}

function pintarMarcadorVivo() {
  const caja = $("#pv-marcador");
  if (!caja || !V.vp) return;
  const p = V.vp.partido, vis = p.visita, loc = p.local;
  const nq = Math.max(vis.cuartos.length, loc.cuartos.length, 4);
  const en = p.estado === "en_juego";
  const lado = (e, der) => `<div class="pt-equipo${der ? " der" : ""}">
      <a href="#" data-equipo="${e.team_id}">${avatarE(e.team_id, e.tricode, "grande")}</a>
      <div class="pt-nom"><span class="apagado">${esc(e.ciudad || "")}</span><b>${esc(e.nombre || e.tricode || "")}</b>
        ${en ? `<span class="pv-meta apagado">${e.tiempos ?? "?"} tiempos muertos${e.bonus ? ' <span class="pv-bonus">Bonus</span>' : ""}</span>` : ""}</div>
      <div class="pt-pts">${e.pts ?? 0}</div></div>`;
  caja.innerHTML = `<section class="pt-marcador" style="--c-vis:${colorEq(vis.team_id)}; --c-loc:${colorEq(loc.team_id)}">
      ${lado(vis, false)}
      <div class="pt-centro">
        <div class="pt-estado">${en ? `<i class="punto-vivo"></i>${esc(relojP(p))}` : p.estado === "final" ? "Final" : esc(horaCorta(p.hora_utc) + " h")}</div>
        <table class="pt-cuartos"><thead><tr><th></th>${Array.from({ length: nq }, (_, i) => `<th>${nPeriodo(i)}</th>`).join("")}<th>T</th></tr></thead><tbody>
          ${[vis, loc].map((e) => `<tr><td class="izq">${esc(e.tricode)}</td>${Array.from({ length: nq }, (_, i) => `<td>${e.cuartos[i] ?? ""}</td>`).join("")}<td class="fuerte">${e.pts ?? 0}</td></tr>`).join("")}
        </tbody></table>
      </div>
      ${lado(loc, true)}
    </section>`;
  const a = $("#pv-act");
  if (a) a.textContent = en ? `Se actualiza cada ${V.vp.medicion?.intervalo ?? 3} s` : "";
}

function panelPartidoVivo(soloDatos = false) {
  const caja = $("#pt-panel");
  if (!caja) return;
  const tab = S.prefs.partido_vtab || "vivo";
  if (tab === "vivo") return pintarEnVivo(caja, soloDatos);
  if (tab === "box") { caja.innerHTML = P.partido.equipos.map((e) => tablaBox(e, V.vp?.promedios)).join(""); return; }
  if (tab === "tiros") return pintarTirosPartido(caja);
  if (tab === "apostar") return soloDatos ? null : pintarApostar(caja);
  return soloDatos ? pintarJugadasConservando() : pintarJugadas(caja);
}

function pintarEnVivo(caja, soloDatos) {
  const r = V.vp, p = r.partido;
  const lista = $(".pv-feed"), y = lista ? lista.scrollTop : 0;
  const f = { suman: false, jugador: "", ...(S.prefs.pvfeed || {}) };
  const ocultar = !!S.prefs.vivo_ocultar_anotadas;
  const jugadas = p.jugadas.filter((j) => (!f.suman || j.puntos > 0 || j.tipo === "corte") && (!f.jugador || j.player_id === Number(f.jugador)
    || (j.texto || "").includes(nombreJ(Number(f.jugador))))).slice().reverse().slice(0, 150);
  caja.innerHTML = `<div class="pv-grilla">
    <aside class="pv-cancha-lado">${[p.visita, p.local].map((e) => bloqueEnCanchaVivo(e, r.promedios)).join("")}</aside>
    <div class="pv-centro">
      <div class="tarjeta pv-cancha-caja">${canchaVivo(p)}${textoUltima(p)}</div>
      <div class="fila pv-feed-filtros"><b>Jugada por jugada</b><span class="espacio"></span>
        ${f.jugador ? `<button class="enlace" data-pvjug="">Quitar filtro: ${esc(nombreJ(Number(f.jugador)))}</button>` : ""}
        <label class="interruptor"><input type="checkbox" data-pvsuman ${f.suman ? "checked" : ""}>Solo las que suman</label></div>
      <div class="pj-lista pv-feed">${jugadas.map((j) => filaJugada(j, p.visita, p.local)).join("") || '<div class="vacio">Todavía no hay jugadas.</div>'}</div>
    </div>
    <aside class="pv-apuestas">
      <div class="fila" style="margin-bottom:8px"><h2 style="margin:0">Apuestas</h2><span class="espacio"></span>
        ${r.anotadas.length ? `<label class="interruptor"><input type="checkbox" data-pvocultar ${ocultar ? "checked" : ""}>Ocultar anotadas</label>` : ""}</div>
      ${r.apuestas.length ? r.apuestas.map((a) => tarjetaApuestaVivo(a, p.game_id)).join("") : '<div class="apagado pv-sin">No tenés apuestas con jugadores de este partido.</div>'}
      ${r.anotadas.length && !ocultar ? `<div class="pv-anotadas"><h3>Anotadas sin apostar</h3>${r.anotadas.map((x) => barraPata(x, { apagada: true, corta: true })).join("")}</div>` : ""}
    </aside></div>`;
  const n = $(".pv-feed"); if (n && soloDatos) n.scrollTop = y;
}

function bloqueEnCanchaVivo(e, prom) {
  const js = Object.values(e.jugadores);
  const en = js.filter((j) => j.en_cancha).sort((a, b) => b.min - a.min);
  const fila = (j) => { const pr = (prom || {})[j.player_id];
    return `<tr data-pvjug="${j.player_id}" class="clic" title="Filtrar las jugadas de ${esc(j.nombre)}">
      <td class="izq"><span class="pv-nom">${esc(j.apellido || j.nombre.split(" ").slice(-1)[0])}</span></td>
      <td>${nf0.format(j.min || 0)}</td><td class="fuerte">${j.pts ?? 0}</td><td>${j.reb ?? 0}</td><td>${j.ast ?? 0}</td><td>${j.fg3m ?? 0}</td>
      <td class="${j.pf >= 5 ? "menos fuerte" : j.pf >= 4 ? "ambar fuerte" : ""}">${j.pf ?? 0}</td></tr>`; };
  return `<section class="tarjeta pv-en-cancha" style="--c-eq:${colorEq(e.team_id)}">
    <div class="fila" style="margin-bottom:6px">${logoMini(e.team_id)}<b>${esc(e.tricode)}</b><span class="espacio"></span>
      <span class="apagado">${e.faltas_equipo != null ? `${e.faltas_equipo} faltas de equipo` : ""}</span></div>
    <table class="pv-tabla"><thead><tr><th class="izq">En cancha</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th><th>FAL</th></tr></thead>
      <tbody>${en.map(fila).join("") || '<tr><td colspan="7" class="apagado">Sin datos todavía</td></tr>'}</tbody></table>
  </section>`;
}

// cancha completa, de costado (medidas de la NBA, en décimas de pie); el feed en vivo trae x e y en % de la cancha
function canchaVivo(p) {
  const L = 940, W = 500;
  const lin = `stroke="#2f3b4c" stroke-width="2.5" fill="none"`;
  const lado = (izq) => { const X = (x) => (izq ? x : L - x);
    const a = Math.asin(220 / 237.5), dx = 237.5 * Math.cos(a);
    return `<rect x="${izq ? 0 : L - 190}" y="170" width="190" height="160" ${lin}/>
      <circle cx="${X(190)}" cy="250" r="60" ${lin}/>
      <line x1="${X(0)}" y1="30" x2="${X(140)}" y2="30" ${lin}/><line x1="${X(0)}" y1="470" x2="${X(140)}" y2="470" ${lin}/>
      <path d="M ${X(140)} 30 A 237.5 237.5 0 0 ${izq ? 1 : 0} ${X(140)} 470" ${lin}/>
      <line x1="${X(40)}" y1="220" x2="${X(40)}" y2="280" stroke="#4a5768" stroke-width="3"/>
      <circle cx="${X(52.5)}" cy="250" r="7.5" stroke="#f28c38" stroke-width="2.5" fill="none"/>`; };
  const ladoDe = sidesPorEquipo(p);
  const ultimas = p.jugadas.filter((j) => j.tiro > 1 && j.xp != null).slice(-6);
  let s = `<svg viewBox="-6 -6 ${L + 12} ${W + 12}" class="pv-cancha" role="img" aria-label="Cancha con los últimos tiros">
    <rect x="0" y="0" width="${L}" height="${W}" fill="#131a23" stroke="#2f3b4c" stroke-width="3" rx="4"/>
    <line x1="${L / 2}" y1="0" x2="${L / 2}" y2="${W}" ${lin}/><circle cx="${L / 2}" cy="250" r="60" ${lin}/>
    ${lado(true)}${lado(false)}`;
  // posesión: flecha hacia el aro que ataca
  const pos = p.posesion;
  if (pos && p.estado === "en_juego") {
    const e = pos === p.local.team_id ? p.local : p.visita;
    const ataca = ladoDe[pos];
    const c = colorEq(pos);
    if (ataca) {
      const x0 = L / 2, dir = ataca === "left" ? -1 : 1;
      s += `<g class="pv-posesion"><path d="M ${x0 - dir * 40} 250 L ${x0 + dir * 40} 250" stroke="${c}" stroke-width="10" stroke-linecap="round"/>
        <path d="M ${x0 + dir * 60} 250 L ${x0 + dir * 30} 228 L ${x0 + dir * 30} 272 Z" fill="${c}"/>
        <text x="${x0}" y="215" text-anchor="middle" fill="${c}" font-size="26" font-weight="700">${esc(e.tricode)}</text></g>`;
    } else s += `<text x="${L / 2}" y="210" text-anchor="middle" fill="${c}" font-size="26" font-weight="700">Posesión ${esc(e.tricode)}</text>`;
  }
  ultimas.forEach((j, i) => {
    const x = (j.xp / 100) * L, y = (j.yp / 100) * W, c = colorEq(j.team_id);
    const nuevo = i === ultimas.length - 1, op = nuevo ? 1 : 0.25 + (0.5 * i) / Math.max(1, ultimas.length - 1);
    s += j.ok ? `<circle cx="${x}" cy="${y}" r="${nuevo ? 13 : 9}" fill="${c}" fill-opacity="${op}" stroke="#0c0b10" stroke-width="2"/>`
      : `<circle cx="${x}" cy="${y}" r="${nuevo ? 12 : 8}" fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="3.5"/>`;
    if (nuevo) s += `<circle cx="${x}" cy="${y}" r="16" fill="none" stroke="${c}" stroke-width="3"><animate attributeName="r" from="14" to="34" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" from=".9" to="0" dur="1.4s" repeatCount="indefinite"/></circle>`;
  });
  // tiro libre: en la línea del aro que ataca
  const u = p.jugadas[p.jugadas.length - 1];
  const libre = p.jugadas.slice(-3).reverse().find((j) => j.tiro === 1);
  if (libre && u && (u.tiro === 1 || u.tipo === "cambio" || u.tipo === "otro")) {
    const at = ladoDe[libre.team_id];
    const x = at === "left" ? 190 : at === "right" ? L - 190 : L / 2, c = colorEq(libre.team_id);
    s += `<circle cx="${x}" cy="250" r="12" fill="${libre.ok ? c : "none"}" stroke="${c}" stroke-width="3.5"/>
      <text x="${x}" y="300" text-anchor="middle" fill="${c}" font-size="22" font-weight="700">TL ${esc((libre.texto.match(/(\d) de (\d)/) || [""])[0])} ${libre.ok ? "✓" : "✗"}</text>`;
  }
  return s + "</svg>";
}

// qué aro ataca cada equipo en este tiempo (por sus tiros; en el segundo tiempo se cambian de lado)
function sidesPorEquipo(p) {
  const out = {}, per = p.periodo || 1, mitad = (q) => (q <= 2 ? 1 : 2);
  for (const e of [p.local, p.visita]) {
    const t = p.jugadas.filter((j) => j.team_id === e.team_id && j.lado && j.tiro > 1);
    const mismo = t.filter((j) => mitad(j.periodo) === mitad(per) && (per <= 4 || j.periodo === per));
    if (mismo.length) { out[e.team_id] = mismo[mismo.length - 1].lado; continue; }
    if (t.length) { const l = t[t.length - 1].lado; out[e.team_id] = l === "left" ? "right" : "left"; }
  }
  return out;
}

function textoUltima(p) {
  const u = p.jugadas.slice().reverse().find((j) => j.tipo !== "corte" && j.texto);
  if (!u) return "";
  return `<div class="pv-ultima" style="--c-eq:${u.team_id ? colorEq(u.team_id) : "var(--panel-3)"}">${u.team_id ? logoMini(u.team_id) : ""}
    <span><b>${esc(u.texto)}</b>${u.detalle ? ` <span class="apagado">${esc(u.detalle)}</span>` : ""}</span><span class="espacio"></span>
    <span class="apagado">${esc(nPeriodo((u.periodo || 1) - 1))} ${esc(u.reloj)}</span></div>`;
}

// ---------------------------------------------------------------- alertas (L-05)
function mostrarAlertas(lista) {
  let caja = $("#alertas-toast");
  if (!caja) { caja = document.createElement("div"); caja.id = "alertas-toast"; document.body.appendChild(caja); }
  for (const a of lista.slice(-4)) {
    const el = document.createElement("button");
    el.className = `alerta-toast ${a.tipo}${a.importante ? " importante" : ""}`;
    el.innerHTML = `<b>${esc(a.titulo)}</b><span>${esc(a.texto)}</span>`;
    if (a.game_id) el.dataset.partido = a.game_id;
    caja.appendChild(el);
    setTimeout(() => { el.classList.add("salir"); setTimeout(() => el.remove(), 400); }, 9000);
  }
  if (S.ruta?.s === "unidades") pintarUnidadesVivo();
}

function pintarCampana() {
  const b = $("#campana");
  if (!b) return;
  const sil = V.silencio && V.silencio * 1000 > Date.now();
  b.classList.toggle("silencio", !!sil);
  b.title = sil ? `Alertas silenciadas hasta las ${new Date(V.silencio * 1000).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}` : "Alertas";
  $("#campana-n").textContent = V.sinLeer ? (V.sinLeer > 99 ? "99+" : V.sinLeer) : "";
}

async function abrirBandeja() {
  let panel = $("#bandeja");
  if (panel) { panel.remove(); return; }
  const d = await llamar("alertas_bandeja");
  panel = document.createElement("div");
  panel.id = "bandeja";
  const sil = d.silencio_hasta && d.silencio_hasta * 1000 > Date.now();
  panel.innerHTML = `<div class="fila band-cab"><b>Alertas</b><span class="espacio"></span>
      ${sil ? `<button class="enlace" data-silenciar="0">Volver a avisar</button>` : `<button class="enlace" data-silenciar="30">Silenciar 30 min</button><button class="enlace" data-silenciar="noche">Silenciar la noche</button>`}</div>
    ${sil ? `<div class="band-sil apagado">Silenciadas hasta las ${new Date(d.silencio_hasta * 1000).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}: siguen llegando acá, sin notificación.</div>` : ""}
    <div class="band-lista">${d.alertas.length ? d.alertas.map((a) => `<button class="band-item ${a.tipo}${a.leida ? "" : " nueva"}"${a.game_id ? ` data-partido="${a.game_id}"` : ""}>
        <span class="band-hora apagado">${esc(new Date(a.cuando).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }))}</span>
        <span><b>${esc(a.titulo)}</b><span class="apagado">${esc(a.texto)}${a.solo_bandeja ? " (sin notificación: ya iban 6 de jugadores sin apuesta esta noche)" : ""}</span></span></button>`).join("")
      : '<div class="vacio">Todavía no hubo alertas.</div>'}</div>
    <div class="band-pie apagado">Configuralas en <a href="#" data-sec="ajustes">Ajustes</a>.</div>`;
  document.body.appendChild(panel);
  llamar("alertas_leidas").then(() => { V.sinLeer = 0; pintarCampana(); }).catch(() => {});
}

document.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.closest("#campana")) { e.stopPropagation(); return abrirBandeja(); }
  const sil = t.closest("[data-silenciar]");
  if (sil) {
    const v = sil.dataset.silenciar;
    const r = await llamar("alertas_silenciar", v === "noche" ? "noche" : Number(v));
    V.silencio = r.silencio_hasta; pintarCampana(); $("#bandeja")?.remove(); return abrirBandeja();
  }
  const band = $("#bandeja");
  if (band && !t.closest("#bandeja")) band.remove();
  else if (band && t.closest("[data-partido], [data-sec]")) band.remove();
  if (t.closest(".alerta-toast")) t.closest(".alerta-toast").remove();
  if (t.closest("#vivo-chip")) { P.fecha = null; return ir({ s: "vivo" }); }
  if (S.ruta?.s !== "partido" || !$(".pv")) return;
  const tb = t.closest("[data-pvtab]");
  if (tb) {
    S.prefs.partido_vtab = tb.dataset.pvtab; guardarPrefs();
    document.querySelectorAll("[data-pvtab]").forEach((b) => b.classList.toggle("activa", b === tb));
    panelPartidoVivo(); return entrar($("#pt-panel"));
  }
  const pj = t.closest("[data-pvjug]");
  if (pj && !t.closest("a")) { S.prefs.pvfeed = { ...(S.prefs.pvfeed || {}), jugador: pj.dataset.pvjug === String(S.prefs.pvfeed?.jugador) ? "" : pj.dataset.pvjug }; return pintarEnVivo($("#pt-panel")); }
  const bp = t.closest("[data-bpjug]");
  if (bp && !t.closest("a")) { S.prefs.pvfeed = { ...(S.prefs.pvfeed || {}), jugador: bp.dataset.bpjug }; return pintarEnVivo($("#pt-panel")); }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.matches("[data-pvsuman]")) { S.prefs.pvfeed = { ...(S.prefs.pvfeed || {}), suman: t.checked }; guardarPrefs(); return pintarEnVivo($("#pt-panel")); }
  if (t.matches("[data-pvocultar]")) { S.prefs.vivo_ocultar_anotadas = t.checked; guardarPrefs(); return pintarEnVivo($("#pt-panel")); }
});

// ---------------------------------------------------------------- Ajustes: en vivo y alertas
const ALERTAS_DEF = { cumplida: true, fallada: true, riesgo: true, proyeccion: true, faltas: true, umbral: 0.75, umbral_fav: 0.30,
  tope_noche: 6, sonido: true, windows: true, minutos_banco: 10, paliza_3: 20, paliza_4: 15 };
async function pintarAjustesVivo() {
  const caja = $("#ajustes-vivo");
  if (!caja) return;
  const a = { ...ALERTAS_DEF, ...(S.prefs.alertas || {}) };
  let m = {};
  try { m = await llamar("vivo_medicion"); } catch (e) { /* sigue */ }
  if (!caja.isConnected) return;
  const chk = (k, t) => `<label class="interruptor"><input type="checkbox" data-alerta="${k}" ${a[k] ? "checked" : ""}>${t}</label>`;
  const intervalo = S.prefs.vivo_intervalo || 3;
  caja.innerHTML = `<h2>En vivo y alertas</h2>
    <div class="aj-fila"><span>Actualizar cada</span><div class="segmentado" data-vintervalo>${[1, 2, 3, 5, 10].map((s) => `<button data-v="${s}" class="${Number(intervalo) === s ? "activo" : ""}">${s} s</button>`).join("")}</div></div>
    <p class="apagado">${m.mediana ? `En lo que va, la NBA actualizó sus datos cada ${nf1.format(m.mediana)} s (lo más rápido, ${nf1.format(m.minimo)} s; ${m.n} ${m.n === 1 ? "cambio medido" : "cambios medidos"}). Preguntar más seguido que eso no trae nada nuevo.`
      : "Cuando haya un partido en juego, acá vas a ver cada cuántos segundos actualiza la NBA de verdad."}
      Se actualizan todos los partidos que se están jugando, en cualquier pantalla.${m.error ? ` <span class="ambar">Último error: ${esc(m.error)}</span>` : ""}</p>
    <h4>De tus apuestas</h4><div class="aj-chk">${chk("cumplida", "Pata cumplida")}${chk("fallada", "Pata fallada")}${chk("riesgo", "Riesgo en el partido (faltas, no vuelve, paliza)")}</div>
    <h4>De jugadores sin apuesta</h4><div class="aj-chk">${chk("proyeccion", "Proyección fuerte")}${chk("faltas", "Problema de faltas")}</div>
    <div class="aj-fila"><span>Proyección fuerte desde</span><div class="segmentado" data-valerta="umbral">${[0.7, 0.75, 0.8, 0.85].map((v) => `<button data-v="${v}" class="${a.umbral === v ? "activo" : ""}">${v * 100}%</button>`).join("")}</div></div>
    <div class="aj-fila"><span>Máximo por noche (sin apuesta)</span><div class="segmentado" data-valerta="tope_noche">${[3, 6, 10, 20].map((v) => `<button data-v="${v}" class="${a.tope_noche === v ? "activo" : ""}">${v}</button>`).join("")}</div></div>
    <h4>Cómo avisa</h4><div class="aj-chk">${chk("windows", "Notificación de Windows")}${chk("sonido", "Con sonido (solo lo que define plata)")}</div>
    <div class="fila" style="margin-top:12px"><button class="boton" data-probar-alerta>Probar notificación</button>
      <span class="apagado">Como máximo una por minuto; lo que llega junto va en una sola. Todo queda en la campanita de arriba.</span></div>
    <div id="aj-telegram"></div><div id="aj-movil"></div>`;
  pintarTelegram();
  pintarMovil();
}

// L-18: avisos al celular por Telegram
async function pintarTelegram() {
  const caja = $("#aj-telegram");
  if (!caja) return;
  let t = {};
  try { t = await llamar("telegram_estado"); } catch (e) { return; }
  if (!caja.isConnected) return;
  const pasos = `<ol class="tg-pasos">
      <li>En Telegram, abrí <b>@BotFather</b> y mandale <code>/newbot</code>. Elegí un nombre y un usuario que termine en "bot" (por ejemplo, <i>santi_stats_bot</i>).</li>
      <li>BotFather te contesta con un <b>token</b> (algo como <code>123456:ABC-…</code>). Copialo y pegalo acá.</li></ol>`;
  let cuerpo;
  if (!t.configurado) {
    cuerpo = `${pasos}<div class="fila"><input class="control tg-token" data-tgtoken placeholder="Pegá el token del bot" autocomplete="off" spellcheck="false">
      <button class="boton primario" data-tgguardar>Conectar</button></div>`;
  } else if (!t.vinculado) {
    cuerpo = `<p>Bot conectado: <b>@${esc(t.bot || "")}</b>. Ahora abrí el bot en Telegram (buscalo como <b>@${esc(t.bot || "")}</b>), tocá Iniciar y mandale este código:</p>
      <div class="tg-codigo">${esc(t.codigo || "")}</div>
      <p class="apagado">Se vincula solo tu chat: después nadie más puede recibir ni consultar nada.${t.escuchando ? "" : ' <span class="ambar">La app no está escuchando a Telegram; revisá la conexión.</span>'}</p>
      <div class="fila"><button class="enlace" data-tgcomprobar>Ya lo mandé</button><span class="espacio"></span><button class="enlace" data-tgborrar>Usar otro bot</button></div>`;
  } else {
    cuerpo = `<p>✅ Vinculado con <b>${esc(t.usuario ? "@" + t.usuario : "tu chat")}</b> a través de <b>@${esc(t.bot || "")}</b>. Te llegan las mismas alertas que en Windows (respetan el silencio de la campanita).</p>
      <p class="apagado">En el chat del bot podés mandar <b>/apuestas</b> (cómo van tus apuestas pendientes, pata por pata), <b>/hoy</b> (el resultado del día) y <b>/silencio 60</b>. Funciona mientras la app esté abierta en la PC.</p>
      ${t.error ? `<p class="ambar">Último error: ${esc(t.error)}</p>` : ""}
      <div class="fila"><button class="boton" data-tgprobar>Mandar prueba al celular</button><span class="espacio"></span>
        <button class="enlace" data-tgdesvincular>Desvincular</button><button class="enlace" data-tgborrar>Quitar el bot</button></div>`;
  }
  caja.innerHTML = `<h4>Avisos al celular (Telegram)</h4>${cuerpo}<div class="u-error" role="alert"></div>`;
}
document.addEventListener("click", async (e) => {
  if (S.ruta?.s !== "ajustes") return;
  const t = e.target, caja = $("#aj-telegram");
  if (!caja || !caja.contains(t)) return;
  const error = (m) => { const el = caja.querySelector(".u-error"); if (el) el.textContent = m || ""; };
  if (t.closest("[data-tgguardar]")) {
    const token = caja.querySelector("[data-tgtoken]")?.value || "";
    t.disabled = true; error("");
    const r = await llamar("telegram_configurar", token).catch(() => null);
    t.disabled = false;
    if (r?.falta) return error(r.falta);
    return pintarTelegram();
  }
  if (t.closest("[data-tgcomprobar]")) {
    const r = await llamar("telegram_estado").catch(() => null);
    if (r && !r.vinculado) aviso("Todavía no llegó el código. Fijate de mandarlo al bot correcto; puede tardar unos segundos.", 6000);
    return pintarTelegram();
  }
  if (t.closest("[data-tgprobar]")) {
    const r = await llamar("telegram_probar").catch(() => null);
    aviso(r?.ok ? "Mandé un mensaje de prueba a tu Telegram." : `No se pudo mandar${r?.error ? ": " + r.error : ""}.`, 6000);
    return;
  }
  if (t.closest("[data-tgdesvincular]")) { await llamar("telegram_desvincular"); return pintarTelegram(); }
  if (t.closest("[data-tgborrar]")) {
    if (await confirmar("¿Quitar el bot?", "Dejan de llegar los avisos al celular. Podés volver a conectarlo cuando quieras.", "Quitar")) { await llamar("telegram_borrar"); pintarTelegram(); }
  }
});
document.addEventListener("click", async (e) => {
  if (S.ruta?.s !== "ajustes") return;
  const t = e.target;
  const iv = t.closest("[data-vintervalo] button");
  if (iv) { S.prefs.vivo_intervalo = Number(iv.dataset.v); guardarPrefs(); return pintarAjustesVivo(); }
  const va = t.closest("[data-valerta] button");
  if (va) { S.prefs.alertas = { ...(S.prefs.alertas || {}), [va.parentElement.dataset.valerta]: Number(va.dataset.v) }; guardarPrefs(); return pintarAjustesVivo(); }
  if (t.closest("[data-probar-alerta]")) {
    const r = await llamar("alertas_probar");
    aviso(r.ok ? "Mandé una notificación de prueba: tendría que aparecer abajo a la derecha." : "No se pudo mandar la notificación de Windows.", 6000);
  }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!t.matches("[data-alerta]")) return;
  S.prefs.alertas = { ...(S.prefs.alertas || {}), [t.dataset.alerta]: t.checked }; guardarPrefs();
});

setTimeout(tickVivo, 1200);


// 0.23: la app en el celular sin la PC (GitHub Pages + foto cifrada)
async function pintarMovil() {
  const caja = $("#aj-movil");
  if (!caja) return;
  let m = {};
  try { m = await llamar("movil_estado"); } catch (e) { return; }
  if (!caja.isConnected) return;
  const cuerpo = m.configurado
    ? `<p>La PC sube lo último cada 2 minutos mientras la app está abierta. En el celular: <b>${esc(m.web)}</b></p>
       <p class="apagado">${m.ultima ? `Última subida: ${esc(m.ultima.slice(11, 16))} h (${Math.round((m.bytes || 0) / 1024)} KB).` : "Todavía no subió nada."}
       ${m.error ? `<span class="ambar">Error: ${esc(m.error)}</span>` : ""}</p>
       <div class="fila"><button class="boton primario" data-msubir>Subir ahora</button><span class="espacio"></span><button class="enlace" data-mborrar>Desconectar</button></div>`
    : `<p class="apagado">Necesita un repositorio público de GitHub con Pages y un token con permiso de escritura solo en ese repositorio. Los datos van cifrados con tu contraseña.</p>
       <div class="fila"><input class="control" data-mrepo placeholder="usuario/repositorio" spellcheck="false" style="flex:1"></div>
       <div class="fila"><input class="control" data-mtoken placeholder="Token de GitHub (github_pat_…)" autocomplete="off" spellcheck="false" style="flex:1"></div>
       <div class="fila"><input class="control" data-mclave type="password" placeholder="Contraseña para abrirla en el celular" style="flex:1">
         <button class="boton primario" data-mguardar>Conectar</button></div>`;
  caja.innerHTML = `<h4>App en el celular</h4>${cuerpo}<div class="u-error" role="alert"></div>`;
}
document.addEventListener("click", async (e) => {
  if (S.ruta?.s !== "ajustes") return;
  const t = e.target, caja = $("#aj-movil");
  if (!caja || !caja.contains(t)) return;
  const err = (x) => { const c = caja.querySelector(".u-error"); if (c) c.textContent = x || ""; };
  if (t.closest("[data-mguardar]")) {
    const v = (k) => caja.querySelector(`[data-m${k}]`).value.trim();
    if (!v("repo").includes("/") || !v("token") || v("clave").length < 6) return err("Completá el repositorio (usuario/nombre), el token y una contraseña de 6 letras o más.");
    t.disabled = true; t.textContent = "Conectando…";
    const r = await llamar("movil_configurar", v("repo"), v("token"), v("clave"));
    if (!r.ok) { t.disabled = false; t.textContent = "Conectar"; return err(r.error); }
    return pintarMovil();
  }
  if (t.closest("[data-msubir]")) { t.disabled = true; t.textContent = "Subiendo…"; const r = await llamar("movil_subir"); await pintarMovil(); if (!r.ok) err(r.error); return; }
  if (t.closest("[data-mborrar]")) {
    if (await confirmar("¿Desconectar el celular?", "La PC deja de subir datos. La página queda con lo último que se subió.", "Desconectar")) { await llamar("movil_borrar"); pintarMovil(); }
  }
});
