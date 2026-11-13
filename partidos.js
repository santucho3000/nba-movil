"use strict";
/* Stats NBA - Partidos de la liga (H-01 a H-05): los partidos de cada fecha y, al entrar a uno,
   su box score, la jugada por jugada en frases con la cancha, los tiros y lo que hizo cada equipo
   por cuarto. La misma pantalla va a ser la del en vivo (fase 7). */

const P = { fecha: null, dia: null, partido: null, jugadas: null, sel: null };
const ESTADO_P = { final: "Final", en_juego: "En vivo", por_empezar: "" };
const nPeriodo = (i) => (i < 4 ? `${i + 1}C` : i === 4 ? "OT" : `${i - 3}OT`);
const fechaISO = (f) => { const [y, m, d] = f.split("-").map(Number); return new Date(y, m - 1, d); };
const colorBase = (tid) => (paletaEquipo(tid) || { acento: "#9aa6b5" }).acento;
// en un partido, si los dos equipos tienen colores parecidos (Lakers y Jazz), el local va en gris claro
function colorEq(tid) {
  const d = P.partido;
  if (!d || d.falta || !d.equipos) return colorBase(tid);
  const [v, l] = d.equipos;
  if (tid !== l.team_id) return colorBase(tid);
  const a = _rgb(colorBase(v.team_id)), b = _rgb(colorBase(l.team_id));
  const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return dist < 120 ? "#d9dee6" : colorBase(tid);
}

// ---------------------------------------------------------------- H-01: partidos de una fecha
async function vistaPartidos(c) {
  if (!c.querySelector(".partidos")) c.innerHTML = '<div class="partidos"><h1>Partidos</h1><div class="vacio">Cargando…</div></div>';
  const d = await llamar("partidos_dia", P.fecha);
  if (S.ruta.s !== "vivo") return;
  P.dia = d; P.fecha = d.fecha;
  pintarPartidos(c);
}

function pintarPartidos(c) {
  const d = P.dia;
  const fd = fechaISO(d.fecha);
  const titulo = d.fecha === d.hoy ? "Hoy" : `${DIAS_LARGO[fd.getDay()]} ${fd.getDate()} de ${MESES[fd.getMonth()]}`;
  const finales = d.partidos.filter((p) => p.estado === "final").length;
  c.innerHTML = `<div class="partidos">
    <h1>Partidos</h1>
    <p class="sub" style="margin:4px 0 16px">Los partidos de la liga por fecha. Entrá a uno para ver su box score, la jugada por jugada, los tiros y cada cuarto.</p>
    <div class="pa-fechas">
      <button class="boton" data-pfecha="${d.anterior || ""}" ${d.anterior ? "" : "disabled"} title="Día anterior con partidos">‹</button>
      <div class="pa-dia"><b>${esc(titulo)}</b><span class="apagado">${d.fecha === d.hoy ? esc(`${DIAS_LARGO[fd.getDay()]} ${fd.getDate()} de ${MESES[fd.getMonth()]}`) : esc(String(fd.getFullYear()))}</span></div>
      <button class="boton" data-pfecha="${d.siguiente || ""}" ${d.siguiente ? "" : "disabled"} title="Día siguiente con partidos">›</button>
      <input type="date" class="pa-elegir" value="${d.fecha}" min="${d.desde || ""}" max="${d.hasta || ""}" aria-label="Elegir fecha">
      ${d.fecha !== d.hoy ? '<button class="enlace" data-pfecha="hoy">Ir a hoy</button>' : ""}
      <span class="espacio"></span>
      <span class="apagado">${d.partidos.length} partido${d.partidos.length === 1 ? "" : "s"}${finales && finales < d.partidos.length ? `, ${finales} terminado${finales === 1 ? "" : "s"}` : ""}</span>
    </div>
    ${d.partidos.length ? `<div class="pa-grilla">${d.partidos.map(tarjetaPartidoDia).join("")}</div>` : '<div class="vacio">No hay partidos ese día.</div>'}
  </div>`;
}

