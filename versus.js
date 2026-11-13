"use strict";
/* Stats NBA - fase 5: versus y comparación.
   V-01 con / sin / contra X y V-02 matchup directo (pestaña Versus del perfil);
   V-03 comparar 2 o 3 jugadores (pestaña Comparar de la sección Jugadores). */

// ---------------------------------------------------------------- selector de jugador
// Buscador chico con lista desplegable. No usa la clase .resultado para no abrir el perfil.
function selectorJugador(caja, { placeholder = "Buscar jugador…", excluir = [], alElegir }) {
  caja.classList.add("selector-jugador");
  caja.innerHTML = `<input class="control" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false"><div class="selector-lista"></div>`;
  const entrada = caja.querySelector("input"), lista = caja.querySelector(".selector-lista");
  let res = [], sel = 0;
  const pintarLista = () => {
    if (!res.length) { lista.classList.remove("abierta"); lista.innerHTML = ""; return; }
    lista.innerHTML = res.map((r, i) => `<div class="opcion-jugador${i === sel ? " sel" : ""}" data-i="${i}">
      ${avatarJ(r.item.id, r.item.nombre)}<div class="nombre">${resaltar(r.item.nombre, entrada.value)}</div>
      <div class="detalle">${esc([r.item.eq, r.item.pos].filter(Boolean).join(", "))}</div></div>`).join("");
    if (!lista.classList.contains("abierta")) { lista.classList.add("abierta"); entrar(lista, "desplegar-lista"); }
  };
  entrada.addEventListener("input", () => {
    res = buscar(entrada.value, 12).filter((r) => r.tipo === "j" && !excluir.includes(r.item.id)).slice(0, 7);
    sel = 0;
    pintarLista();
  });
  entrada.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); pintarLista(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); pintarLista(); }
    else if (e.key === "Enter" && res[sel]) { alElegir(res[sel].item.id); }
    else if (e.key === "Escape") { entrada.value = ""; res = []; pintarLista(); entrada.blur(); }
  });
  entrada.addEventListener("blur", () => setTimeout(() => { res = []; pintarLista(); }, 150));
  lista.addEventListener("mousedown", (e) => {
    const o = e.target.closest(".opcion-jugador");
    if (o) { e.preventDefault(); alElegir(res[Number(o.dataset.i)].item.id); }
  });
  return entrada;
}

