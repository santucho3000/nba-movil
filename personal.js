"use strict";
/* Stats NBA - fase 6, lo personal: favoritos (P-01, F), notas (P-02), buscador por stat (P-03).
   Los datos viven en datos/usuario.db (S-04); acá hay una copia en memoria en S.usuario. */

// ---------------------------------------------------------------- estrella de favorito (P-01, F-02)
const SVG_ESTRELLA = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/></svg>';
function esFavorito(id) {
  return (S.usuario?.favoritos || []).includes(Number(id));
}
function estrella(id, extra = "") {
  const es = esFavorito(id);
  return `<button class="estrella${es ? " activa" : ""}${extra ? " " + extra : ""}" data-fav="${id}"
    title="${es ? "Quitar de favoritos" : "Agregar a favoritos"}" aria-pressed="${es}">${SVG_ESTRELLA}</button>`;
}
async function alternarFavorito(id) {
  id = Number(id);
  const antes = [...S.usuario.favoritos];
  const es = !esFavorito(id);
  S.usuario.favoritos = es ? [...antes, id] : antes.filter((x) => x !== id);
  pintarEstrellas(id, es, true);
  try {
    const r = await llamar("alternar_favorito", id);
    S.usuario.favoritos = r.favoritos;
  } catch (e) {
    S.usuario.favoritos = antes;
    pintarEstrellas(id, !es);
    return;
  }
  const nombre = S.jugadorPorId[id]?.nombre || "El jugador";
  aviso(es ? `${nombre} está en tus favoritos` : `${nombre} salió de tus favoritos`, 1800);
  if (S.ruta.s === "favoritos" && !es) vistaFavoritos($("#contenido"));
}
function pintarEstrellas(id, es, animar) {
  document.querySelectorAll(`.estrella[data-fav="${id}"]`).forEach((b) => {
    b.classList.toggle("activa", es);
    b.title = es ? "Quitar de favoritos" : "Agregar a favoritos";
    b.setAttribute("aria-pressed", es);
    if (animar && es) entrar(b, "latido");
  });
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-fav]");
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();        // dentro de un resultado del buscador, no abrir el perfil
  alternarFavorito(b.dataset.fav);
}, true);