function tarjetaPartidoDia(p) {
  const fin = p.estado === "final";
  const gana = fin && p.local.pts != null && p.visita.pts != null ? (p.local.pts > p.visita.pts ? "local" : "visita") : null;
  const nq = Math.max((p.visita.cuartos || []).length, (p.local.cuartos || []).length);
  const fila = (k) => { const e = p[k];
    return `<div class="pa-eq${gana && gana !== k ? " pierde" : ""}">${avatarE(e.team_id, e.tricode, "chico")}
      <span class="pa-nombre"><b>${esc(e.tricode || "")}</b> <span class="apagado">${esc(e.nombre || "")}</span></span>
      ${nq ? (e.cuartos || []).map((q) => `<span class="pa-q">${q}</span>`).join("") : ""}
      <span class="pa-pts">${fin || p.estado === "en_juego" ? (e.pts ?? "") : ""}</span></div>`; };
  const estado = fin ? `Final${p.alargues ? (p.alargues === 1 ? " con alargue" : ` con ${p.alargues} alargues`) : ""}`
    : p.estado === "en_juego" ? `<i class="punto-vivo"></i>En vivo${p.periodo ? `, ${esc(nPeriodo(p.periodo - 1))} ${esc(p.reloj || "")}` : ""}` : `${esc(horaCorta(p.hora_utc))} h`;
  const lid = [p.visita.lider, p.local.lider].filter(Boolean);
  return `<a href="#" class="tarjeta pa-tarjeta${p.estado === "en_juego" ? " en-vivo" : ""}" data-partido="${p.game_id}">
    <div class="pa-cab"><span>${estado}</span>${p.fase !== "Regular Season" ? `<span class="etiqueta">${esc(p.fase === "Playoffs" ? "Playoffs" : p.fase === "PlayIn" ? "Play-in" : p.fase)}</span>` : ""}
      ${nq ? `<span class="espacio"></span>${Array.from({ length: nq }, (_, i) => `<span class="pa-q apagado">${nPeriodo(i)}</span>`).join("")}<span class="pa-pts apagado">T</span>` : ""}</div>
    ${fila("visita")}${fila("local")}
    <div class="pa-pie apagado"${!(fin && !p.con_box) && !lid.length ? " hidden" : ""}>${fin && !p.con_box ? '<span class="ambar">Sin box score todavía: se baja en la próxima actualización.</span>'
      : lid.length ? lid.map((l) => `${esc(l.nombre.split(" ").slice(-1)[0])} <b>${l.pts}</b> pts, ${l.reb} reb, ${l.ast} ast`).join(" · ") : ""}</div>
  </a>`;
}

// ---------------------------------------------------------------- H-02 a H-04: un partido
const PESTANAS_P = [["box", "Box score"], ["jugadas", "Jugadas"], ["tiros", "Tiros"], ["cuartos", "Por cuarto"]];
async function vistaPartido(c) {
  const gid = S.ruta.id;
  if (!P.partido || P.partido.game_id !== gid) {
    c.innerHTML = '<div class="partido"><div class="vacio">Cargando…</div></div>';
    P.partido = await llamar("partido", gid);
    P.jugadas = null; P.sel = null; V.vp = null; V.pver = -1;
    if (S.ruta.s !== "partido" || S.ruta.id !== gid) return;
  }
  // fase 7: si se está jugando (o terminó y la base todavía no tiene su box), la pantalla en vivo
  const sinBox = P.partido.falta || !P.partido.equipos?.some((e) => e.jugadores.length);
  if (sinBox || P.partido.estado === "en_juego" || P.partido.vivo) {
    const r = await llamar("vivo_partido", gid, -1).catch(() => null);
    if (S.ruta.s !== "partido" || S.ruta.id !== gid) return;
    if (r && r.hay) {
      V.vp = r; V.pver = r.version;
      const fecha = P.partido.fecha, fase = P.partido.fase;
      P.partido = { ...partidoDesdeVivo(r.partido), ...(fecha ? { fecha } : {}), ...(fase ? { fase } : {}) };
      P.jugadas = { jugadas: r.partido.jugadas };
      return pintarPartidoVivo(c);
    }
    P.sinVivo = r ? (r.motivo === "sin box" ? "la NBA todavía no publica su box score en vivo" : r.motivo || r.error || null) : "la app no respondió";
    if (P.partido.falta) { c.innerHTML = `<div class="vacio">${esc(P.partido.falta)}</div>`; return; }
  }
  pintarPartido(c);
}