const fracc = (a, b) => (b ? `${a}/${b}` : SIN);
const minSeg = (s) => (s == null ? SIN : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

// ---------------------------------------------------------------- V-01 y V-02: pestaña Versus
function versusX() {
  return (S.prefs.versus || {})[S.ruta.id] || null;
}
function elegirVersus(x) {
  S.prefs.versus = { ...(S.prefs.versus || {}), [S.ruta.id]: x };
  if (!x) delete S.prefs.versus[S.ruta.id];
  guardarPrefs();
  const panel = $("#panel");
  if (panel) panelVersus(panel).then(() => entrar($("#vs-detalle")));
}

async function panelVersus(panel) {
  if (!panel.querySelector(".vs-elegir")) panel.innerHTML = '<div class="vacio">Cargando…</div>';
  const pedido = S.perfilPedido, pid = S.ruta.id, x = versusX();
  const d = await llamar("versus", pid, x, { ...filtros(), sin_companero: S.sinCompanero });
  if (pedido !== S.perfilPedido || S.ruta.s !== "jugador" || S.ruta.id !== pid || (S.prefs.pestana || "resumen") !== "versus" || !$("#panel")) return;
  S.versus = d;
  pintarVersus($("#panel"), d);
}

function pintarVersus(panel, d) {
  const yo = S.perfil.ficha, x = d.x;
  const nombreCorto = (n) => esc(n.split(" ").slice(-1)[0] === "Jr." || n.split(" ").slice(-1)[0] === "III" ? n.split(" ").slice(-2).join(" ") : n.split(" ").slice(-1)[0]);
  const chips = (lista, titulo) => lista && lista.length ? `<div class="vs-sugerencias"><span class="apagado">${titulo}</span>
      ${lista.map((j) => `<button class="chip${x && x.id === j.id ? " elegido" : ""}" data-vx="${j.id}">${esc(j.nombre)}</button>`).join("")}</div>` : "";
  const sug = d.sugerencias;
  panel.innerHTML = `
    <div class="tarjeta vs-elegir">
      <div class="fila" style="align-items:flex-start;gap:18px">
        <div style="flex:1;min-width:280px">
          <h2>${x ? `${esc(yo.nombre)} y ${esc(x.nombre)}` : "Elegí un jugador para cruzar"}</h2>
          <div class="sub" style="margin:-6px 0 12px">${x ? `${esc(x.equipo || "")}${x.posicion ? `, ${esc(x.posicion)}` : ""}. <a href="#" data-jugador="${x.id}">Ver su perfil</a>` : "Compañero o rival: cómo le va con él, sin él, contra él y cuando se marcan."}</div>
          <div id="vs-selector"></div>
        </div>
        ${x ? '<button class="boton" data-vx="">Quitar</button>' : ""}
      </div>
      ${chips(sug.companeros, "Compañeros")}
      ${chips(sug.rival, `Próximo rival${sug.rival_nombre ? ` (${esc(sug.rival_nombre)})` : ""}`)}
      ${chips(d.defensores.slice(0, 5).map((j) => ({ id: j.id, nombre: j.nombre })), "Lo marcaron más")}
    </div>
    <div id="vs-detalle">${x ? bloqueEnCancha(d) + bloqueConContra(d) + bloqueMatchup(d, nombreCorto(x.nombre)) : ""}</div>
    <div class="splits" style="margin-top:16px">
      ${tablaRankingMatchup("Quiénes más lo marcaron", "defensores", d.defensores, x, d.pj)}
      ${tablaRankingMatchup("A quiénes más marcó", "marcados", d.marcados, x, d.pj)}
    </div>
    <p class="apagado" style="margin-top:12px">Los matchups salen del box score de la NBA, que asigna jugada por jugada quién marcaba a quién. Los puntos incluyen libres. Todo respeta los filtros de arriba.</p>`;
  selectorJugador($("#vs-selector"), { placeholder: x ? "Cambiar de jugador…" : "Buscar jugador…", excluir: [yo.id], alElegir: elegirVersus });
}

// ---- V-04: solo los minutos en que X está (o no está) en cancha
const colsCancha = () => [["min", "MIN"], ["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["pra", "PRA"], ["fg3m", "3PM"],
  ["tc", "TC"], ["fg_pct", "TC%"], ["tl", "TL"], ["stl", "ROB"], ["blk", "TAP"], ["tov", "PÉR"], ["plus_minus", "+/-"]];

function bloqueEnCancha(d) {
  const e = d.en_cancha, x = d.x;
  if (!e) return "";
  if (!e.grupos) {
    return `<div class="tarjeta" style="margin-top:16px"><h2>En cancha con ${esc(x.nombre)}</h2><div class="apagado">${e.partidos_con_datos
      ? "No compartieron cancha en ninguno de estos partidos."
      : "Todavía no hay jugada por jugada de estos partidos: se baja en la próxima actualización."}</div></div>`;
  }
  const modo = S.prefs.vs_modo || "36";
  const comp = e.companero;
  const nombres = comp ? { con: "Juntos en cancha", sin: `Él sin ${x.nombre}` } : { con: `Con ${x.nombre} en cancha`, sin: `Con ${x.nombre} en el banco` };
  const val = (g, k) => {
    if (k === "pra") return g.pts + g.reb + g.ast;
    return g[k];
  };
  const escala = (g, v) => (modo === "36" ? (g.seg ? (v / g.seg) * 2160 : null) : modo === "pj" ? (g.pj ? v / g.pj : null) : v);
  const celda = (g, k, otro) => {
    if (k === "tc") return fracc(g.fgm, g.fga);
    if (k === "tl") return fracc(g.ftm, g.fta);
    if (k === "fg_pct") return g.fga ? pct(g.fgm / g.fga) : SIN;
    if (k === "min") return modo === "pj" ? f1(g.pj ? g.min / g.pj : null) : f0(g.min);
    const v = escala(g, val(g, k));
    let cl = "";
    if (otro && modo !== "tot" && k !== "plus_minus") {
      const o = escala(otro, val(otro, k));
      if (v != null && o) { const r = v / o; cl = r >= 1.08 ? "mas" : r <= 0.92 ? "menos" : ""; }
    }
    if (k === "plus_minus") return `<span class="${v > 0 ? "mas" : v < 0 ? "menos" : ""}">${modo === "tot" ? signo(v) : signo1(v)}</span>`;
    return `<span class="${cl}">${modo === "tot" ? f0(v) : f1(v)}</span>`;
  };
  const gC = e.grupos.con, gS = e.grupos.sin;
  const parte = e.min_total ? gC.min / e.min_total : 0;
  const fila = (k, g, otro) => `<tr><td class="izq fuerte">${esc(nombres[k])}</td><td>${g.pj}</td>
    ${colsCancha().map(([c]) => `<td>${celda(g, c, otro)}</td>`).join("")}</tr>`;
  return `<div class="tarjeta" style="margin-top:16px;padding:16px 0 8px">
    <div class="fila" style="padding:0 18px;margin-bottom:6px"><h2 style="margin:0">En cancha ${comp ? "con" : "contra"} ${esc(x.nombre)}</h2>
      <span class="apagado">solo los minutos que ${comp ? "compartieron" : "se cruzaron"} y los que no</span><span class="espacio"></span>
      <div class="segmentado" id="vs-modo">${[["36", "Cada 36 min"], ["pj", "Por partido"], ["tot", "Totales"]].map(([k, t]) =>
        `<button data-vsmodo="${k}" class="${modo === k ? "activo" : ""}">${t}</button>`).join("")}</div></div>
    <div class="vs-parte" style="margin:4px 18px 12px">
      <div class="vs-parte-barra"><i style="width:${(parte * 100).toFixed(1)}%"></i></div>
      <span>${comp ? "Comparte" : "Lo tiene enfrente"} el <b>${nf0.format(parte * 100)}%</b> de sus minutos: ${nf0.format(gC.min)} de ${nf0.format(e.min_total)} en ${e.partidos} PJ</span>
    </div>
    <div class="caja-split"><table><thead><tr><th></th><th>PJ</th>${colsCancha().map(([, t]) => `<th>${t}</th>`).join("")}</tr></thead><tbody>
      ${fila("con", gC, gS)}${fila("sin", gS, gC)}</tbody></table></div>
    <p class="apagado" style="margin:10px 18px 0">Sale del jugada por jugada: cada punto, rebote o asistencia cuenta según si ${esc(x.nombre)} estaba en cancha en esa jugada.
      Solo partidos en que jugaron los dos.${d.pj > e.partidos_con_datos ? ` A ${d.pj - e.partidos_con_datos} de sus ${d.pj} partidos todavía les falta el jugada por jugada.` : ""} ${modo === "tot" ? "" : "En verde, 8% o más por encima de la otra fila; en rojo, 8% o más por debajo. "}El +/- es el del equipo mientras él estaba en cancha.</p>
  </div>`;
}

const colsVs = () => [["pj", "PJ", f0], ["min", "MIN", f1], ["pts", "PTS", f1], ["reb", "REB", f1], ["ast", "AST", f1], ["pra", "PRA", f1],
  ["fg3m", "3PM", f1], ["fg_pct", "TC%", pct], ["reb_chances", "Ch. REB", f1], ["ast_pot", "AST pot.", f1]];

function bloqueConContra(d) {
  const cc = d.con_contra, x = d.x;
  const nombres = { periodo: "Todo el período", con: `Con ${x.nombre}`, sin: `Sin ${x.nombre}`, contra: `Contra ${x.nombre}` };
  const base = cc.grupos.find((g) => g.grupo === "periodo");
  if (cc.grupos.length === 1) {
    return `<div class="tarjeta" style="margin-top:16px"><h2>Con y contra ${esc(x.nombre)}</h2>
      <div class="apagado">No coincidieron en ninguno de los ${base.pj} partidos que pasan los filtros.</div></div>`;
  }
  const filas = cc.grupos.map((g) => `<tr class="${g.grupo === "periodo" ? "fila-base" : ""}"><td class="izq fuerte">${esc(nombres[g.grupo])}</td>
    ${colsVs().map(([k, , fmt]) => {
      let cl = "";
      if (g.grupo !== "periodo" && k !== "pj" && k !== "fg_pct" && g[k] != null && base[k]) {
        const r = g[k] / base[k];
        cl = r >= 1.08 ? "mas" : r <= 0.92 ? "menos" : "";
      }
      return `<td class="${cl}">${g.pj || k === "pj" ? fmt(g[k]) : SIN}</td>`;
    }).join("")}</tr>`).join("");
  const partidos = cc.partidos.length ? `<h2 style="margin:18px 0 8px;padding-left:18px">Partidos en los que coincidieron</h2>
    <div class="caja-split"><table><thead><tr><th>Fecha</th><th class="izq">Rival</th><th class="izq">Cómo</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th><th>PRA</th>
      <th class="col-x">MIN de él</th><th>PTS de él</th></tr></thead><tbody>
      ${cc.partidos.map((p) => `<tr><td>${fechaCorta(p.fecha)}</td><td class="izq"><span class="apagado">${p.local ? "vs" : "@"}</span> ${esc(p.rival)}</td>
        <td class="izq">${p.relacion === "con" ? "Juntos" : "En contra"}</td><td>${f0(p.min)}</td><td class="fuerte">${p.pts}</td><td>${p.reb}</td><td>${p.ast}</td><td>${p.fg3m}</td>
        <td>${p.pts + p.reb + p.ast}</td><td class="col-x apagado">${f0(p.x_min)}</td><td class="apagado">${p.x_pts}</td></tr>`).join("")}
      </tbody></table></div>` : "";
  return `<div class="tarjeta" style="margin-top:16px;padding:16px 0 6px">
    <h2 style="padding:0 18px">Con, sin y contra ${esc(x.nombre)} <span class="apagado" style="font-weight:400">promedios por partido</span></h2>
    <div class="caja-split"><table><thead><tr><th></th>${colsVs().map(([, t]) => `<th>${t}</th>`).join("")}</tr></thead><tbody>${filas}</tbody></table></div>
    <p class="apagado" style="margin:10px 18px 0">En verde, 8% o más por encima de todo el período; en rojo, 8% o más por debajo.${cc.companero ? " \"Sin\" cuenta los partidos de ese equipo en los que él no jugó." : ""}</p>
    ${partidos}</div>`;
}

function kpisMatchup(m) {
  const k = (t, v, det) => `<div class="kpi"><div class="k">${t}</div><div class="v">${v}</div>${det ? `<div class="d apagado">${det}</div>` : ""}</div>`;
  return `<div class="kpis kpis-chico kpis-4">
    ${k("Min de marca", minSeg(m.segundos), `${m.pj} PJ`)}
    ${k("Posesiones", f1(m.posesiones))}
    ${k("PTS", m.pts, m.posesiones ? `${f1((m.pts / m.posesiones) * 100)} cada 100 pos.` : "")}
    ${k("TC", fracc(m.fgm, m.fga), m.fga ? pct(m.fgm / m.fga) : "")}
    ${k("3P", fracc(m.fg3m, m.fg3a), m.fg3a ? pct(m.fg3m / m.fg3a) : "")}
    ${k("TL", fracc(m.ftm, m.fta))}
    ${k("AST", m.ast)}
    ${k("PÉR", m.tov)}</div>`;
}

function bloqueMatchup(d, corto) {
  const m = d.matchup, x = d.x, yo = S.perfil.ficha;
  const lado = (titulo, sub, datos) => `<div class="tarjeta"><h2>${titulo} <span class="apagado" style="font-weight:400">${sub}</span></h2>
    ${datos.pj ? kpisMatchup(datos) + (datos.partidos.length > 1 ? `<div class="caja-split" style="margin:14px -18px 0"><table><thead><tr><th>Fecha</th><th>Min de marca</th><th>Posesiones</th><th>PTS</th><th>TC</th><th>3P</th><th>AST</th><th>PÉR</th></tr></thead><tbody>
      ${datos.partidos.map((p) => `<tr><td>${fechaCorta(p.fecha)}</td><td>${minSeg(p.segundos)}</td><td>${f1(p.posesiones)}</td><td class="fuerte">${p.pts}</td>
        <td>${fracc(p.fgm, p.fga)}</td><td>${fracc(p.fg3m, p.fg3a)}</td><td>${p.ast}</td><td>${p.tov}</td></tr>`).join("")}</tbody></table></div>` : "")
      : '<div class="apagado">Sin registros de marca entre ellos en estos partidos.</div>'}</div>`;
  if (!m.x_lo_marco.pj && !m.lo_marca_a_x.pj) {
    return `<div class="tarjeta" style="margin-top:16px"><h2>Matchup directo</h2><div class="apagado">${esc(x.nombre)} y ${esc(yo.nombre)} no se marcaron en ninguno de estos partidos${d.con_contra?.companero ? " (son compañeros)" : ""}.</div></div>`;
  }
  return `<div class="splits" style="margin-top:16px">
    ${lado(`Cuando ${corto} lo marcó`, `lo que hizo ${esc(yo.nombre.split(" ")[0])} atacando`, m.x_lo_marco)}
    ${lado(`Cuando él marcó a ${corto}`, `lo que hizo ${corto} atacando`, m.lo_marca_a_x)}</div>`;
}

function tablaRankingMatchup(titulo, rol, filas, x, pj) {
  if (!filas.length) return `<div class="tarjeta"><h2>${titulo}</h2><div class="apagado">Sin datos de matchups en estos partidos.</div></div>`;
  return `<div class="tarjeta" style="padding:16px 0 6px"><h2 style="padding:0 18px">${titulo} <span class="apagado" style="font-weight:400">en ${pj} PJ, clic para cruzar</span></h2>
    <div class="caja-split"><table><thead><tr><th class="izq">Jugador</th><th>PJ</th><th>Min de marca</th><th>Parte</th><th>PTS</th><th>TC</th><th>TC%</th><th>AST</th><th>PÉR</th></tr></thead><tbody>
    ${filas.map((f) => `<tr class="clic${x && x.id === f.id ? " fila-elegida" : ""}" data-vx="${f.id}"><td class="izq"><span class="fuerte">${esc(f.nombre)}</span> <span class="tricode">${esc(f.equipo || "")}</span></td>
      <td>${f.pj}</td><td>${minSeg(f.segundos)}</td><td>${f.parte == null ? SIN : nf0.format(f.parte * 100) + "%"}</td><td class="fuerte">${f.pts}</td>
      <td>${fracc(f.fgm, f.fga)}</td><td>${f.fga ? pct(f.fgm / f.fga) : SIN}</td><td>${f.ast}</td><td>${f.tov}</td></tr>`).join("")}
    </tbody></table></div></div>`;
}

document.addEventListener("click", (e) => {
  const m = e.target.closest("[data-vsmodo]");
  if (m && S.versus && $("#panel")) {
    S.prefs.vs_modo = m.dataset.vsmodo; guardarPrefs();
    pintarVersus($("#panel"), S.versus);
    return;
  }
  const b = e.target.closest("[data-vx]");
  if (!b || !$("#panel")) return;
  e.preventDefault();
  e.stopPropagation();
  elegirVersus(b.dataset.vx ? Number(b.dataset.vx) : null);
}, true);

// ---------------------------------------------------------------- V-03: comparar
// mayor es mejor salvo los marcados con -1; 0 = no se resalta (minutos y uso no son "mejores")
const filasComparar = () => [
  ["min", "MIN", f1, 0], ["pts", "PTS", f1], ["reb", "REB", f1], ["ast", "AST", f1], ["pra", "PRA", f1], ["fg3m", "3PM", f1],
  ["stl", "ROB", f1], ["blk", "TAP", f1], ["tov", "PÉR", f1, -1], ["pf", "FAL", f1, -1],
  ["fg_pct", "TC%", pct], ["fg3_pct", "3P%", pct], ["ft_pct", "TL%", pct], ["ts_pct", "TS%", pct], ["usg_pct", "USG%", pct, 0],
  ["oreb", "REB OF", f1], ["dreb", "REB DEF", f1], ["reb_chances", "Ch. REB", f1], ["ast_pot", "AST pot.", f1], ["plus_minus", "+/-", signo1],
];
const GRUPOS_COMPARAR = { min: "Básicas", fg_pct: "Tiro", oreb: "Rebote y pase" };
const STATS_SERIE = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["pra", "PRA"], ["fg3m", "3PM"]];

function filtrosComparar() {
  S.prefs.filtros_comparar = { temporadas: null, fase: "Regular Season", ultimos: null, lugar: null, ...(S.prefs.filtros_comparar || {}) };
  return S.prefs.filtros_comparar;
}
function idsComparar() {
  return (S.prefs.comparar || []).filter((id) => S.jugadorPorId[id]).slice(0, 3);
}
function compararCon(pid) {
  const ids = idsComparar().filter((x) => x !== pid);
  S.prefs.comparar = [pid, ...ids].slice(0, 3);
  S.prefs.jugadores_pestana = "comparar";
  guardarPrefs();
  ir({ s: "jugadores" });
}

async function panelComparar(caja) {
  const ids = idsComparar(), f = filtrosComparar();
  const pedido = (S.compararPedido = (S.compararPedido || 0) + 1);
  const d = ids.length ? await llamar("comparar", ids, f) : { jugadores: [], temporadas: S.datos.temporadas || [] };
  if (pedido !== S.compararPedido || !caja.isConnected) return;
  S.comparacion = d;
  const temps = d.temporadas.length ? d.temporadas : [S.datos.temporada_actual];
  const tempSel = f.temporadas ? f.temporadas[0] : temps[0];
  const js = d.jugadores;
  caja.innerHTML = `
    <div class="filtros">
      <label class="campo"><span>Temporada</span><select class="control" data-cf="temporadas">${temps.map((t) => `<option ${t === tempSel ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="campo"><span>Fase</span><select class="control" data-cf="fase">
        ${[["Regular Season", "Fase regular"], ["Playoffs", "Playoffs"], ["todas", "Todas"]].map(([v, t]) => `<option value="${v}" ${f.fase === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <div class="campo"><span>Partidos</span><div class="segmentado" data-cseg="ultimos">
        ${[[null, "Todos"], [5, "Últ. 5"], [10, "Últ. 10"], [20, "Últ. 20"]].map(([v, t]) => `<button data-v="${v ?? ""}" class="${(f.ultimos || null) === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
      <div class="campo"><span>Condición</span><div class="segmentado" data-cseg="lugar">
        ${[[null, "Todos"], ["local", "Local"], ["visita", "Visitante"]].map(([v, t]) => `<button data-v="${v ?? ""}" class="${(f.lugar || null) === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
      <span class="espacio"></span>${d.ms != null ? `<span class="apagado">${d.ms} ms</span>` : ""}
    </div>
    <div class="comparar-grilla" style="--n:${js.length + (js.length < 3 ? 1 : 0)}">
      <div></div>
      ${js.map((j) => `<div class="comparar-cab"><div class="fila" style="flex-wrap:nowrap;gap:10px">${avatarJ(j.id, j.nombre)}
          <div style="min-width:0"><a href="#" class="comparar-nombre" data-jugador="${j.id}" title="${esc(j.nombre)}">${esc(j.nombre)}</a>
          <div class="apagado">${esc([j.equipo, j.posicion].filter(Boolean).join(", "))}${j.prom.pj ? `, ${j.prom.pj} PJ` : ""}</div></div>
          <span class="espacio"></span><button class="boton-quitar" data-cquitar="${j.id}" title="Sacar de la comparación">×</button></div></div>`).join("")}
      ${js.length < 3 ? `<div class="comparar-cab comparar-sumar"><div id="comparar-selector"></div><div class="apagado" style="margin-top:6px">${js.length ? "Sumá otro jugador (hasta 3)" : "Elegí 2 o 3 jugadores"}</div></div>` : ""}
    </div>
    ${js.length >= 1 ? tablaComparar(js) : `<div class="vacio">Elegí jugadores con el buscador de arriba${recientes().length ? " o desde tus vistos recientemente:" : "."}
        <div class="fila" style="justify-content:center;margin-top:12px">${recientes().map((j) => `<button class="chip" data-csumar="${j.id}">${esc(j.nombre)}</button>`).join("")}</div></div>`}
    ${js.length >= 2 ? seriesComparar(js) : ""}`;
  const sc = $("#comparar-selector");
  if (sc) selectorJugador(sc, { placeholder: "Buscar jugador…", excluir: ids, alElegir: (id) => { S.prefs.comparar = [...ids, id]; guardarPrefs(); recargarComparar(true); } });
}

function tablaComparar(js) {
  const filas = filasComparar().map(([k, t, fmt, dir = 1]) => {
    const vals = js.map((j) => (j.prom.pj ? j.prom[k] : null));
    const validos = vals.filter((v) => v != null);
    const mejor = dir && validos.length > 1 ? (dir > 0 ? Math.max(...validos) : Math.min(...validos)) : null;
    const esPct = k.endsWith("_pct");
    const grupo = GRUPOS_COMPARAR[k] ? `<div class="comparar-grupo">${GRUPOS_COMPARAR[k]}</div>` : "";
    return `${grupo}<div class="comparar-fila"><div class="comparar-stat">${t}</div>
      ${vals.map((v, i) => {
        if (v == null) return `<div class="comparar-val">${SIN}</div>`;
        const es = mejor != null && Math.abs(v - mejor) < 1e-9;
        const dif = mejor != null && !es ? v - mejor : null;
        const sg = dif > 0 ? "+" : "";
        const difTxt = dif == null ? "" : esPct ? `${sg}${nf1.format(dif * 100)} pts` : sg + nf1.format(dif);
        const j = js[i], rg = ["pts", "reb", "ast", "pra", "fg3m", "min"].includes(k) ? j?.rangos?.[k] : null;
        return `<div class="comparar-val${es ? " mejor" : ""}"><b>${fmt(v)}</b>${difTxt ? `<span class="comparar-dif">${difTxt.replace("-", "−")}</span>` : ""}${rg ? `<span class="comparar-rango" title="La mitad central de sus partidos">${fmtRango(rg)}</span>` : ""}</div>`;
      }).join("")}${js.length < 3 ? "<div></div>" : ""}</div>`;
  }).join("");
  return `<div class="comparar-tabla" style="--n:${js.length + (js.length < 3 ? 1 : 0)}">${filas}</div>
    <p class="apagado" style="margin-top:10px">Promedios por partido con los filtros de arriba. En verde, el mejor de cada fila (en pérdidas y faltas, el menor); al lado de los demás, la diferencia con el mejor. Minutos y uso no se resaltan.</p>`;
}

function seriesComparar(js) {
  const stat = S.prefs.comparar_serie || "pts";
  const val = (p) => (stat === "pra" ? p.pts + p.reb + p.ast : p[stat]);
  const max = Math.max(1, ...js.flatMap((j) => j.ultimos.map(val)));
  const barras = (j) => {
    const ult = [...j.ultimos].reverse();
    if (!ult.length) return '<div class="apagado">Sin partidos</div>';
    const actual = [...ult].map((p) => p.temporada).sort().pop();
    return `<div class="serie">${ult.map((p, i) => `<div class="serie-col${i > 0 && ult[i - 1].temporada !== p.temporada ? " mb-temp" : ""}${p.temporada !== actual ? " serie-ant" : ""}" title="${esc(p.fecha)} ${p.local ? "vs" : "@"} ${esc(p.rival)}${p.temporada !== actual ? ` (${esc(p.temporada)})` : ""}">
      <span style="--d:${i * 45}ms">${val(p)}</span><i style="height:${Math.max(2, (val(p) / max) * 100)}%; --d:${i * 45}ms"></i><em>${p.local ? "" : "@"}${esc(p.rival)}</em></div>`).join("")}</div>`;
  };
  return `<div class="tarjeta" style="margin-top:16px">
    <div class="fila" style="margin-bottom:12px"><h2 style="margin:0">Últimos 10 partidos</h2><span class="apagado">del más viejo al más reciente, misma escala para todos; si esta temporada tiene menos, completa con la anterior</span><span class="espacio"></span>
      <div class="segmentado" id="comparar-serie">${STATS_SERIE.map(([k, t]) => `<button data-cserie="${k}" class="${k === stat ? "activo" : ""}">${t}</button>`).join("")}</div></div>
    <div class="series-grilla">${js.map((j) => `<div><div class="fuerte" style="margin-bottom:6px">${esc(j.nombre)}</div>${barras(j)}</div>`).join("")}</div></div>`;
}

let compararTimer;
function recargarComparar(animar) {
  clearTimeout(compararTimer);
  guardarPrefs();
  compararTimer = setTimeout(async () => {
    const caja = $("#jugadores-panel");
    if (!caja) return;
    await panelComparar(caja);
    if (animar) entrar($(".comparar-grilla"));
  }, 60);
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (!$("#jugadores-panel")) return;
  const q = t.closest("[data-cquitar]");
  if (q) { S.prefs.comparar = idsComparar().filter((x) => x !== Number(q.dataset.cquitar)); return recargarComparar(true); }
  const s = t.closest("[data-csumar]");
  if (s) { S.prefs.comparar = [...idsComparar(), Number(s.dataset.csumar)].slice(0, 3); return recargarComparar(true); }
  const seg = t.closest("[data-cseg] button");
  if (seg) {
    const f = filtrosComparar(), campo = seg.parentElement.dataset.cseg, v = seg.dataset.v;
    f[campo] = v === "" ? null : campo === "ultimos" ? Number(v) : v;
    return recargarComparar();
  }
  const se = t.closest("[data-cserie]");
  if (se) { S.prefs.comparar_serie = se.dataset.cserie; guardarPrefs(); panelComparar($("#jugadores-panel")); }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!t.dataset.cf) return;
  const f = filtrosComparar();
  f[t.dataset.cf] = t.dataset.cf === "temporadas" ? [t.value] : t.value;
  recargarComparar();
});