// ---------------------------------------------------------------- notas (P-02)
async function panelNotas(panel) {
  const pid = S.ruta.id;
  panel.innerHTML = '<div class="vacio">Cargando…</div>';
  const n = await llamar("nota", pid);
  if (S.ruta.s !== "jugador" || S.ruta.id !== pid || (S.prefs.pestana || "resumen") !== "notas" || !$("#panel")) return;
  panel.innerHTML = `<div class="tarjeta nota-caja">
      <div class="fila" style="margin-bottom:10px"><h2 style="margin:0">Notas sobre ${esc(S.perfil.ficha.nombre)}</h2><span class="espacio"></span>
        <span class="apagado" id="nota-estado">${n.actualizado ? `Guardada ${esc(cuando(n.actualizado))}` : "Se guarda sola mientras escribís"}</span></div>
      <textarea id="nota-texto" class="control nota-texto" spellcheck="true" lang="es"
        placeholder="Lo que quieras recordar: cómo rinde de visitante, con quién se le cae el uso, qué líneas mirar…">${esc(n.texto)}</textarea>
      <div class="apagado" style="margin-top:8px">La primera línea es la que se ve en su tarjeta de favoritos. Las notas se guardan en tu PC, aparte de la base de stats.</div>
    </div>`;
  const t = $("#nota-texto"), estado = $("#nota-estado");
  let timer, guardado = n.texto;
  const guardar = async () => {
    if (t.value === guardado) return;
    estado.textContent = "Guardando…";
    const r = await llamar("guardar_nota", pid, t.value);
    guardado = t.value;
    const lista = new Set(S.usuario.notas);
    r.texto ? lista.add(pid) : lista.delete(pid);
    S.usuario.notas = [...lista];
    estado.textContent = r.actualizado ? "Guardada recién" : "Nota vacía";
  };
  t.addEventListener("input", () => { estado.textContent = "Escribiendo…"; clearTimeout(timer); timer = setTimeout(guardar, 600); });
  t.addEventListener("blur", () => { clearTimeout(timer); guardar(); });
  t.focus();
  t.setSelectionRange(t.value.length, t.value.length);
}
function cuando(iso) {
  const d = new Date(iso), seg = (Date.now() - d) / 1000;
  if (seg < 90) return "recién";
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.round(seg / 3600)} h`;
  return `el ${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}`;
}

// ---------------------------------------------------------------- favoritos (F-01 a F-10)
// stats que se pueden elegir para la tarjeta (F-10)
const OPC_TARJETA = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["pra", "PRA"], ["fg3m", "3PM"], ["pr", "P+R"], ["pa", "P+A"],
  ["ra", "R+A"], ["stl", "ROB"], ["blk", "TAP"], ["sb", "ROB+TAP"], ["tov", "PÉR"], ["min", "MIN"], ["oreb", "REB OF"],
  ["reb_chances", "Ch. REB"], ["ast_pot", "AST pot."], ["fga", "TCI"], ["fta", "TLI"]];
const NOMBRE_OPC = Object.fromEntries(OPC_TARJETA);
const statDe = (k) => STAT_G[k] || { id: k, t: NOMBRE_OPC[k] || k };
const promedioDe = (ps, k) => {
  const v = ps.map((p) => valorStat(statDe(k), p)).filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
function tendencia(fav) {
  const ps = fav.partidos;
  if (ps.length < 6) return 0;
  const r = fav.stats.map((k) => { const t = promedioDe(ps, k), u = promedioDe(ps.slice(0, 5), k); return t ? u / t - 1 : 0; });
  return r.reduce((a, b) => a + b, 0) / r.length;
}

async function vistaFavoritos(c) {
  const primera = !c.querySelector(".favoritos-grilla, .favoritos-vacio");
  if (primera) c.innerHTML = '<h1>Favoritos</h1><div class="vacio">Cargando…</div>';
  const d = await llamar("favoritos");
  if (S.ruta.s !== "favoritos") return;
  S.favs = d;
  pintarFavoritos(c);
  pintarFavoritosVivo();
}

function pintarFavoritos(c) {
  const d = S.favs;
  const grupoSel = S.prefs.fav_grupo ?? "";
  const orden = S.prefs.fav_orden || "agregado";
  let favs = d.favoritos.filter((f) => !grupoSel || (grupoSel === "-" ? !f.grupo : f.grupo === grupoSel));
  const prox = (f) => f.proximo?.hora_utc || "9999";
  if (orden === "nombre") favs.sort((a, b) => a.nombre.localeCompare(b.nombre));
  else if (orden === "pronto") favs.sort((a, b) => prox(a).localeCompare(prox(b)));
  else if (orden === "tendencia") favs.sort((a, b) => tendencia(b) - tendencia(a));
  const grupos = d.grupos;
  c.innerHTML = `<div class="fila" style="margin-bottom:6px"><h1 style="margin:0">Favoritos</h1><span class="espacio"></span>
      ${d.favoritos.length ? `<span class="apagado">${d.favoritos.length} jugador${d.favoritos.length === 1 ? "" : "es"}</span>` : ""}</div>
    <p class="sub" style="margin:0 0 16px">Los jugadores que marcaste con la estrella, con cómo vienen y contra quién juegan.</p>
    ${d.favoritos.length ? `<div class="filtros">
      <div class="campo"><span>Grupo</span><div class="segmentado" id="fav-grupos">
        ${[["", "Todos"], ...grupos.map((g) => [g, g]), ...(grupos.length ? [["-", "Sin grupo"]] : [])].map(([v, t]) =>
          `<button data-fgrupo="${esc(v)}" class="${grupoSel === v ? "activo" : ""}">${esc(t)}</button>`).join("")}</div></div>
      <label class="campo"><span>Orden</span><select class="control" id="fav-orden">
        ${[["agregado", "Como los agregué"], ["pronto", "Quién juega primero"], ["tendencia", "Mejor tendencia"], ["nombre", "Nombre"]].map(([v, t]) =>
          `<option value="${v}" ${orden === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <span class="espacio"></span>
      <button class="boton" data-faccion="nuevo-grupo">Nuevo grupo</button>
      ${grupoSel && grupoSel !== "-" ? `<button class="boton" data-faccion="borrar-grupo">Borrar grupo</button>` : ""}
    </div>` : ""}
    ${d.favoritos.length ? `<div class="favoritos-grilla">${favs.map(tarjetaFavorito).join("") ||
        '<div class="vacio">No hay favoritos en este grupo.</div>'}</div>`
      : `<div class="vacio favoritos-vacio">Todavía no marcaste favoritos.<br>Tocá la estrella al lado del nombre en el perfil de un jugador, o en el buscador.
          ${recientes().length ? `<div class="fila" style="justify-content:center;margin-top:16px">${recientes().map((j) =>
            `<span class="chip" data-jugador="${j.id}">${esc(j.nombre)}${estrella(j.id, "chica")}</span>`).join("")}</div>` : ""}</div>`}`;
  contarKpis(c);
}

function tarjetaFavorito(f) {
  const ps = f.partidos, ult = ps[0], pr = f.proximo;
  const recientes = ps.concat(f.anteriores || []);            // C-05: los últimos 5 completan con la temporada pasada
  const filasStats = f.stats.map((k) => {
    const t = promedioDe(ps, k), u = promedioDe(recientes.slice(0, 5), k);
    let flecha = "", cl = "apagado";
    if (t && u != null && ps.length > 5) {
      const r = u / t - 1;
      const malo = k === "tov";
      if (r >= 0.05) { flecha = "▲"; cl = malo ? "menos" : "mas"; } else if (r <= -0.05) { flecha = "▼"; cl = malo ? "mas" : "menos"; } else flecha = "•";
    }
    return `<div class="fav-stat"><span>${esc(statDe(k).t)}</span><b>${f1(u)}</b><i class="${cl}">${flecha}</i><em>${f1(t)}</em></div>`;
  }).join("");
  const statG = f.stats.includes(f.stat_grafico) ? f.stat_grafico : f.stats[0];
  const proximo = pr ? `<div class="fav-proximo"><span class="apagado">Próximo</span> <b>${pr.local ? "vs" : "@"} ${esc(pr.rival)}</b>
      <span class="apagado">${esc(horaArg(pr.hora_utc))}</span>
      ${pr.puestos ? `<span class="fav-permite" title="Puesto del rival en lo que le permite a los ${esc(pr.posicion_nombre || "")} (1º = el que más permite)">
        <span>le permite a los ${esc(pr.posicion || "")}:</span> ${f.stats.filter((k) => pr.puestos[k] != null).slice(0, 4).map((k) => `${esc(statDe(k).t)} ${chipPuesto(pr.puestos[k], pr.n_equipos)}`).join(" ")}</span>` : ""}</div>`
    : '<div class="fav-proximo apagado">Sin próximo partido cargado</div>';
  const ultimo = ult ? `<div class="fav-ultimo"><span class="apagado">Último</span><span>${fechaCorta(ult.fecha)} ${ult.local ? "vs" : "@"} ${esc(ult.rival)}
      <span class="${ult.resultado === "W" ? "gano" : "perdio"}">(${ult.resultado === "W" ? "G" : "P"} ${ult.pts_eq}-${ult.pts_riv})</span></span>
      <span><b>${ult.pts}</b> PTS, <b>${ult.reb}</b> REB, <b>${ult.ast}</b> AST <span class="apagado">en ${f0(ult.min)} min</span></span></div>` : "";
  const rachas = [...(f.lineas || []).map((r) => ({ ...r, tuya: true })), ...(f.rachas || [])].slice(0, 4);
  return `<div class="tarjeta fav-tarjeta" data-ftarjeta="${f.id}">
    <div class="fav-cab">${avatarJ(f.id, f.nombre)}
      <div style="min-width:0;flex:1"><a href="#" class="fav-nombre" data-jugador="${f.id}">${esc(f.nombre)}</a>
        <div class="apagado">${esc([f.equipo, f.posicion, f.grupo].filter(Boolean).join(", "))}</div></div>
      ${estrella(f.id)}<button class="boton-menu" data-fmenu="${f.id}" title="Grupo, stats y alertas">⋯</button></div>
    <div class="fav-vivo" data-fvivo="${f.id}" hidden></div>
    ${proximo}${ultimo}
    <div class="fav-stats"><div class="fav-stats-cab"><span></span><span>Últ. 5</span><span></span><span>Temp.</span></div>${filasStats}</div>
    <div class="fav-graf">
      <div class="segmentado fav-graf-stats">${f.stats.map((k) => `<button data-fgraf="${f.id}|${k}" class="${k === statG ? "activo" : ""}">${esc(statDe(k).t)}</button>`).join("")}</div>
      ${miniBarras(f, statG)}</div>
    ${rachas.length ? `<div class="fav-rachas">${rachas.map((r) => `<span class="fav-racha ${r.tuya ? "tuya" : r.puntaje > 0 ? "sube" : "baja"}"
        title="${r.tuya ? "Tu línea" : "Racha"}: superó ${nf1.format(r.linea)} en ${r.u5.si} de los últimos ${r.u5.n} (base ${r.base_cumple.si}/${r.base_cumple.n}${r.base ? `, temporada ${r.base}` : ""})">
        ${r.tuya ? "Tu línea " : r.puntaje > 0 ? "▲ " : "▼ "}${esc(STAT_G[r.stat]?.t || r.stat)} ${nf1.format(r.linea)}: ${r.u5.si}/${r.u5.n}${r.etiqueta ? `, ${esc(r.etiqueta)}` : ""}</span>`).join("")}</div>` : ""}
    ${(f.senales || []).length ? `<div class="fav-rachas"><span class="apagado" style="align-self:center">Señales:</span>${f.senales.map((x) => `<span class="fav-racha ${x.lado === "mas" ? "sube" : "baja"}"
        title="${esc(x.linea != null ? `${x.lado === "mas" ? "Más" : "Menos"} de ${lineaTxt(x.linea)} ${SEN_CORTO[x.stat]}: chance ${pctCh(x.chance)}. Promedio ${nf1.format(x.base)} → esperado ${nf1.format(x.esperado)}. ${x.motivo || ""}`
          : `${x.lado === "mas" ? "Más" : "Menos"} ${SEN_CORTO[x.stat]} que su promedio: ${nf1.format(x.base)} → ${nf1.format(x.esperado)}. ${x.motivo || ""}`)}">${x.lado === "mas" ? "▲" : "▼"} ${x.linea != null ? `${x.lado === "mas" ? "+" : "−"}${lineaTxt(x.linea)} ${SEN_CORTO[x.stat]} ${pctCh(x.chance)}` : `${SEN_CORTO[x.stat]} ${pctSen(x.desvio)}`}</span>`).join("")}</div>` : ""}
    ${f.nota ? `<a href="#" class="fav-nota" data-fnota="${f.id}" title="Abrir la nota">${esc(f.nota)}</a>` : ""}
  </div>`;
}

// mini gráfico de los últimos 10 en la stat elegida, con la línea (F-07). Barras en HTML: el texto no se deforma.
function miniBarras(f, k) {
  const st = statDe(k);
  const recientes = f.partidos.concat(f.anteriores || []);
  const ult = recientes.slice(0, 10).reverse();
  // la mediana sale de la temporada; si todavía tiene menos de 10, de los 10 que se ven (G-11, C-05)
  const todos = (f.partidos.length >= 10 ? f.partidos : ult).map((p) => valorStat(st, p)).filter((v) => v != null);
  const vals = ult.map((p) => valorStat(st, p));
  if (!vals.some((v) => v != null)) return '<div class="apagado mini-barras" style="padding:18px 0">Sin datos de esta stat.</div>';
  const cfg = configLinea(f.id, k);
  const linea = STAT_G[k] ? calcularLinea(cfg, todos) : null;
  const max = Math.max(1, ...vals.filter((v) => v != null), linea || 0) * 1.12;
  const h = (v) => `${(v / max) * 100}%`;
  const cols = vals.map((v, i) => {
    const p = ult[i];
    const cl = v == null ? "" : linea == null ? "" : v > linea ? "si" : "no";
    const nueva = i > 0 && ult[i - 1].temporada !== p.temporada;      // G-11: línea entre temporadas
    return `<div class="mb-col${nueva ? " mb-temp" : ""}${p.temporada !== f.partidos[0]?.temporada && f.partidos.length ? " mb-ant" : ""}" title="${esc(p.fecha)} ${p.local ? "vs" : "@"} ${esc(p.rival)}${nueva || i === 0 ? ` (${esc(p.temporada || "")})` : ""}: ${v ?? "sin dato"}">
      <div class="mb-zona"><span style="bottom:${v == null ? 0 : h(v)}; --d:${i * 45}ms">${v == null ? "—" : nf0.format(v)}</span><i class="${cl}" style="height:${v == null ? 0 : h(v)}; --d:${i * 45}ms"></i></div>
      <em>${p.local ? "" : "@"}${esc(p.rival)}</em></div>`;
  }).join("");
  const raya = linea == null ? "" : `<div class="mb-linea" style="bottom:${16 + (linea / max) * 80}px" title="Línea ${nf1.format(linea)}"></div>`;   // zona de barras: 112 - 16 - 16 = 80 px
  const leyenda = linea == null ? "" : `<div class="apagado mini-leyenda">Línea ${nf1.format(linea)}${cfg.modo === "manual" ? " (tuya)" : ""}: superada en ${vals.filter((v) => v != null && v > linea).length} de ${vals.filter((v) => v != null).length}</div>`;
  return `<div class="mini-barras">${raya}${cols}</div>${leyenda}`;
}

// menú de la tarjeta: grupo y stats (F-09, F-10)
function menuFavorito(boton, pid) {
  document.querySelectorAll(".fav-menu").forEach((m) => m.remove());
  const f = S.favs.favoritos.find((x) => x.id === pid);
  const m = document.createElement("div");
  m.className = "fav-menu desplegar-lista";
  m.innerHTML = `<h4>Grupo</h4>
    <select class="control" data-fmgrupo="${pid}"><option value="">Sin grupo</option>
      ${S.favs.grupos.map((g) => `<option ${f.grupo === g ? "selected" : ""}>${esc(g)}</option>`).join("")}<option value="__nuevo">Nuevo grupo…</option></select>
    <h4>Stats de la tarjeta <span class="apagado">(hasta 6)</span></h4>
    <div class="fav-menu-stats">${OPC_TARJETA.map(([k, t]) => `<label><input type="checkbox" data-fmstat="${k}" ${f.stats.includes(k) ? "checked" : ""}>${t}</label>`).join("")}</div>
    <h4>Alertas en vivo</h4>
    <label class="interruptor"><input type="checkbox" data-fmalerta="${pid}" ${(S.prefs.alertas_fav_off || []).includes(pid) ? "" : "checked"}>Avisarme de este jugador (proyección y faltas)</label>
    <div class="fila" style="margin-top:10px"><span class="espacio"></span><button class="boton primario" data-fmlisto="${pid}">Listo</button></div>`;
  boton.closest(".fav-tarjeta").appendChild(m);
}
async function guardarMenu(pid) {
  const m = $(".fav-menu");
  const al = m.querySelector("[data-fmalerta]");          // F-11
  if (al) {
    const off = new Set(S.prefs.alertas_fav_off || []);
    if (al.checked) off.delete(pid); else off.add(pid);
    S.prefs.alertas_fav_off = [...off]; guardarPrefs();
  }
  const stats = [...m.querySelectorAll("[data-fmstat]:checked")].map((x) => x.dataset.fmstat).slice(0, 6);
  let grupo = m.querySelector("[data-fmgrupo]").value;
  if (grupo === "__nuevo") grupo = await pedirNombreGrupo();
  await llamar("cambiar_favorito", pid, { grupo: grupo || null, stats: stats.length ? stats : null });
  m.remove();
  vistaFavoritos($("#contenido"));
}
function pedirNombreGrupo() {
  // ventana propia: los diálogos del navegador frenan la app (no se usa prompt)
  return new Promise((ok) => {
    const fondo = document.createElement("div");
    fondo.className = "dialogo-fondo";
    fondo.innerHTML = `<div class="dialogo desplegar-lista"><h2>Nuevo grupo</h2>
      <input class="control" id="grupo-nombre" maxlength="40" placeholder="Por ejemplo: pivots, a seguir esta semana" style="width:100%">
      <div class="fila" style="margin-top:14px"><span class="espacio"></span><button class="boton" data-d="no">Cancelar</button><button class="boton primario" data-d="si">Crear</button></div></div>`;
    document.body.appendChild(fondo);
    const entrada = fondo.querySelector("input");
    entrada.focus();
    const cerrar = async (si) => {
      const n = entrada.value.trim();
      fondo.remove();
      if (si && n) { const r = await llamar("grupo", "crear", n); S.favs.grupos = r.grupos; S.usuario.grupos = r.grupos; ok(n); } else ok(null);
    };
    fondo.addEventListener("click", (e) => { const b = e.target.closest("[data-d]"); if (b) cerrar(b.dataset.d === "si"); else if (e.target === fondo) cerrar(false); });
    entrada.addEventListener("keydown", (e) => { if (e.key === "Enter") cerrar(true); if (e.key === "Escape") cerrar(false); });
  });
}

document.addEventListener("click", async (e) => {
  if (S.ruta?.s !== "favoritos") return;
  const t = e.target;
  const g = t.closest("[data-fgrupo]");
  if (g) { S.prefs.fav_grupo = g.dataset.fgrupo; guardarPrefs(); pintarFavoritos($("#contenido")); return entrar($(".favoritos-grilla")); }
  const gr = t.closest("[data-fgraf]");
  if (gr) {
    const [pid, k] = gr.dataset.fgraf.split("|");
    const f = S.favs.favoritos.find((x) => x.id === Number(pid));
    f.stat_grafico = k;
    const tarjeta = gr.closest(".fav-tarjeta");
    gr.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("activo", b === gr));
    tarjeta.querySelector(".mini-barras")?.remove();
    tarjeta.querySelector(".mini-leyenda")?.remove();
    gr.parentElement.insertAdjacentHTML("afterend", miniBarras(f, k));
    llamar("cambiar_favorito", Number(pid), { stat_grafico: k }).catch(() => {});
    return;
  }
  const mn = t.closest("[data-fmenu]");
  if (mn) { e.stopPropagation(); return menuFavorito(mn, Number(mn.dataset.fmenu)); }
  const listo = t.closest("[data-fmlisto]");
  if (listo) return guardarMenu(Number(listo.dataset.fmlisto));
  if (!t.closest(".fav-menu")) document.querySelectorAll(".fav-menu").forEach((m) => m.remove());
  const nota = t.closest("[data-fnota]");
  if (nota) { e.preventDefault(); S.prefs.pestana = "notas"; return ir({ s: "jugador", id: Number(nota.dataset.fnota) }); }
  const a = t.closest("[data-faccion]");
  if (a?.dataset.faccion === "nuevo-grupo") {
    const n = await pedirNombreGrupo();
    if (n) pintarFavoritos($("#contenido"));
  } else if (a?.dataset.faccion === "borrar-grupo") {
    const r = await llamar("grupo", "borrar", S.prefs.fav_grupo);
    S.usuario.grupos = r.grupos;
    S.prefs.fav_grupo = "";
    guardarPrefs();
    vistaFavoritos($("#contenido"));
  }
});
document.addEventListener("change", (e) => {
  if (S.ruta?.s !== "favoritos") return;
  if (e.target.id === "fav-orden") { S.prefs.fav_orden = e.target.value; guardarPrefs(); pintarFavoritos($("#contenido")); entrar($(".favoritos-grilla")); }
  const ms = e.target.closest("[data-fmstat]");
  if (ms) {
    const marcadas = document.querySelectorAll(".fav-menu [data-fmstat]:checked");
    if (marcadas.length > 6) { ms.checked = false; aviso("Hasta 6 stats por tarjeta", 1600); }
  }
});