function pintarPartido(c) {
  const d = P.partido;
  if (d.falta) { c.innerHTML = `<div class="vacio">${esc(d.falta)}</div>`; return; }
  const [vis, loc] = d.equipos;
  const fin = d.estado === "final";
  const gana = fin && vis.pts != null ? (vis.pts > loc.pts ? vis : loc) : null;
  const nq = Math.max((vis.cuartos || []).length, (loc.cuartos || []).length);
  const fd = fechaISO(d.fecha);
  const lado = (e, der) => `<div class="pt-equipo${der ? " der" : ""}${gana && gana !== e ? " pierde" : ""}">
      <a href="#" data-equipo="${e.team_id}">${avatarE(e.team_id, e.tricode, "grande")}</a>
      <div class="pt-nom"><span class="apagado">${esc(e.ciudad || "")}</span><b>${esc(e.nombre || e.tricode || "")}</b></div>
      <div class="pt-pts">${e.pts ?? ""}</div></div>`;
  const tab = tabPartido();
  const previa = d.estado === "por_empezar";
  const sinBox = !vis.jugadores.length && !loc.jugadores.length;
  c.innerHTML = `<div class="partido">
    <section class="pt-marcador" style="--c-vis:${colorEq(vis.team_id)}; --c-loc:${colorEq(loc.team_id)}">
      ${lado(vis, false)}
      <div class="pt-centro">
        <div class="pt-estado">${fin ? "Final" : d.estado === "en_juego" ? '<i class="punto-vivo"></i>En vivo' : esc(horaCorta(d.hora_utc) + " h")}</div>
        <div class="apagado">${esc(`${DIAS_LARGO[fd.getDay()]} ${fd.getDate()} de ${MESES[fd.getMonth()]} de ${fd.getFullYear()}`)}${d.fase !== "Regular Season" ? `, ${esc(d.fase === "PlayIn" ? "Play-in" : d.fase)}` : ""}</div>
        ${nq ? `<table class="pt-cuartos"><thead><tr><th></th>${Array.from({ length: nq }, (_, i) => `<th>${nPeriodo(i)}</th>`).join("")}<th>T</th></tr></thead><tbody>
          ${[vis, loc].map((e) => `<tr><td class="izq">${esc(e.tricode)}</td>${Array.from({ length: nq }, (_, i) => `<td>${(e.cuartos || [])[i] ?? ""}</td>`).join("")}<td class="fuerte">${e.pts ?? ""}</td></tr>`).join("")}
        </tbody></table>` : ""}
      </div>
      ${lado(loc, true)}
    </section>
    ${Object.keys(d.lideres).length ? `<div class="pt-lideres">${[["pts", "Puntos"], ["reb", "Rebotes"], ["ast", "Asistencias"], ["fg3m", "Triples"], ["stl", "Robos"], ["blk", "Tapas"]]
      .filter(([k]) => d.lideres[k]).map(([k, t]) => { const l = d.lideres[k];
        return `<a href="#" class="pt-lider" data-jugador="${l.player_id}">${avatarJ(l.player_id, l.nombre, "chico")}<div><span class="apagado">${t}</span>
          <b>${esc(l.nombre)}</b></div><span class="pt-lider-n">${l[k]}</span></a>`; }).join("")}</div>` : ""}
    <div class="pestanas pt-tabs">${(previa ? [["apostar", "Apostar"]] : PESTANAS_P).map(([k, t]) => `<button class="pestana${tab === k ? " activa" : ""}" data-ptab="${k}">${t}</button>`).join("")}</div>
    <div id="pt-panel">${sinBox && !previa && tab !== "jugadas" ? `<div class="vacio">${d.estado === "final" ? "Todavía no está el box score de este partido: se baja en la próxima actualización."
      : d.estado === "en_juego" ? `Se está jugando, pero todavía no llegan los datos en vivo de la NBA${P.sinVivo ? ` (${esc(P.sinVivo)})` : ""}. Se reintenta solo cada pocos segundos y la cancha aparece apenas lleguen; mientras tanto, mirá la jugada por jugada.`
      : "Todavía no empezó."}</div>` : ""}</div>
  </div>`;
  if (!sinBox || previa || tab === "jugadas") panelPartido();
}

