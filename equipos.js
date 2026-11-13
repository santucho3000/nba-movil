"use strict";
/* Stats NBA - equipos (fase 4).
   Posiciones (E-05 a E-07), ranking defensivo (E-03), ficha de equipo: resumen (E-01, E-08 a E-12),
   plantel (E-04), lo que permite por posición (E-02) y partidos (E-13). Próximo rival del jugador (J-10). */

const NOMBRE_CONF = { East: "Conferencia Este", West: "Conferencia Oeste" };
const NOMBRE_POS = { G: "Bases y escoltas", F: "Aleros", C: "Pivots" };
const FILTROS_EQ_BASE = { fase: "Regular Season", ultimos: null, lugar: null, rival: null };

function filtrosEquipo() {
  S.prefs.filtros_equipo = { ...FILTROS_EQ_BASE, ...(S.prefs.filtros_equipo || {}) };
  return S.prefs.filtros_equipo;
}
const ord = (n) => (n == null ? SIN : `${n}º`);

// puesto entre los 30 con color (E-03, E-11). En lo permitido, 1º = el que más permite (verde).
function chipPuesto(p, n = 30, titulo = "") {
  if (p == null) return SIN;
  const t = (p - 1) / Math.max(1, n - 1);
  const cl = t <= 0.33 ? "p-alto" : t >= 0.67 ? "p-bajo" : "p-medio";
  return `<span class="puesto ${cl}" title="${esc(titulo)}">${p}º</span>`;
}
function horaArg(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const zona = { timeZone: "America/Argentina/Buenos_Aires" };
    const dia = d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit", ...zona }).replace("-", "/").replace(",", "");
    const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...zona });
    return `${dia} ${hora} h`;
  } catch (e) { return iso; }
}
function barraFiltrosEquipo(f, conRival = true) {
  return `<div class="filtros" id="filtros-eq">
    <label class="campo"><span>Fase</span><select class="control" data-ef="fase">
      ${[["Regular Season", "Fase regular"], ["Playoffs", "Playoffs"], ["PlayIn", "Play-in"]].map(([v, t]) =>
        `<option value="${v}" ${f.fase === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <div class="campo"><span>Partidos</span><div class="segmentado" data-eseg="ultimos">
      ${[[null, "Todos"], [5, "Últ. 5"], [10, "Últ. 10"], [20, "Últ. 20"]].map(([v, t]) =>
        `<button data-v="${v ?? ""}" class="${(f.ultimos || null) === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
    <div class="campo"><span>Condición</span><div class="segmentado" data-eseg="lugar">
      ${[[null, "Todos"], ["local", "Local"], ["visita", "Visitante"]].map(([v, t]) =>
        `<button data-v="${v ?? ""}" class="${(f.lugar || null) === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
    ${conRival ? `<label class="campo"><span>Rival</span><select class="control" data-ef="rival"><option value="">Todos</option>
      ${S.equipos.map((e) => `<option value="${e.id}" ${Number(f.rival) === e.id ? "selected" : ""}>${esc(e.tricode)}  ${esc(e.nombre)}</option>`).join("")}</select></label>` : ""}
  </div>`;
}
function enlazarFiltrosEquipo(caja, recargar) {
  caja.querySelectorAll("[data-eseg] button").forEach((b) => b.addEventListener("click", () => {
    const campo = b.parentElement.dataset.eseg, v = b.dataset.v;
    filtrosEquipo()[campo] = v === "" ? null : campo === "ultimos" ? Number(v) : v;
    guardarPrefs(); recargar();
  }));
  caja.querySelectorAll("[data-ef]").forEach((s) => s.addEventListener("change", (e) => {
    e.stopPropagation();
    const campo = s.dataset.ef;
    filtrosEquipo()[campo] = campo === "rival" ? (s.value ? Number(s.value) : null) : s.value;
    guardarPrefs(); recargar();
  }));
}

// ---------------------------------------------------------------- sección Equipos
async function vistaEquipos(c) {
  const f = filtrosEquipo();
  const pestana = S.prefs.equipos_pestana || "posiciones";
  c.innerHTML = `<h1>Equipos</h1>
    <div class="pestanas" style="margin-top:14px">${[["posiciones", "Posiciones"], ["defensa", "Ranking defensivo"]].map(([k, t]) =>
      `<button class="pestana${pestana === k ? " activa" : ""}" data-epestana="${k}">${t}</button>`).join("")}</div>
    <div id="eq-panel"><div class="vacio">Cargando…</div></div>`;
  c.querySelectorAll("[data-epestana]").forEach((b) => b.addEventListener("click", () => {
    S.prefs.equipos_pestana = b.dataset.epestana; guardarPrefs(); vistaEquipos(c); entrar($("#eq-panel"));
  }));
  const d = await llamar("equipos", { ...f, rival: null });
  if (S.ruta.s !== "equipos") return;
  S.ligaEquipos = d;
  (pestana === "defensa" ? panelDefensa : panelPosiciones)($("#eq-panel"), d);
}

const COLS_POSICIONES = [
  ["puesto", "#"], ["equipo", "Equipo"], ["w", "G"], ["l", "P"], ["pct", "%"], ["dif", "Dif."], ["local", "Local"],
  ["visita", "Visit."], ["ult10", "Últ. 10"], ["racha", "Racha"], ["rec_conf", "Conf."], ["ppg", "PF"], ["oppg", "PC"], ["net", "Neto"],
];
function panelPosiciones(caja, d) {
  const vista = S.prefs.posiciones_vista || "conf";
  const orden = S.prefs.posiciones_orden || null;
  const filas = d.posiciones;
  const pct = (x) => (x == null ? SIN : x.toFixed(3).replace(/^0/, "").replace(".", ","));
  const valorCol = (f, k, grupo) => {
    if (k === "puesto") return grupo === "liga" ? f.puesto_liga : grupo === "div" ? f.puesto_div : f.puesto_conf;
    if (k === "dif") return grupo === "div" ? f.dif_div : f.dif_conf;
    if (k === "equipo") return `${f.ciudad} ${f.nombre}`;
    return f[k];
  };
  const tabla = (titulo, lista, grupo) => {
    let l = [...lista].sort((a, b) => valorCol(a, "puesto", grupo) - valorCol(b, "puesto", grupo));
    if (orden) {
      l.sort((a, b) => {
        const x = valorCol(a, orden.col, grupo), y = valorCol(b, orden.col, grupo);
        const nx = parseFloat(x), ny = parseFloat(y);
        const cmp = !Number.isNaN(nx) && !Number.isNaN(ny) ? nx - ny : String(x).localeCompare(String(y));
        return cmp * orden.dir;
      });
    }
    const zonas = grupo === "conf" && !orden;
    return `<div class="tarjeta" style="padding:12px 0 4px"><h2 style="padding:0 14px">${esc(titulo)}</h2>
      <div class="tabla-sin-borde"><table><thead><tr>${COLS_POSICIONES.map(([k, t]) => `<th class="ordenable${k === "equipo" ? " izq" : ""}${orden && orden.col === k ? " orden" : ""}" data-porden="${k}">${t}</th>`).join("")}</tr></thead><tbody>
      ${l.map((f) => {
        const p = valorCol(f, "puesto", grupo);
        const zona = zonas ? (p <= 6 ? "zona-po" : p <= 10 ? "zona-pi" : "") : "";
        const corte = zonas && (p === 6 || p === 10) ? " corte" : "";
        return `<tr class="clic ${zona}${corte}" data-equipo="${f.team_id}">
          <td class="apagado">${p}</td><td class="izq fuerte">${logoMini(f.team_id)}<span class="tricode">${esc(f.tricode)}</span>${esc(f.ciudad)} ${esc(f.nombre)}</td>
          <td>${f.w}</td><td>${f.l}</td><td>${pct(f.pct)}</td><td>${valorCol(f, "dif", grupo) ? nf1.format(valorCol(f, "dif", grupo)) : "—"}</td>
          <td>${esc(f.local)}</td><td>${esc(f.visita)}</td><td>${esc(f.ult10)}</td>
          <td class="${(f.racha || "").startsWith("W") ? "gano" : "perdio"}">${esc((f.racha || "").replace("W", "G").replace("L", "P"))}</td>
          <td>${esc(f.rec_conf)}</td><td>${f1(f.ppg)}</td><td>${f1(f.oppg)}</td>
          <td class="${f.net > 0 ? "mas" : f.net < 0 ? "menos" : ""}">${signo1(f.net)}</td></tr>`;
      }).join("")}</tbody></table></div></div>`;
  };
  let html = `<div class="fila" style="margin-bottom:12px">
      <div class="segmentado" id="vista-pos">${[["conf", "Por conferencia"], ["div", "Por división"], ["liga", "Liga completa"]].map(([k, t]) =>
        `<button data-pvista="${k}" class="${vista === k ? "activo" : ""}">${t}</button>`).join("")}</div>
      <span class="espacio"></span>
      ${vista === "conf" ? '<span class="leyenda-zona"><i class="po"></i>Playoffs directos (1–6)</span><span class="leyenda-zona"><i class="pi"></i>Play-in (7–10)</span>' : ""}
      ${orden ? '<button class="boton" data-porden-reset>Orden original</button>' : '<span class="apagado">Clic en un encabezado para ordenar; en un equipo, para ver su ficha</span>'}</div>`;
  if (vista === "conf") {
    html += `<div class="grilla">${["East", "West"].map((cf) => tabla(NOMBRE_CONF[cf], filas.filter((f) => f.conferencia === cf), "conf")).join("")}</div>`;
  } else if (vista === "div") {
    const divs = [...new Set(filas.map((f) => `${f.conferencia}|${f.division}`))].sort();
    html += `<div class="splits">${divs.map((dv) => { const [cf, dn] = dv.split("|"); return tabla(`${dn} (${cf === "East" ? "Este" : "Oeste"})`, filas.filter((f) => f.division === dn), "div"); }).join("")}</div>`;
  } else {
    html += tabla("Liga completa", filas, "liga");
  }
  html += `<p class="apagado" style="margin-top:10px">PF y PC: puntos a favor y en contra por partido. Neto: rating neto (puntos a favor menos en contra cada 100 posesiones). Posiciones según la NBA al momento de la última actualización.</p>`;
  caja.innerHTML = html;
  caja.querySelectorAll("[data-pvista]").forEach((b) => b.addEventListener("click", () => { S.prefs.posiciones_vista = b.dataset.pvista; guardarPrefs(); panelPosiciones(caja, d); }));
  caja.querySelectorAll("[data-porden]").forEach((th) => th.addEventListener("click", () => {
    const o = S.prefs.posiciones_orden;
    S.prefs.posiciones_orden = o && o.col === th.dataset.porden ? { col: o.col, dir: -o.dir } : { col: th.dataset.porden, dir: th.dataset.porden === "puesto" || th.dataset.porden === "l" || th.dataset.porden === "oppg" ? 1 : -1 };
    guardarPrefs(); panelPosiciones(caja, d);
  }));
  const r = caja.querySelector("[data-porden-reset]");
  if (r) r.addEventListener("click", () => { S.prefs.posiciones_orden = null; guardarPrefs(); panelPosiciones(caja, d); });
}

// ---- ranking defensivo (E-03)
const COLS_DEFENSA = [["opp_pts", "PTS"], ["opp_reb", "REB"], ["opp_ast", "AST"], ["opp_fg3m", "3PM"], ["opp_stl", "ROB"], ["opp_blk", "TAP"],
  ["opp_tov", "PÉR"], ["opp_fg_pct", "TC%"], ["opp_fg3_pct", "3P%"], ["opp_reb_chances", "Ch. REB"], ["opp_ast_pot", "AST pot."], ["drtg", "DRtg"], ["pace", "Pace"]];
const COLS_DEFENSA_POS = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["pra", "PRA"], ["fg3m", "3PM"], ["stl", "ROB"], ["blk", "TAP"], ["tov", "PÉR"],
  ["reb_chances", "Ch. REB"], ["ast_pot", "AST pot."], ["min", "MIN"]];
function panelDefensa(caja, d) {
  const pos = S.prefs.defensa_pos || "todos";
  const f = filtrosEquipo();
  const cols = pos === "todos" ? COLS_DEFENSA : COLS_DEFENSA_POS;
  const orden = S.prefs.defensa_orden && cols.some(([k]) => k === S.prefs.defensa_orden.col) ? S.prefs.defensa_orden : { col: cols[0][0], dir: -1 };
  const n = Object.keys(d.agregados).length;
  const valor = (tid, k) => (pos === "todos" ? d.agregados[tid]?.[k] : d.por_posicion[tid]?.[pos]?.[k]);
  const puesto = (tid, k) => {
    if (pos !== "todos") return d.puestos_pos[tid]?.[pos]?.[k];
    if (k === "drtg") { const p = d.puestos[tid]?.drtg; return p == null ? null : n + 1 - p; }  // 1º = el peor rating defensivo (permite más)
    return d.puestos[tid]?.[k];
  };
  const equipos = Object.keys(d.agregados).map(Number).filter((t) => d.agregados[t].pj);
  equipos.sort((a, b) => ((valor(a, orden.col) ?? -1e9) - (valor(b, orden.col) ?? -1e9)) * orden.dir);
  const fmt = (k, v) => (/pct/.test(k) ? pct(v) : f1(v));
  caja.innerHTML = `${barraFiltrosEquipo(f, false)}
    <div class="fila" style="margin:4px 0 12px">
      <span class="apagado">Lo que permite a</span>
      <div class="segmentado" id="def-pos">${[["todos", "Todos los rivales"], ["G", "Bases y escoltas"], ["F", "Aleros"], ["C", "Pivots"]].map(([k, t]) =>
        `<button data-dpos="${k}" class="${pos === k ? "activo" : ""}">${t}</button>`).join("")}</div>
      <span class="espacio"></span>
      <span class="leyenda-zona"><i style="background:var(--verde)"></i>Permite mucho</span><span class="leyenda-zona"><i style="background:var(--rojo)"></i>Defiende bien</span>
    </div>
    <div class="tabla-caja"><table><thead><tr><th class="izq">Equipo</th><th>PJ</th>
      ${cols.map(([k, t]) => `<th class="ordenable${orden.col === k ? " orden" : ""}" data-dorden="${k}">${t}${orden.col === k ? (orden.dir < 0 ? " ↓" : " ↑") : ""}</th>`).join("")}</tr></thead><tbody>
      ${equipos.map((tid) => {
        const e = S.equipoPorId[tid];
        return `<tr class="clic" data-equipo="${tid}"><td class="izq fuerte">${logoMini(tid)}<span class="tricode">${esc(e?.tricode || "")}</span>${esc(e?.nombre || "")}</td><td>${d.agregados[tid].pj}</td>
          ${cols.map(([k]) => `<td><span class="celda-puesto">${fmt(k, valor(tid, k))}${chipPuesto(puesto(tid, k), equipos.length, "1º = el que más permite")}</span></td>`).join("")}</tr>`;
      }).join("")}
    </tbody></table></div>
    <p class="apagado" style="margin-top:10px">Por partido. Puesto: 1º = el equipo que más permite esa stat (verde, conviene para el rival); 30º = el que menos permite (rojo).
      ${pos !== "todos" ? "Por posición: suma de lo que hicieron los jugadores rivales de esa posición (posición según su plantel: G, F o C; los G-F cuentan como G, los F-C como F)." : "DRtg: puntos recibidos cada 100 posesiones."}</p>`;
  enlazarFiltrosEquipo(caja, () => vistaEquipos($("#contenido")));
  caja.querySelectorAll("[data-dpos]").forEach((b) => b.addEventListener("click", () => { S.prefs.defensa_pos = b.dataset.dpos; S.prefs.defensa_orden = null; guardarPrefs(); panelDefensa(caja, d); }));
  caja.querySelectorAll("[data-dorden]").forEach((th) => th.addEventListener("click", () => {
    S.prefs.defensa_orden = orden.col === th.dataset.dorden ? { col: orden.col, dir: -orden.dir } : { col: th.dataset.dorden, dir: -1 };
    guardarPrefs(); panelDefensa(caja, d);
  }));
}

// ---------------------------------------------------------------- ficha de equipo
async function vistaEquipo(c) {
  const e = S.equipoPorId[S.ruta.id];
  if (!S.equipo || S.equipo.equipo.team_id !== S.ruta.id) {
    c.innerHTML = `<div class="perfil-cab">${avatarE(S.ruta.id, e?.tricode, "grande")}<div><h1>${esc(e ? `${e.ciudad} ${e.nombre}` : "Equipo")}</h1>
      <div class="perfil-datos"><span>Cargando…</span></div></div></div>`;
  }
  await cargarEquipo();
}
let pedidoEquipo = 0;
async function cargarEquipo() {
  if (S.ruta.s !== "equipo") return;
  const n = ++pedidoEquipo;
  const r = await llamar("equipo", S.ruta.id, filtrosEquipo());
  if (n !== pedidoEquipo || S.ruta.s !== "equipo" || S.ruta.id !== r.equipo.team_id) return;
  S.equipo = r;
  pintarEquipo();
}
function pintarEquipo() {
  const c = $("#contenido"), d = S.equipo, e = d.equipo, a = d.agregado, po = d.posicion;
  const pestana = S.prefs.pestana_equipo || "resumen";
  const f = filtrosEquipo();
  const activos = [f.ultimos ? `últimos ${f.ultimos}` : null, f.lugar ? (f.lugar === "local" ? "de local" : "de visitante") : null,
    f.rival ? `vs ${S.equipoPorId[f.rival]?.tricode}` : null].filter(Boolean);
  const prox = d.proximo;
  const vistas = [...new Set((d.partidos || []).map((x) => x.temporada).filter(Boolean))];   // C-05
  const chips = [vistas.length > 1 ? `Temporadas ${vistas.join(" y ")}` : `Temporada ${d.temporada}`, NOMBRE_FASE[d.fase] || d.fase, ...(f.ultimos ? [] : ["Todos los partidos"]), ...activos];
  c.innerHTML = `
    ${cabeceraEquipo(d)}
    ${lineaFiltros(chips, `<span class="apagado">${a.pj} de ${d.total_partidos} partidos</span><span class="apagado">${d.ms} ms</span>`, !!S.prefs.filtros_visibles)}
    ${barraFiltrosEquipo(f).replace('class="filtros" id="filtros-eq"', `class="filtros${S.prefs.filtros_visibles ? "" : " oculto"}" id="filtros-eq"`)}
    <div class="pestanas">${[["resumen", "Resumen"], ["plantel", "Plantel"], ["permite", "Lo que permite"], ["partidos", "Partidos"]].map(([k, t]) =>
      `<button class="pestana${pestana === k ? " activa" : ""}" data-eqpestana="${k}">${t}</button>`).join("")}</div>
    <div id="panel-eq"></div>`;
  aplicarEquipo(e.team_id);
  contarNumeros(c.querySelector(".cabecera"));
  enlazarFiltrosEquipo(c, () => { guardarPrefs(); cargarEquipo(); });
  c.querySelectorAll("[data-eqpestana]").forEach((b) => b.addEventListener("click", () => { S.prefs.pestana_equipo = b.dataset.eqpestana; guardarPrefs(); pintarEquipo(); entrar($("#panel-eq")); }));
  const panel = $("#panel-eq");
  if (!a.pj && pestana !== "plantel") { panel.innerHTML = '<div class="vacio">No hay partidos con estos filtros.</div>'; return; }
  ({ resumen: panelEquipoResumen, plantel: panelEquipoPlantel, permite: panelEquipoPermite, partidos: panelEquipoPartidos }[pestana])(panel);
  contarKpis(panel);
}

// ---- resumen (E-01, E-08 a E-11)
const SECCIONES_EQ = [
  ["Básicas", [["pts", "Puntos"], ["reb", "Rebotes"], ["oreb", "Rebotes ofensivos"], ["dreb", "Rebotes defensivos"], ["ast", "Asistencias"],
    ["stl", "Robos"], ["blk", "Tapas"], ["tov", "Pérdidas"], ["pf", "Faltas", 1], ["fgm", "TC convertidos"], ["fga", "TC intentados"], ["fg_pct", "TC%"],
    ["fg3m", "Triples convertidos"], ["fg3a", "Triples intentados"], ["fg3_pct", "3P%"], ["ftm", "Libres convertidos"], ["fta", "Libres intentados"],
    ["ft_pct", "TL%", 1], ["pts_pintura", "Puntos en la pintura"], ["pts_contra", "Puntos de contraataque"], ["pts_2da", "Puntos de 2da oportunidad"],
    ["pts_perdidas", "Puntos tras pérdidas"]]],
  ["Avanzadas y cuatro factores", [["efg_pct", "eFG%"], ["tov_pct", "Pérdidas por posesión"], ["oreb_pct", "% rebote ofensivo"], ["fta_rate", "Libres por tiro (TLI/TCI)"]]],
  ["Tracking y hustle", [["reb_chances", "Chances de rebote"], ["ast_pot", "Asistencias potenciales"], ["desvios", "Desvíos"],
    ["contestados", "Tiros contestados"], ["box_outs", "Box outs"]]],
];
function panelEquipoResumen(panel) {
  const d = S.equipo, a = d.agregado, p = d.puestos, n = d.n_equipos, u = d.ultimos10;
  const fmt = (k, v) => (/pct|rate/.test(k) ? pct(v) : f1(v));
  const kp = (k, t, v, puesto, extra) => `<div class="kpi"><div class="k">${t}</div><div class="v">${v}</div>
    <div class="d">${puesto != null ? chipPuesto(puesto, n) + " " : ""}${extra || ""}</div></div>`;
  const tend = (k) => {
    if (!u || u[k] == null || a[k] == null) return "";
    const dif = u[k] - a[k];
    return `<span class="${Math.abs(dif) < 0.5 ? "apagado" : (dif > 0) === (k !== "drtg") ? "mas" : "menos"}">últ. 10: ${f1(u[k])}</span>`;
  };
  panel.innerHTML = `<div class="kpis">
      ${kp("rec", "Récord", `${a.g}-${a.p}`, null, `<span class="apagado">${a.pj} PJ</span>`)}
      ${kp("ortg", "ORtg", f1(a.ortg), p.ortg, tend("ortg"))}
      ${kp("drtg", "DRtg", f1(a.drtg), p.drtg, tend("drtg"))}
      ${kp("net", "Neto", signo1(a.net), p.net, tend("net"))}
      ${kp("pace", "Pace", f1(a.pace), p.pace, tend("pace"))}
      ${kp("pts", "PTS", f1(a.pts), p.pts, tend("pts"))}
      ${kp("opp_pts", "PTS perm.", f1(a.opp_pts), p.opp_pts, tend("opp_pts"))}
      ${kp("total", "Total partido", f1(a.total), p.total, tend("total"))}
      ${kp("margen", "Margen", signo1(a.margen), p.margen, "")}
    </div>
    <div class="splits">${SECCIONES_EQ.map(([titulo, filas]) => `<div class="tarjeta" style="padding:12px 0 4px"><h2 style="padding:0 14px">${titulo}</h2>
      <table><thead><tr><th>Por partido</th><th>Propio</th><th>Puesto</th><th>Permitido</th><th>Puesto</th></tr></thead><tbody>
      ${filas.map(([k, t, sinPerm]) => `<tr><td class="izq">${t}</td><td class="fuerte">${fmt(k, a[k])}</td><td>${chipPuesto(p[k], n, "1º = el mejor de la liga")}</td>
        <td>${sinPerm ? SIN : fmt(k, a["opp_" + k])}</td><td>${sinPerm ? "" : chipPuesto(p["opp_" + k], n, "1º = el que más permite")}</td></tr>`).join("")}
      </tbody></table></div>`).join("")}</div>
    <p class="apagado" style="margin-top:10px">Puesto entre los ${n} equipos con los mismos filtros (E-11). En lo propio, 1º = el mejor (en pérdidas, faltas y DRtg, el que menos tiene).
      En lo permitido, 1º = el que más permite (verde, conviene para el rival). ${u ? "Debajo de los números de arriba: los últimos 10 partidos." : ""}</p>`;
}

// ---- plantel (E-04)
function panelEquipoPlantel(panel) {
  const pl = S.equipo.plantel;
  panel.innerHTML = `<div class="tabla-caja"><table><thead><tr><th class="izq">#</th><th class="izq">Jugador</th><th class="izq">Pos.</th><th>PJ</th><th>Tit.</th>
      <th>MIN</th><th title="Minutos promedio en los últimos 5 partidos del equipo">MIN últ. 5</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th></tr></thead><tbody>
    ${pl.jugadores.map((j) => {
      const dif = j.min_u5 != null && j.min != null ? j.min_u5 - j.min : 0;
      const flecha = Math.abs(dif) >= 3 ? `<span class="${dif > 0 ? "mas" : "menos"}">${dif > 0 ? "▲" : "▼"}</span> ` : "";
      return `<tr class="clic" data-jugador="${j.id}"><td class="izq apagado">${esc(j.numero || "")}</td><td class="izq fuerte">${esc(j.nombre)}</td>
        <td class="izq apagado">${esc(j.posicion || "")}</td><td>${j.pj}</td><td>${j.titular}</td><td>${f1(j.min)}</td>
        <td>${j.min_u5 == null ? SIN : `${flecha}${f1(j.min_u5)} <span class="apagado">(${j.pj_u5})</span>`}</td>
        <td>${f1(j.pts)}</td><td>${f1(j.reb)}</td><td>${f1(j.ast)}</td><td>${f1(j.fg3m)}</td></tr>`;
    }).join("")}</tbody></table></div>
    <p class="apagado" style="margin-top:10px">Ordenado por minutos en los últimos 5 partidos del equipo (la rotación actual). ▲▼: 3 minutos o más por encima o por debajo de su promedio. Entre paréntesis, cuántos de esos 5 jugó. Sin filtros: toda la temporada.</p>`;
}

// ---- lo que permite por posición (E-02)
const FILAS_PERMITE = [["pts", "Puntos"], ["reb", "Rebotes"], ["ast", "Asistencias"], ["pra", "PTS+REB+AST"], ["fg3m", "Triples"], ["stl", "Robos"],
  ["blk", "Tapas"], ["tov", "Pérdidas"], ["reb_chances", "Chances de rebote"], ["ast_pot", "Asistencias potenciales"], ["min", "Minutos"]];
function panelEquipoPermite(panel) {
  const d = S.equipo, pp = d.por_posicion || {}, pu = d.puestos_pos || {}, n = d.n_equipos, a = d.agregado, p = d.puestos;
  const total = { pts: a.opp_pts, reb: a.opp_reb, ast: a.opp_ast, fg3m: a.opp_fg3m, stl: a.opp_stl, blk: a.opp_blk, tov: a.opp_tov,
    reb_chances: a.opp_reb_chances, ast_pot: a.opp_ast_pot, pra: a.opp_pts != null ? a.opp_pts + a.opp_reb + a.opp_ast : null };
  const ptotal = { pts: p.opp_pts, reb: p.opp_reb, ast: p.opp_ast, fg3m: p.opp_fg3m, stl: p.opp_stl, blk: p.opp_blk, tov: p.opp_tov,
    reb_chances: p.opp_reb_chances, ast_pot: p.opp_ast_pot };
  panel.innerHTML = `<div class="tabla-caja" style="max-width:980px"><table><thead><tr><th>Por partido</th>
      ${["G", "F", "C"].map((b) => `<th colspan="2">${NOMBRE_POS[b]} (${b})</th>`).join("")}<th colspan="2">Todos los rivales</th></tr></thead><tbody>
    ${FILAS_PERMITE.map(([k, t]) => `<tr><td class="izq">${t}</td>
      ${["G", "F", "C"].map((b) => `<td class="fuerte">${f1(pp[b]?.[k])}</td><td>${chipPuesto(pu[b]?.[k], n, "1º = el que más permite a esa posición")}</td>`).join("")}
      <td class="fuerte">${k === "min" ? SIN : f1(total[k])}</td><td>${k === "min" ? "" : chipPuesto(ptotal[k], n, "1º = el que más permite")}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="apagado" style="margin-top:10px">Lo que hicieron, sumados, los jugadores rivales de cada posición contra este equipo, por partido (E-02). Puesto: 1º = el equipo que más permite (verde).
      Posición según el plantel: G, F o C (los G-F cuentan como G, los F-C como F). Los minutos muestran cuánto jugaron esas posiciones: ayudan a leer los demás números.</p>`;
}

// ---- partidos (E-13)
const COLS_EQ_PARTIDOS = [["fecha", "Fecha"], ["rival", "Rival"], ["res", "Res."], ["pts", "PTS"], ["opp_pts", "PERM."], ["total", "Total"],
  ["reb", "REB"], ["ast", "AST"], ["fg3", "3P"], ["fg_pct", "TC%"], ["tov", "PÉR"], ["pace", "Pace"], ["off_rating", "ORtg"], ["def_rating", "DRtg"]];
function panelEquipoPartidos(panel) {
  const vista = S.prefs.vista_partidos_eq || "tabla";
  const conm = `<div class="segmentado"><button data-evista="tabla" class="${vista === "tabla" ? "activo" : ""}">Tabla</button><button data-evista="graficos" class="${vista === "graficos" ? "activo" : ""}">Gráficos</button></div>`;
  const filas = S.equipo.partidos;
  if (vista === "graficos") {
    panel.innerHTML = `<div class="fila" style="margin-bottom:12px">${conm}<span class="espacio"></span><span class="apagado">Pasá el mouse por una barra para ver el partido</span></div>
      <div class="grafico" id="graf-equipo"></div>`;
    graficoPartidos($("#graf-equipo"), {
      clave: "equipo", stat: "pts", stats: ["pts", "opp_pts", "total", "reb", "opp_reb", "ast", "opp_ast", "fg3m", "opp_fg3m", "stl", "blk", "tov", "pace"],
      fuente: { partidos: filas, idLinea: "e" + S.equipo.equipo.team_id, filtros: filtrosEquipo, recargar: () => { guardarPrefs(); cargarEquipo(); } },
    });
  } else {
    panel.innerHTML = `<div class="fila" style="margin-bottom:12px">${conm}</div>
      <div class="tabla-caja"><table><thead><tr>${COLS_EQ_PARTIDOS.map(([k, t]) => `<th class="${["fecha", "rival", "res"].includes(k) ? "izq" : ""}">${t}</th>`).join("")}</tr></thead><tbody>
      ${filasPorTemporada(filas, COLS_EQ_PARTIDOS.length, true, (p, cl) => `<tr${cl}${p.game_id ? ` data-partido="${p.game_id}" title="Ver el partido"` : ""}><td class="izq">${fechaCorta(p.fecha)}</td><td class="izq"><span class="apagado">${p.local ? "vs" : "@"}</span> ${esc(p.rival)}</td>
        <td class="izq"><span class="${p.resultado === "W" ? "gano" : "perdio"}">${p.resultado === "W" ? "G" : "P"}</span> ${p.pts_eq}-${p.pts_riv}</td>
        <td class="fuerte">${p.pts}</td><td>${p.opp_pts ?? SIN}</td><td>${p.total}</td><td>${p.reb}</td><td>${p.ast}</td><td>${p.fg3m}-${p.fg3a}</td>
        <td>${pct(p.fga ? p.fgm / p.fga : null)}</td><td>${p.tov}</td><td>${f1(p.pace)}</td><td>${f1(p.off_rating)}</td><td>${f1(p.def_rating)}</td></tr>`)}
      </tbody></table></div>`;
  }
  panel.querySelectorAll("[data-evista]").forEach((b) => b.addEventListener("click", () => { S.prefs.vista_partidos_eq = b.dataset.evista; guardarPrefs(); panelEquipoPartidos(panel); entrar(panel); }));
}

// ---------------------------------------------------------------- próximo rival en el perfil del jugador (J-10)
function bloqueProximoRival() {
  const p = S.perfil.proximo;
  if (!p) return "";
  const filas = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["pra", "PRA"], ["fg3m", "3PM"], ["reb_chances", "Ch. REB"], ["ast_pot", "AST pot."]];
  const prom = S.perfil.resumen.total;
  return `<div class="tarjeta proximo-rival">
    <div class="fila" style="margin-bottom:10px"><h2 style="margin:0">Próximo partido: ${p.local ? "vs" : "@"} <a href="#" data-equipo="${p.rival_id}">${esc(p.rival)}</a></h2>
      <span class="apagado">${esc(horaArg(p.hora_utc))} (hora argentina)</span><span class="espacio"></span>
      ${p.puesto_def != null ? `<span class="apagado">Rating defensivo ${f1(p.rating_def)} ${chipPuesto(p.n_equipos + 1 - p.puesto_def, p.n_equipos, "1º = la peor defensa (permite más)")}</span>` : ""}
      ${p.pace != null ? `<span class="apagado">Pace ${f1(p.pace)} ${chipPuesto(p.puesto_pace, p.n_equipos, "1º = el que juega más rápido")}</span>` : ""}</div>
    ${p.permite ? `<div class="apagado" style="margin-bottom:8px">Lo que ${esc(p.rival)} le permite por partido a los ${esc(NOMBRE_POS[p.posicion].toLowerCase())} rivales (todos sumados), y su puesto (1º = el que más permite):</div>
      <div class="fila">${filas.map(([k, t]) => `<div class="mini-kpi"><span>${t}</span><b>${f1(p.permite[k])}</b>${chipPuesto(p.puestos?.[k], p.n_equipos)}</div>`).join("")}</div>`
      : '<div class="apagado">Sin posición cargada para este jugador.</div>'}
  </div>`;
}

document.addEventListener("click", (e) => {
  const eq = e.target.closest("[data-equipo]");
  if (eq && !e.defaultPrevented) { e.preventDefault(); ir({ s: "equipo", id: Number(eq.dataset.equipo) }); }
});