// ---------------------------------------------------------------- buscador por stat (P-03)
const OPC_BUSCAR = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["pra", "PRA"], ["fg3m", "3PM"], ["pr", "P+R"], ["pa", "P+A"], ["ra", "R+A"],
  ["stl", "ROB"], ["blk", "TAP"], ["sb", "ROB+TAP"], ["tov", "PÉR"], ["min", "MIN"], ["oreb", "REB OF"], ["dreb", "REB DEF"],
  ["reb_chances", "Ch. REB"], ["ast_pot", "AST pot."], ["fga", "TCI"], ["fg3a", "3PA"], ["fta", "TLI"], ["pases", "Pases"], ["toques", "Toques"],
  ["usg_pct", "USG%"], ["ts_pct", "TS%"], ["plus_minus", "+/-"]];
const NOMBRE_BUSCAR = Object.fromEntries(OPC_BUSCAR);
const EJEMPLOS_BUSCAR = [
  ["Más de 12 chances de rebote en los últimos 5", { condiciones: [{ stat: "reb_chances", op: ">=", valor: 12 }], ventana: "u5", min_gp: 5 }],
  ["30 o más de PRA en los últimos 10", { condiciones: [{ stat: "pra", op: ">=", valor: 30 }], ventana: "u10", min_gp: 5 }],
  ["3 triples o más por partido", { condiciones: [{ stat: "fg3m", op: ">=", valor: 3 }], ventana: "temp", min_gp: 5 }],
  ["8 o más asistencias potenciales y menos de 3 pérdidas", { condiciones: [{ stat: "ast_pot", op: ">=", valor: 8 }, { stat: "tov", op: "<=", valor: 3 }], ventana: "u10", min_gp: 5 }],
];
const esPct = (k) => k.endsWith("_pct");
function consultaBuscar() {
  S.prefs.buscar_stat = { condiciones: [{ stat: "reb_chances", op: ">=", valor: 12 }], ventana: "u5", min_gp: 5, ...(S.prefs.buscar_stat || {}) };
  return S.prefs.buscar_stat;
}
function panelBuscarStat(panel) {
  const q = consultaBuscar();
  panel.innerHTML = `<div class="tarjeta buscar-stat">
      <div id="bs-condiciones">${q.condiciones.map((c, i) => filaCondicion(c, i)).join("")}</div>
      <div class="fila" style="margin-top:10px">
        <button class="boton" data-bs="sumar" ${q.condiciones.length >= 4 ? "disabled" : ""}>Agregar condición</button>
        <span class="espacio"></span>
        <div class="campo"><span>Promedio de</span><div class="segmentado" id="bs-ventana">
          ${[["temp", "Temporada"], ["u5", "Últ. 5"], ["u10", "Últ. 10"], ["u20", "Últ. 20"]].map(([v, t]) => `<button data-bsv="${v}" class="${q.ventana === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
        <label class="campo"><span>Mín. partidos</span><input type="number" class="control" data-bsmin min="1" max="82" value="${q.min_gp}"></label>
      </div>
      <div class="vs-sugerencias" style="margin-top:14px"><span class="apagado">Ejemplos</span>
        ${EJEMPLOS_BUSCAR.map(([t], i) => `<button class="chip" data-bsej="${i}">${esc(t)}</button>`).join("")}</div>
    </div>
    <div id="bs-resultados" style="margin-top:16px"><div class="vacio">Buscando…</div></div>`;
  correrBusquedaStat();
}
function filaCondicion(c, i) {
  return `<div class="bs-condicion" data-bsi="${i}">
    <span class="apagado bs-y">${i ? "y" : "Jugadores con"}</span>
    <select class="control" data-bsc="stat">${OPC_BUSCAR.map(([k, t]) => `<option value="${k}" ${c.stat === k ? "selected" : ""}>${t}</option>`).join("")}</select>
    <div class="segmentado" data-bsc="op">${[[">=", "o más"], ["<=", "o menos"]].map(([v, t]) => `<button data-v="${v}" class="${c.op === v ? "activo" : ""}">${t}</button>`).join("")}</div>
    <input type="number" class="control" data-bsc="valor" step="${esPct(c.stat) ? 1 : 0.5}" value="${c.valor == null ? "" : esPct(c.stat) ? Math.round(c.valor * 1000) / 10 : c.valor}">
    ${esPct(c.stat) ? '<span class="apagado">%</span>' : ""}
    ${i ? `<button class="boton-quitar" data-bs="quitar" title="Sacar esta condición">×</button>` : ""}</div>`;
}
let bsTimer;
function correrBusquedaStat(espera = 0) {
  guardarPrefs();
  clearTimeout(bsTimer);
  bsTimer = setTimeout(async () => {
    const q = consultaBuscar();
    const pedido = (S.bsPedido = (S.bsPedido || 0) + 1);
    const d = await llamar("buscar_stat", q);
    const caja = $("#bs-resultados");
    if (pedido !== S.bsPedido || !caja) return;
    const vent = { temp: "temporada", u5: "últimos 5", u10: "últimos 10", u20: "últimos 20" }[d.ventana];
    const fmt = (k, v) => (v == null ? SIN : esPct(k) ? pct(v) : k === "plus_minus" ? signo1(v) : f1(v));
    caja.innerHTML = d.filas.length ? `<div class="fila" style="margin-bottom:8px"><span class="apagado">${d.filas.length === 100 ? "Los primeros 100" : d.filas.length} jugador${d.filas.length === 1 ? "" : "es"}, promedio de ${vent} (${d.temporada}). Al lado, el de la temporada.</span><span class="espacio"></span><span class="apagado">${d.ms} ms</span></div>
      <div class="tabla-caja"><table><thead><tr><th class="izq">Jugador</th><th>PJ</th><th>MIN</th>${d.stats.map((k) => `<th>${esc(NOMBRE_BUSCAR[k] || k)}</th>`).join("")}</tr></thead><tbody>
      ${d.filas.map((f) => `<tr class="clic" data-jugador="${f.id}"><td class="izq"><div class="celda-jugador">${avatarJ(f.id, f.nombre, "chico")}<span class="fuerte">${esc(f.nombre)}</span><span class="tricode">${esc(f.eq || "")}</span>${estrella(f.id, "chica")}</div></td>
        <td>${f.gp}${d.ventana !== "temp" ? `<span class="apagado"> / ${f.gp_temp}</span>` : ""}</td><td>${f1(f.min)}</td>
        ${d.stats.map((k, i) => `<td class="${i < d.condiciones.length ? "fuerte" : ""}">${fmt(k, f["v_" + k])}${d.ventana !== "temp" ? ` <span class="apagado">${fmt(k, f["t_" + k])}</span>` : ""}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>`
      : `<div class="vacio">Nadie cumple ${d.condiciones.length > 1 ? "todas las condiciones" : "la condición"} con estos promedios. Probá bajar el valor o el mínimo de partidos.</div>`;
  }, espera);
}
document.addEventListener("click", (e) => {
  const caja = e.target.closest(".buscar-stat");
  if (!caja) return;
  const q = consultaBuscar(), t = e.target;
  const b = t.closest("[data-bs]"), v = t.closest("[data-bsv]"), ej = t.closest("[data-bsej]"), op = t.closest('[data-bsc="op"] button');
  if (b?.dataset.bs === "sumar") { q.condiciones.push({ stat: "pts", op: ">=", valor: 20 }); return panelBuscarStat($("#jugadores-panel")); }
  if (b?.dataset.bs === "quitar") { q.condiciones.splice(Number(b.closest("[data-bsi]").dataset.bsi), 1); return panelBuscarStat($("#jugadores-panel")); }
  if (v) { q.ventana = v.dataset.bsv; v.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("activo", x === v)); return correrBusquedaStat(); }
  if (ej) { S.prefs.buscar_stat = JSON.parse(JSON.stringify(EJEMPLOS_BUSCAR[Number(ej.dataset.bsej)][1])); return panelBuscarStat($("#jugadores-panel")); }
  if (op) {
    q.condiciones[Number(op.closest("[data-bsi]").dataset.bsi)].op = op.dataset.v;
    op.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("activo", x === op));
    return correrBusquedaStat();
  }
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t.closest(".buscar-stat")) return;
  const q = consultaBuscar();
  if (t.dataset.bsmin !== undefined) { q.min_gp = Number(t.value) || 1; return correrBusquedaStat(300); }
  const fila = t.closest("[data-bsi]");
  if (!fila) return;
  const c = q.condiciones[Number(fila.dataset.bsi)];
  if (t.dataset.bsc === "valor") { c.valor = t.value === "" ? null : esPct(c.stat) ? Number(t.value) / 100 : Number(t.value); correrBusquedaStat(300); }
  if (t.dataset.bsc === "stat") { c.stat = t.value; panelBuscarStat($("#jugadores-panel")); }
});