// U-20: antes del partido, la única pestaña es Apostar; después, Apostar no está
function tabPartido() {
  if (P.partido?.estado === "por_empezar") return "apostar";
  const t = S.prefs.partido_tab || "box";
  return t === "apostar" ? "box" : t;
}

function panelPartido() {
  const caja = $("#pt-panel");
  if (!caja) return;
  const tab = tabPartido();
  if (tab === "apostar") pintarApostar(caja);
  else if (tab === "box") caja.innerHTML = P.partido.equipos.map(tablaBox).join("");
  else if (tab === "cuartos") caja.innerHTML = tablaCuartos();
  else if (tab === "tiros") pintarTirosPartido(caja);
  else pintarJugadas(caja);
}

const pctT = (m, a) => (a ? `${nf0.format((m / a) * 100)}%` : "—");
function tablaBox(e, prom = null) {
  // L-04: en vivo, al lado de cada número, su promedio de los últimos 10
  const pr = (j, k) => prom && prom[j.player_id] ? `<small class="pv-prom" title="Promedio de sus últimos 10">${nf1.format(prom[j.player_id][k])}</small>` : "";
  const fila = (j) => `<tr${j.en_cancha ? ' class="en-cancha"' : ""}><td class="izq">${j.en_cancha ? '<i class="pv-punto" title="En cancha"></i>' : ""}<a href="#" data-jugador="${j.player_id}" class="fuerte">${esc(j.nombre)}</a>
      ${j.titular && j.posicion_partido ? `<span class="apagado">${esc(j.posicion_partido)}</span>` : ""}</td>
    <td>${mmss(j.min)}${pr(j, "min")}</td><td class="fuerte">${j.pts ?? 0}${pr(j, "pts")}</td><td>${j.reb ?? 0}${pr(j, "reb")}</td><td>${j.ast ?? 0}${pr(j, "ast")}</td><td>${j.stl ?? 0}</td><td>${j.blk ?? 0}</td>
    <td>${j.tov ?? 0}</td><td class="${j.pf >= 6 ? "menos" : j.pf >= 5 ? "ambar" : ""}">${j.pf ?? 0}</td>
    <td>${j.fgm}-${j.fga}</td><td>${j.fg3m}-${j.fg3a}</td><td>${j.ftm}-${j.fta}</td><td class="apagado">${j.oreb ?? 0}</td>
    <td class="${j.plus_minus > 0 ? "mas" : j.plus_minus < 0 ? "menos" : ""}">${signo(j.plus_minus)}</td></tr>`;
  const tit = e.jugadores.filter((j) => j.titular), sup = e.jugadores.filter((j) => !j.titular);
  const t = e.totales || {};
  return `<section class="tarjeta pt-box">
    <div class="fila" style="margin-bottom:10px">${logoMini(e.team_id)}<h2 style="margin:0">${esc(`${e.ciudad || ""} ${e.nombre || ""}`.trim())}</h2><span class="espacio"></span>
      <span class="apagado">TC ${pctT(t.fgm, t.fga)}, 3P ${pctT(t.fg3m, t.fg3a)}, TL ${pctT(t.ftm, t.fta)}</span></div>
    <div class="caja-split"><table><thead><tr><th class="izq">Jugador</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>ROB</th><th>TAP</th><th>PÉR</th><th>FAL</th>
      <th>TC</th><th>3P</th><th>TL</th><th title="Rebotes ofensivos">REO</th><th>+/-</th></tr></thead><tbody>
      ${tit.map(fila).join("")}
      ${sup.length ? `<tr class="sep-temp"><td colspan="14">Suplentes</td></tr>${sup.map(fila).join("")}` : ""}
      <tr class="pt-total"><td class="izq">Total</td><td></td><td>${t.pts ?? ""}</td><td>${t.reb ?? ""}</td><td>${t.ast ?? ""}</td><td>${t.stl ?? ""}</td><td>${t.blk ?? ""}</td>
        <td>${t.tov ?? ""}</td><td>${t.pf ?? ""}</td><td>${t.fgm}-${t.fga}</td><td>${t.fg3m}-${t.fg3a}</td><td>${t.ftm}-${t.fta}</td><td>${t.oreb ?? ""}</td><td></td></tr>
    </tbody></table></div></section>`;
}

function tablaCuartos() {
  const eqs = P.partido.equipos;
  const n = Math.max(...eqs.map((e) => e.por_cuarto.length));
  if (!n) return '<div class="vacio">No hay datos por cuarto de este partido.</div>';
  const filas = [["pts", "Puntos"], ["tc", "Tiros de campo"], ["t3", "Triples"], ["tl", "Tiros libres"], ["reb", "Rebotes"], ["oreb", "Rebotes ofensivos"],
    ["ast", "Asistencias"], ["tov", "Pérdidas"], ["stl", "Robos"], ["pf", "Faltas"]];
  const val = (q, k) => !q ? "—" : k === "tc" ? `${q.fgm}-${q.fga}` : k === "t3" ? `${q.fg3m}-${q.fg3a}` : k === "tl" ? `${q.ftm}-${q.fta}` : q[k];
  return `<section class="tarjeta"><div class="caja-split"><table><thead><tr><th class="izq"></th>${Array.from({ length: n }, (_, i) =>
      `<th colspan="2">${nPeriodo(i)}</th>`).join("")}</tr>
    <tr><th></th>${Array.from({ length: n }, () => eqs.map((e) => `<th class="apagado">${esc(e.tricode)}</th>`).join("")).join("")}</tr></thead><tbody>
    ${filas.map(([k, t]) => `<tr><td class="izq fuerte">${t}</td>${Array.from({ length: n }, (_, i) => eqs.map((e, ie) => {
        const a = e.por_cuarto[i], b = eqs[1 - ie].por_cuarto[i];
        const mejor = k === "pts" && a && b && a.pts > b.pts;
        return `<td class="${mejor ? "fuerte mas" : ""}${ie === 1 ? " pt-sep" : ""}">${val(a, k)}</td>`; }).join("")).join("")}</tr>`).join("")}
  </tbody></table></div></section>`;
}

// ---------------------------------------------------------------- cancha (media cancha, medidas de la NBA)
function canchaPartido(tiros, opts = {}) {
  const Y = (y) => 422.5 - y;
  const lin = `stroke="#2f3b4c" stroke-width="2" fill="none"`;
  const a3 = Math.acos(220 / 237.5);
  const y3 = Y(Math.sin(a3) * 237.5);
  let s = `<svg viewBox="-252 -2 504 476" class="cancha pt-cancha" role="img" aria-label="${esc(opts.titulo || "Cancha")}">
    <rect x="-250" y="0" width="500" height="470" fill="#131a23" stroke="#2f3b4c" stroke-width="2"/>
    <rect x="-80" y="${Y(142.5)}" width="160" height="190" ${lin}/><rect x="-60" y="${Y(142.5)}" width="120" height="190" ${lin}/>
    <path d="M -60 ${Y(142.5)} A 60 60 0 0 1 60 ${Y(142.5)}" ${lin}/>
    <path d="M -40 ${Y(0)} A 40 40 0 0 1 40 ${Y(0)}" ${lin}/>
    <line x1="-30" x2="30" y1="${Y(-7.5)}" y2="${Y(-7.5)}" stroke="#4a5768" stroke-width="3"/>
    <circle cx="0" cy="${Y(0)}" r="7.5" stroke="#f28c38" stroke-width="2" fill="none"/>
    <line x1="-220" x2="-220" y1="${Y(-47.5)}" y2="${y3}" ${lin}/><line x1="220" x2="220" y1="${Y(-47.5)}" y2="${y3}" ${lin}/>
    <path d="M -220 ${y3} A 237.5 237.5 0 0 1 220 ${y3}" ${lin}/><path d="M -60 0 A 60 60 0 0 0 60 0" ${lin}/>`;
  for (const t of tiros) {
    if (t.y == null || t.y > 420) continue;
    const r = t.sel ? 10 : 5.5, cx = t.x, cy = Y(t.y);
    const op = t.sel ? 1 : opts.apagar ? 0.35 : 0.85;
    s += t.ok ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.color}" fill-opacity="${op}" stroke="#0c0b10" stroke-width="1.5"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="${t.color}" stroke-opacity="${op}" stroke-width="2.2"/>`;
    if (t.sel) s += `<circle cx="${cx}" cy="${cy}" r="17" fill="none" stroke="${t.color}" stroke-width="2" opacity=".6"><animate attributeName="r" from="11" to="22" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" from=".8" to="0" dur="1.2s" repeatCount="indefinite"/></circle>`;
  }
  return s + "</svg>";
}

function pintarTirosPartido(caja) {
  const d = P.partido;
  const f = S.prefs.ptiros || { jugador: "" };
  const jugs = d.equipos.flatMap((e) => e.jugadores.map((j) => ({ ...j, tri: e.tricode })));
  const conTiros = new Set(d.tiros.map((t) => t[3]));
  caja.innerHTML = `<div class="filtros" style="margin-bottom:12px"><label class="campo"><span>Jugador</span>
      <select id="pt-tiros-jug"><option value="">Todos</option>${jugs.filter((j) => conTiros.has(j.player_id)).map((j) =>
        `<option value="${j.player_id}" ${String(f.jugador) === String(j.player_id) ? "selected" : ""}>${esc(j.nombre)} (${esc(j.tri)})</option>`).join("")}</select></label>
      <span class="espacio"></span><span class="apagado">Lleno: metido. Vacío: errado.</span></div>
    <div class="pt-tiros">${d.equipos.map((e) => {
      const ts = d.tiros.filter((t) => t[4] === e.team_id && (!f.jugador || String(t[3]) === String(f.jugador)));
      const m = ts.filter((t) => t[2]).length;
      return `<section class="tarjeta"><div class="fila" style="margin-bottom:8px">${logoMini(e.team_id)}<h2 style="margin:0">${esc(e.tricode)}</h2><span class="espacio"></span>
        <span class="apagado">${m} de ${ts.length} (${pctT(m, ts.length)})</span></div>
        ${ts.length ? canchaPartido(ts.map((t) => ({ x: t[0], y: t[1], ok: !!t[2], color: colorEq(e.team_id) })), { titulo: `Tiros de ${e.tricode}` })
          : '<div class="vacio">Sin tiros registrados.</div>'}</section>`; }).join("")}</div>`;
}

// ---------------------------------------------------------------- H-04: jugada por jugada
async function pintarJugadas(caja) {
  if (!P.jugadas) {
    caja.innerHTML = '<div class="vacio">Trayendo la jugada por jugada de la NBA…</div>';
    const gid = P.partido.game_id;
    const r = await llamar("jugadas_partido", gid);
    if (P.partido?.game_id !== gid || (S.prefs.partido_tab || "box") !== "jugadas") return;
    P.jugadas = r;
  }
  const r = P.jugadas;
  if (r.falta) { caja.innerHTML = `<div class="vacio">${esc(r.falta)}<br><button class="boton" data-preintentar style="margin-top:12px">Probar de nuevo</button></div>`; return; }
  const f = { cuarto: "", equipo: "", suman: false, jugador: "", nuevas: false, ...(S.prefs.pjug || {}) };
  S.prefs.pjug = f;
  const [vis, loc] = P.partido.equipos;
  const maxP = Math.max(...r.jugadas.map((j) => j.periodo || 1));
  const cuartos = [["", "Todos"], ...Array.from({ length: maxP }, (_, i) => [String(i + 1), nPeriodo(i)])];
  let lista = r.jugadas.filter((j) => (!f.cuarto || String(j.periodo) === f.cuarto)
    && (!f.equipo || String(j.team_id) === f.equipo || (j.tipo === "corte" && !f.jugador))
    && (!f.suman || j.puntos > 0 || j.tipo === "corte")
    && (!f.jugador || j.player_id === Number(f.jugador) || (j.entran || []).includes(Number(f.jugador)) || (j.salen || []).includes(Number(f.jugador))
        || (j.texto || "").includes(nombreJ(Number(f.jugador)))));
  if (f.nuevas) lista = lista.slice().reverse();
  const tiros = lista.filter((j) => j.tiro && j.tiro > 1 && j.x != null);
  const sel = P.sel != null ? r.jugadas.find((j) => j.n === P.sel) : null;
  const seg = (k, ops) => `<div class="segmentado" data-pjseg="${k}">${ops.map(([v, t]) => `<button data-v="${v}" class="${String(f[k]) === String(v) ? "activo" : ""}">${t}</button>`).join("")}</div>`;
  const jugs = P.partido.equipos.flatMap((e) => e.jugadores.map((j) => ({ ...j, tri: e.tricode })));
  caja.innerHTML = `<div class="filtros pj-filtros">
      <div class="campo"><span>Cuarto</span>${seg("cuarto", cuartos)}</div>
      <div class="campo"><span>Equipo</span>${seg("equipo", [["", "Los dos"], [String(vis.team_id), esc(vis.tricode)], [String(loc.team_id), esc(loc.tricode)]])}</div>
      <label class="campo"><span>Jugador</span><select id="pj-jugador"><option value="">Todos</option>${jugs.map((j) =>
        `<option value="${j.player_id}" ${String(f.jugador) === String(j.player_id) ? "selected" : ""}>${esc(j.nombre)} (${esc(j.tri)})</option>`).join("")}</select></label>
      <label class="interruptor" style="align-self:flex-end;margin-bottom:6px"><input type="checkbox" data-pjchk="suman" ${f.suman ? "checked" : ""}>Solo las que suman</label>
      <label class="interruptor" style="align-self:flex-end;margin-bottom:6px"><input type="checkbox" data-pjchk="nuevas" ${f.nuevas ? "checked" : ""}>Más nuevas primero</label>
    </div>
    <div class="pj-cuerpo">
      <div class="pj-lista" role="list">${lista.length ? lista.map((j) => filaJugada(j, vis, loc)).join("") : '<div class="vacio">No hay jugadas con estos filtros.</div>'}</div>
      <aside class="pj-lado">
        <div class="tarjeta pj-cancha">${canchaPartido(tiros.map((j) => ({ x: j.x, y: j.y, ok: j.ok, color: colorEq(j.team_id), sel: j.n === P.sel })),
          { apagar: !!sel, titulo: "Tiros de estas jugadas" })}
          <div class="pj-sel">${sel ? `<b>${esc(sel.texto)}</b><span class="apagado">${esc(sel.detalle || "")}${sel.detalle ? ", " : ""}${nPeriodo((sel.periodo || 1) - 1)} ${esc(sel.reloj)}</span>`
            : `<span class="apagado">${tiros.length} tiros de campo en estas jugadas. Tocá un tiro de la lista para marcarlo.</span>`}</div>
        </div>
      </aside>
    </div>`;
}
function nombreJ(pid) { return S.jugadorPorId[pid]?.nombre || "\u0000"; }

function filaJugada(j, vis, loc) {
  if (j.tipo === "corte") return `<div class="pj-corte" role="listitem">${esc(j.texto)}<span class="apagado">${esc(vis.tricode)} ${j.visita} - ${j.local} ${esc(loc.tricode)}</span></div>`;
  const esVis = j.team_id === vis.team_id;
  const anota = j.puntos > 0;
  return `<div class="pj-fila pj-${j.tipo}${anota ? " suma" : ""}${j.n === P.sel ? " sel" : ""}${j.x != null && j.tiro > 1 ? " con-tiro" : ""}" role="listitem"
      data-pjsel="${j.x != null && j.tiro > 1 ? j.n : ""}" style="--c-eq:${j.team_id ? colorEq(j.team_id) : "transparent"}">
    <span class="pj-reloj">${esc(j.reloj)}</span>
    <span class="pj-logo">${j.team_id ? logoMini(j.team_id) : ""}</span>
    <span class="pj-texto"><span>${esc(j.texto)}</span>${j.detalle ? `<span class="apagado">${esc(j.detalle)}</span>` : ""}</span>
    <span class="pj-marcador"><span class="${anota && esVis ? "fuerte" : "apagado"}">${j.visita}</span><span class="apagado">-</span><span class="${anota && !esVis ? "fuerte" : "apagado"}">${j.local}</span></span>
  </div>`;
}

// ---------------------------------------------------------------- eventos
document.addEventListener("click", (e) => {
  const t = e.target;
  const pa = t.closest("[data-partido]");
  if (pa && !t.closest("[data-equipo], [data-jugador], button, input, select")) {
    e.preventDefault();
    return ir({ s: "partido", id: pa.dataset.partido });
  }
  if (S.ruta?.s === "vivo") {
    const fe = t.closest("[data-pfecha]");
    if (fe) { e.preventDefault(); P.fecha = fe.dataset.pfecha === "hoy" ? null : fe.dataset.pfecha; return vistaPartidos($("#contenido")).then(() => entrar($(".pa-grilla"))); }
    return;
  }
  if (S.ruta?.s !== "partido") return;
  const tb = t.closest("[data-ptab]");
  if (tb) {
    S.prefs.partido_tab = tb.dataset.ptab; guardarPrefs();
    document.querySelectorAll("[data-ptab]").forEach((b) => b.classList.toggle("activa", b === tb));
    if (!P.partido.equipos.some((x) => x.jugadores.length) && tb.dataset.ptab !== "jugadas") return pintarPartido($("#contenido"));
    panelPartido(); return entrar($("#pt-panel"));
  }
  const sg = t.closest("[data-pjseg] button");
  if (sg) { S.prefs.pjug[sg.parentElement.dataset.pjseg] = sg.dataset.v; P.sel = null; guardarPrefs(); return pintarJugadas($("#pt-panel")); }
  const fi = t.closest("[data-pjsel]");
  if (fi && fi.dataset.pjsel) { P.sel = Number(fi.dataset.pjsel) === P.sel ? null : Number(fi.dataset.pjsel); return pintarJugadasConservando(); }
  if (t.closest("[data-preintentar]")) { P.jugadas = null; return pintarJugadas($("#pt-panel")); }
});
// redibujar sin perder la posición de la lista de jugadas
function pintarJugadasConservando() {
  const l = $(".pj-lista"), y = l ? l.scrollTop : 0;
  pintarJugadas($("#pt-panel"));
  const n = $(".pj-lista"); if (n) n.scrollTop = y;
}
document.addEventListener("change", (e) => {
  const t = e.target;
  if (S.ruta?.s === "vivo" && t.matches(".pa-elegir") && t.value) { P.fecha = t.value; return vistaPartidos($("#contenido")); }
  if (S.ruta?.s !== "partido") return;
  if (t.id === "pj-jugador") { S.prefs.pjug.jugador = t.value; P.sel = null; guardarPrefs(); return pintarJugadas($("#pt-panel")); }
  if (t.matches("[data-pjchk]")) { S.prefs.pjug[t.dataset.pjchk] = t.checked; guardarPrefs(); return pintarJugadas($("#pt-panel")); }
  if (t.id === "pt-tiros-jug") { S.prefs.ptiros = { jugador: t.value }; guardarPrefs(); return pintarTirosPartido($("#pt-panel")); }
});
