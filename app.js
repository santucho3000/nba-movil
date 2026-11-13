"use strict";
/* Stats NBA - interfaz (fase 2).
   Navegación (N-01 a N-06), buscador instantáneo (J-01, Z-01 a Z-03),
   perfil de jugador: resumen (J-02), game log (J-03), splits (J-06), filtros (C-01 a C-04). */

// ---------------------------------------------------------------- estado
const S = {
  datos: null, jugadores: [], equipos: [], equipoPorId: {}, jugadorPorId: {},
  prefs: {}, historial: [], ruta: null,
  perfil: null, perfilPedido: 0, sinCompanero: null,
  act: null, cambiosVistos: 0,
};

const ICONOS = {
  inicio: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  vivo: '<circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4"/>',
  jugadores: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  equipos: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  rachas: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 3 2-1-2-1-5 0-7z"/>',
  senales: '<path d="M4 20v-5M9 20v-9M14 20V7M19 20V3"/>',
  favoritos: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  unidades: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const SECCIONES = [
  { id: "inicio", nombre: "Inicio", tecla: "1" },
  { id: "vivo", nombre: "Partidos", tecla: "2" },
  { id: "jugadores", nombre: "Jugadores", tecla: "3" },
  { id: "equipos", nombre: "Equipos", tecla: "4" },
  { id: "rachas", nombre: "Rachas", tecla: "5" },
  { id: "senales", nombre: "Señales", tecla: "6" },
  { id: "favoritos", nombre: "Favoritos", tecla: "7" },
  { id: "unidades", nombre: "Unidades", tecla: "8" },
];
const AJUSTES = { id: "ajustes", nombre: "Ajustes", tecla: "9" };
const SECCION_DE = { jugador: "jugadores", equipo: "equipos", partido: "vivo" };

// ---------------------------------------------------------------- utilidades
const $ = (s, r = document) => r.querySelector(s);
// reinicia una animación corta de entrada (X-01): al navegar, cambiar de pestaña o desplegar
function entrar(el, clase = "entrar") {
  if (!el) return;
  el.classList.remove(clase);
  void el.offsetWidth;
  el.classList.add(clase);
}
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf1 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const SIN = '<span class="sin-dato">—</span>';
const f1 = (v) => (v == null || Number.isNaN(v) ? SIN : nf1.format(v));
const f0 = (v) => (v == null ? SIN : nf0.format(v));
const pct = (v) => (v == null ? SIN : nf1.format(v * 100) + "%");
const signo = (v) => (v == null ? SIN : (v > 0 ? "+" : "") + nf0.format(v));
const signo1 = (v) => (v == null ? SIN : (v > 0 ? "+" : "") + nf1.format(v));
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fechaCorta(iso) {
  if (!iso) return SIN;
  const [y, m, d] = iso.split("-").map(Number);
  const dia = new Date(y, m - 1, d).getDay();
  return `<span class="apagado">${DIAS[dia]}</span> ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
function mmss(min) {
  if (min == null) return SIN;
  const s = Math.round(min * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
// X-03: foto del jugador o logo del equipo, servidos por la app (bajan una vez y quedan guardados).
// Si no hay imagen, quedan las iniciales.
function avatarJ(id, nombre, extra = "") {
  const img = S.datos?.imagenes && id ? `<img src="https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png" alt="" loading="lazy" onload="this.parentElement.classList.add('con-foto')" onerror="this.remove()">` : "";
  return `<div class="avatar${extra ? " " + extra : ""}"><span>${esc(iniciales(nombre))}</span>${img}</div>`;
}
function avatarE(tid, tricode, extra = "") {
  const img = S.datos?.imagenes && tid ? `<img src="https://cdn.nba.com/logos/nba/${tid}/global/D/logo.svg" alt="" loading="lazy" onload="this.parentElement.classList.add('con-logo')" onerror="this.remove()">` : "";
  return `<div class="avatar equipo${extra ? " " + extra : ""}"><span>${esc(tricode || "")}</span>${img}</div>`;
}
function logoMini(tid) {
  return S.datos?.imagenes && tid ? `<img class="logo-mini" src="https://cdn.nba.com/logos/nba/${tid}/global/D/logo.svg" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : "";
}
function iniciales(nombre) {
  return (nombre || "?").split(/[\s-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
function normalizar(t) {
  return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function normalizarCaracteres(t) {     // misma longitud que el original, para resaltar
  return Array.from(t || "").map((c) => {
    const b = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return b.length === 1 && /[a-z0-9]/.test(b) ? b : " ";
  }).join("");
}
let avisoTimer;
function aviso(texto, ms = 4200) {
  const a = $("#aviso");
  a.textContent = texto;
  a.classList.add("visible");
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => a.classList.remove("visible"), ms);
}
async function llamar(metodo, ...args) {
  const r = await window.pywebview.api[metodo](...args);
  if (r && r.error) { aviso("Error: " + r.error, 7000); throw new Error(r.error); }
  return r;
}
let prefsTimer;
function guardarPrefs() {
  clearTimeout(prefsTimer);
  prefsTimer = setTimeout(() => llamar("guardar_prefs", S.prefs).catch(() => {}), 500);
}

// ---------------------------------------------------------------- búsqueda (Z-01, Z-02)
const APODOS = {
  sga: "shai gilgeous alexander", giannis: "giannis antetokounmpo", "greek freak": "giannis antetokounmpo",
  joker: "nikola jokic", kat: "karl anthony towns", ad: "anthony davis", bron: "lebron james",
  "king james": "lebron james", kd: "kevin durant", steph: "stephen curry", "chef curry": "stephen curry",
  cp3: "chris paul", dame: "damian lillard", ant: "anthony edwards", "ant man": "anthony edwards",
  wemby: "victor wembanyama", "the beard": "james harden", spida: "donovan mitchell", jjj: "jaren jackson jr",
  bam: "bam adebayo", book: "devin booker", jb: "jaylen brown", jt: "jayson tatum", hali: "tyrese haliburton",
  pg13: "paul george", jdub: "jalen williams", "j dub": "jalen williams", melo: "carmelo anthony",
};

function prepararBusqueda() {
  for (const j of S.jugadores) {
    j.tok = j.b.split(" ");
    j.ini = j.tok.map((t) => t[0]).join("");
  }
  const porNombre = {};
  for (const j of S.jugadores) porNombre[j.b] = porNombre[j.b] || j;
  S.apodos = {};
  for (const [apodo, nombre] of Object.entries(APODOS)) {
    const j = porNombre[nombre] || S.jugadores.find((x) => x.b.startsWith(nombre));
    if (j) S.apodos[apodo] = j;
  }
  for (const e of S.equipos) e.b = normalizar(`${e.tricode} ${e.ciudad} ${e.nombre}`);
}

function puntaje(j, q, qt) {
  if (j.b === q) return 1000;
  if (j.b.startsWith(q)) return 900;
  if (qt.length === 1) {
    const i = j.tok.findIndex((t) => t.startsWith(q));
    if (i >= 0) return 800 - i * 5;
  } else if (qt.every((t) => j.tok.some((x) => x.startsWith(t)))) return 760;
  if (q.length >= 2 && !q.includes(" ") && j.ini.startsWith(q)) return 600;
  if (j.b.includes(q)) return 400;
  return 0;
}

function buscar(texto, limite = 8) {
  const q = normalizar(texto);
  if (!q) return [];
  const qt = q.split(" ");
  const res = [];
  const apodo = S.apodos[q] || Object.entries(S.apodos).find(([a]) => q.length >= 3 && a.startsWith(q))?.[1];
  if (apodo) res.push({ tipo: "j", item: apodo, p: 2000 });
  for (const j of S.jugadores) {
    if (j === apodo) continue;
    const p = puntaje(j, q, qt);
    if (p) res.push({ tipo: "j", item: j, p: p + Math.min(99, (j.mins || 0) / 40) });
  }
  for (const e of S.equipos) {
    let p = 0;
    if (normalizar(e.tricode) === q) p = 1500;
    else if (e.b.split(" ").some((t) => t.startsWith(q))) p = 850;
    else if (e.b.includes(q)) p = 380;
    if (p) res.push({ tipo: "e", item: e, p });
  }
  res.sort((a, b) => b.p - a.p);
  return res.slice(0, limite);
}

function resaltar(nombre, texto) {
  const q = normalizar(texto);
  if (!q) return esc(nombre);
  const n = normalizarCaracteres(nombre);
  for (const t of q.split(" ").sort((a, b) => b.length - a.length)) {
    let i = n.indexOf(t);
    while (i > 0 && n[i - 1] !== " ") i = n.indexOf(t, i + 1);
    if (i >= 0) return esc(nombre.slice(0, i)) + "<mark>" + esc(nombre.slice(i, i + t.length)) + "</mark>" + esc(nombre.slice(i + t.length));
  }
  return esc(nombre);
}

function htmlResultado(r, texto, sel) {
  if (r.tipo === "e") {
    const e = r.item;
    return `<div class="resultado${sel ? " sel" : ""}" data-tipo="e" data-id="${e.id}">
      ${avatarE(e.id, e.tricode)}
      <div class="nombre">${resaltar(`${e.ciudad} ${e.nombre}`, texto)}</div>
      <div class="detalle">Equipo del ${esc(e.conferencia === "East" ? "Este" : e.conferencia === "West" ? "Oeste" : "")}</div></div>`;
  }
  const j = r.item;
  return `<div class="resultado${sel ? " sel" : ""}" data-tipo="j" data-id="${j.id}">
    ${avatarJ(j.id, j.nombre)}
    <div class="nombre">${resaltar(j.nombre, texto)}</div>
    <div class="detalle">${esc([j.eq, j.pos].filter(Boolean).join(", ")) || "sin equipo"}${j.pj ? "" : ", sin partidos"}</div>${estrella(j.id, "chica")}</div>`;
}

// buscador global (N-02) con teclado (Z-03)
const B = { abierto: false, res: [], sel: 0 };
function abrirBuscador() {
  B.abierto = true;
  $("#buscador-fondo").classList.add("abierto");
  const e = $("#buscador-entrada");
  e.value = "";
  pintarBuscador();
  e.focus();
}
function cerrarBuscador() {
  B.abierto = false;
  $("#buscador-fondo").classList.remove("abierto");
}
function pintarBuscador() {
  const t = $("#buscador-entrada").value;
  B.res = t.trim() ? buscar(t, 9) : recientes().map((j) => ({ tipo: "j", item: j }));
  B.sel = Math.min(B.sel, Math.max(0, B.res.length - 1));
  const caja = $("#buscador-resultados");
  if (!B.res.length) {
    caja.innerHTML = `<div class="vacio">${t.trim() ? "Sin resultados" : "Escribí un nombre, apellido o apodo"}</div>`;
    return;
  }
  caja.innerHTML = (t.trim() ? "" : '<div class="apagado" style="padding:6px 10px;font-size:12px">Vistos recientemente</div>') +
    B.res.map((r, i) => htmlResultado(r, t, i === B.sel)).join("");
}
function abrirResultado(tipo, id) {
  cerrarBuscador();
  if (tipo === "e") ir({ s: "equipo", id: Number(id) });
  else ir({ s: "jugador", id: Number(id) });
}

// ---------------------------------------------------------------- scroll (N-08)
/* Al cambiar una stat, un filtro o una pestaña, la pantalla se vuelve a pintar en el lugar. Mientras se
   redibuja un gráfico o llegan datos ("Cargando…"), la página queda un instante más corta y el navegador
   la mandaba arriba. Acá se recuerda dónde estaba y se sostiene la altura hasta que vuelve el contenido. */
const Scroll = { y: 0, ruta: null, reserva: null, soltar: null };
function esperandoDatos(c) {
  return [...c.querySelectorAll(".vacio")].some((x) => /^(Cargando|Calculando)/.test(x.textContent.trim()));
}
function sostenerScroll() {
  const c = $("#contenido");
  if (!Scroll.y) return;
  let r = Scroll.reserva;
  if (!r) { r = Scroll.reserva = document.createElement("div"); r.className = "reserva-scroll"; r.setAttribute("aria-hidden", "true"); }
  let falta = 0;
  if (esperandoDatos(c)) {
    // dónde termina el contenido real (scrollHeight no baja de la altura de la ventana, por eso se mide así)
    r.style.height = "0px";
    if (c.lastElementChild !== r) c.appendChild(r);
    const fondo = r.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop;
    falta = Math.max(0, Math.ceil(Scroll.y + c.clientHeight - fondo));
    r.style.height = falta + "px";
    clearTimeout(Scroll.soltar);
    Scroll.soltar = setTimeout(() => r.remove(), 8000);       // si los datos nunca llegan, no queda el hueco
  } else if (r.parentNode) r.remove();
  const max = c.scrollHeight - c.clientHeight;
  if (Math.abs(c.scrollTop - Scroll.y) > 1 && Scroll.y <= max + 1) c.scrollTop = Scroll.y;
}
function iniciarScroll() {
  const c = $("#contenido");
  c.addEventListener("scroll", () => { Scroll.y = c.scrollTop; }, { passive: true });
  new MutationObserver(sostenerScroll).observe(c, { childList: true, subtree: true });
}
iniciarScroll();

// ---------------------------------------------------------------- navegación (N-01 a N-05)
function ir(ruta, apilar = true) {
  if (apilar && S.ruta && JSON.stringify(S.ruta) !== JSON.stringify(ruta)) S.historial.push(S.ruta);
  if (S.historial.length > 60) S.historial.shift();
  S.ruta = ruta;
  if (ruta.s === "jugador") {
    if (!S.perfil || S.perfil.ficha.id !== ruta.id) S.sinCompanero = null;
    sumarReciente(ruta.id);
  }
  S.prefs.ultima_ruta = ["jugador", "equipo", "partido"].includes(ruta.s) ? ruta : { s: ruta.s };
  guardarPrefs();
  pintar();
  entrar($("#contenido"));
}
function atras() {
  if (!S.historial.length) return;
  S.ruta = S.historial.pop();
  pintar();
  entrar($("#contenido"));
}
function seccionActual() {
  return SECCION_DE[S.ruta.s] || S.ruta.s;
}
function pintarNav() {
  const item = (s) => `<button class="nav-item${seccionActual() === s.id ? " activo" : ""}" data-sec="${s.id}" title="${s.nombre} (Alt+${s.tecla})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONOS[s.id]}</svg>
      ${s.nombre}<span class="atajo">Alt ${s.tecla}</span></button>`;
  $("#nav").innerHTML = SECCIONES.map(item).join("");
  $("#nav-abajo").innerHTML = item(AJUSTES);
}
function pintarMiga() {
  const r = S.ruta;
  const sec = [...SECCIONES, AJUSTES].find((s) => s.id === seccionActual());
  let miga = `<b>${esc(sec?.nombre || "")}</b>`;
  if (r.s === "jugador") {
    const j = S.jugadorPorId[r.id];
    miga = `${esc(sec.nombre)} <span class="apagado">/</span> <b>${esc(j?.nombre || "Jugador")}</b>`;
  } else if (r.s === "equipo") {
    const e = S.equipoPorId[r.id];
    miga = `${esc(sec.nombre)} <span class="apagado">/</span> <b>${esc(e ? `${e.ciudad} ${e.nombre}` : "Equipo")}</b>`;
  } else if (r.s === "partido") {
    const pp = P.partido && P.partido.game_id === r.id ? P.partido.equipos : null;
    miga = `${esc(sec.nombre)} <span class="apagado">/</span> <b>${pp ? `${esc(pp[0].tricode)} @ ${esc(pp[1].tricode)}` : "Partido"}</b>`;
  }
  $("#miga").innerHTML = miga;
}
function pintar() {
  if (!["jugador", "equipo"].includes(S.ruta.s)) aplicarEquipo(null);
  pintarNav();
  $("#atras").disabled = !S.historial.length;
  const r = S.ruta;
  pintarMiga();
  const c = $("#contenido");
  const clave = `${r.s}:${r.id ?? ""}`;
  if (clave !== Scroll.ruta) { Scroll.ruta = clave; Scroll.y = 0; c.scrollTop = 0; }   // solo arriba si cambió de pantalla
  const vistas = {
    inicio: vistaPortada, jugadores: vistaJugadores, jugador: vistaJugador, ajustes: vistaAjustes,
    vivo: vistaPartidos,
    partido: (c) => vistaPartido(c).then(() => { if (S.ruta.s === "partido") pintarMiga(); }),
    equipos: vistaEquipos,
    equipo: vistaEquipo,
    rachas: vistaRachas,
    senales: vistaSenales,
    favoritos: vistaFavoritos,
    unidades: vistaUnidades,
  };
  (vistas[r.s] || vistaInicio)(c);
}
function proximo(titulo, fase, items) {
  $("#contenido").innerHTML = `<h1 style="margin-bottom:16px">${esc(titulo)}</h1>
    <div class="proximo"><h2>Llega en la fase ${fase}</h2>
    <div>La sección ya tiene su lugar en el menú. Va a mostrar:</div>
    <ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`;
}

// ---------------------------------------------------------------- recientes
function recientes() {
  return (S.prefs.recientes || []).map((id) => S.jugadorPorId[id]).filter(Boolean).slice(0, 8);
}
function sumarReciente(id) {
  const r = (S.prefs.recientes || []).filter((x) => x !== id);
  r.unshift(id);
  S.prefs.recientes = r.slice(0, 12);
}
function chipsRecientes() {
  const r = recientes();
  if (!r.length) return '<span class="apagado">Todavía no abriste ningún jugador.</span>';
  return r.map((j) => `<span class="chip" data-jugador="${j.id}">${esc(j.nombre)}<span class="apagado">${esc(j.eq || "")}</span></span>`).join("");
}

// ---------------------------------------------------------------- vista: inicio
function vistaInicio(c) {
  const u = S.datos?.ultima_actualizacion;
  c.innerHTML = `<h1>Inicio</h1><p class="sub" style="margin:4px 0 18px">Temporada ${esc(S.datos?.temporada_actual || "")}</p>
    <div class="grilla" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
      <div class="tarjeta"><h2>Buscar un jugador</h2>
        <button class="boton-buscar" data-accion="buscar" style="margin:0">Nombre, apellido o apodo <span class="atajo">Ctrl K</span></button>
        <h2 style="margin-top:16px">Vistos recientemente</h2><div class="fila">${chipsRecientes()}</div></div>
      <div class="tarjeta"><h2>Base de datos</h2>${u ? `
        <div class="sub">Última actualización: ${esc(new Date(u.fin).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }))}</div>
        <div class="sub">${S.jugadores.filter((j) => j.pj).length} jugadores con partidos en ${esc((S.datos.temporadas || []).join(", "))}</div>
        ${(u.avisos || []).map((a) => `<div class="apagado" style="margin-top:6px;font-size:12px">Aviso: ${esc(a)}</div>`).join("")}`
        : '<div class="sub">Todavía no hay datos: la primera descarga corre en segundo plano.</div>'}
        <div style="margin-top:12px"><button class="boton" data-accion="ajustes">Ver actualización</button></div></div>
      <div class="tarjeta"><h2>Partidos de hoy</h2><div class="apagado">Con horario argentino, en vivo y favoritos que juegan: llega en la fase 7 (I-01 a I-04).</div></div>
    </div>`;
}

// ---------------------------------------------------------------- vista: jugadores
const STATS_LIDERES = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["fg3m", "3PM"], ["reb_chances", "Ch. REB"], ["ast_pot", "AST pot."]];
async function vistaJugadores(c) {
  const stat = S.prefs.lideres_stat || "pts";
  const pestana = S.prefs.jugadores_pestana || "lideres";
  c.innerHTML = `<h1>Jugadores</h1>
    ${pestana !== "lideres" ? '<div style="height:16px"></div>' : `<div class="tarjeta" style="margin:16px 0">
      <input class="control" id="busqueda-local" placeholder="Buscar jugador…" style="width:100%;font-size:15px;padding:10px 12px" autocomplete="off" spellcheck="false">
      <div id="busqueda-local-res" style="margin-top:6px"></div>
      <h2 style="margin-top:14px">Vistos recientemente</h2><div class="fila">${chipsRecientes()}</div>
    </div>`}
    <div class="pestanas">${[["lideres", "Líderes"], ["buscar", "Buscar por stat"], ["comparar", "Comparar"]].map(([k, t]) =>
      `<button class="pestana${pestana === k ? " activa" : ""}" data-jpestana="${k}">${t}</button>`).join("")}</div>
    <div id="jugadores-panel"></div>`;
  c.querySelectorAll("[data-jpestana]").forEach((b) => b.addEventListener("click", () => {
    S.prefs.jugadores_pestana = b.dataset.jpestana; guardarPrefs(); vistaJugadores(c); entrar($("#jugadores-panel"));
  }));
  const panel = $("#jugadores-panel");
  if (pestana === "comparar") {
    panel.innerHTML = '<div class="vacio">Cargando…</div>';
    panelComparar(panel);
  } else if (pestana === "buscar") {
    panelBuscarStat(panel);
  } else {
    panel.innerHTML = `<div class="fila" style="margin-bottom:10px"><h2 style="margin:0">Líderes de la temporada</h2><span class="espacio"></span>
      <div class="segmentado" id="lideres-stat">${STATS_LIDERES.map(([k, t]) => `<button data-stat="${k}" class="${k === stat ? "activo" : ""}">${t}</button>`).join("")}</div></div>
    <div class="tabla-caja" id="lideres"><div class="vacio">Cargando…</div></div>
`;
    pintarLideres(stat);
  }
  const entrada = $("#busqueda-local");
  if (!entrada) return;
  entrada.focus();
  entrada.addEventListener("input", () => pintarBusquedaLocal(entrada.value));
  entrada.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const p = $("#busqueda-local-res .resultado"); if (p) abrirResultado(p.dataset.tipo, p.dataset.id); }
  });
}
function pintarBusquedaLocal(t) {
  const caja = $("#busqueda-local-res");
  const r = buscar(t, 6);
  caja.innerHTML = r.map((x, i) => htmlResultado(x, t, i === 0)).join("") || (t.trim() ? '<div class="apagado" style="padding:8px">Sin resultados</div>' : "");
}
async function pintarLideres(stat) {
  let filas = [];
  try { filas = S.datos.vacia ? [] : await llamar("lideres", S.datos.temporada_actual, stat); } catch (e) { filas = []; }
  const caja = $("#lideres");
  if (!caja) return;
  if (!filas.length) { caja.innerHTML = '<div class="vacio">Sin datos de la temporada todavía.</div>'; return; }
  caja.innerHTML = `<table><thead><tr><th>#</th><th class="izq">Jugador</th><th class="izq">Eq.</th><th>PJ</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th><th>Ch. REB</th><th>AST pot.</th></tr></thead><tbody>
    ${filas.map((f, i) => `<tr class="clic" data-jugador="${f.id}"><td class="apagado">${i + 1}</td><td class="izq fuerte">${esc(f.nombre)}</td><td class="izq apagado">${esc(f.eq || "")}</td>
      <td>${f.gp}</td><td>${f1(f.min)}</td>${["pts", "reb", "ast", "fg3m", "reb_chances", "ast_pot"].map((k) => `<td class="${k === stat ? "fuerte" : ""}">${f1(f[k])}</td>`).join("")}</tr>`).join("")}
    </tbody></table>`;
}

// ---------------------------------------------------------------- vista: jugador
const PESTANAS = [
  ["resumen", "Resumen"], ["partidos", "Partidos"], ["tracking", "Tracking"], ["tiro", "Tiro"],
  ["splits", "Splits"], ["versus", "Versus"], ["notas", "Notas"],
];
const FILTROS_BASE = { temporadas: null, fase: "Regular Season", ultimos: null, rival: null, lugar: null,
  desde: null, hasta: null, excluir_palizas: false, margen_paliza: 20, min_minutos: 0 };

function filtros() {
  S.prefs.filtros = { ...FILTROS_BASE, ...(S.prefs.filtros || {}) };
  return S.prefs.filtros;
}
function filtrosActivos(f) {
  const a = [];
  if (f.ultimos) a.push(`últimos ${f.ultimos}`);
  if (f.rival) a.push(`vs ${S.equipoPorId[f.rival]?.tricode || "rival"}`);
  if (f.lugar) a.push(f.lugar === "local" ? "de local" : "de visitante");
  if (f.desde || f.hasta) a.push("rango de fechas");
  if (S.sinCompanero) a.push(`sin ${S.jugadorPorId[S.sinCompanero]?.nombre || "compañero"}`);
  if (f.excluir_palizas) a.push(`sin palizas (≥${f.margen_paliza})`);
  if (Number(f.min_minutos) > 0) a.push(`≥${f.min_minutos} min`);
  return a;
}

async function vistaJugador(c) {
  const id = S.ruta.id;
  const j = S.jugadorPorId[id];
  if (!S.perfil || S.perfil.ficha.id !== id) {
    c.innerHTML = `<div class="perfil-cab">${avatarJ(id, j?.nombre)}<div><h1>${esc(j?.nombre || "")}</h1><div class="perfil-datos"><span>Cargando…</span></div></div></div>`;
  }
  await cargarPerfil();
}

let recargaTimer;
function recargarPerfil() {
  clearTimeout(recargaTimer);
  recargaTimer = setTimeout(cargarPerfil, 120);
  guardarPrefs();
}
async function cargarPerfil() {
  if (S.ruta.s !== "jugador") return;
  const pedido = ++S.perfilPedido;
  const f = { ...filtros(), sin_companero: S.sinCompanero };
  const r = await llamar("perfil", S.ruta.id, f);
  if (pedido !== S.perfilPedido || S.ruta.s !== "jugador" || S.ruta.id !== r.ficha.id) return;
  S.perfil = r;
  pintarPerfil();
}

function pintarPerfil() {
  const c = $("#contenido");
  const p = S.perfil, fi = p.ficha, f = filtros();
  const pestana = S.prefs.pestana || "resumen";
  const eq = fi.equipo;
  const temps = fi.temporadas.length ? fi.temporadas : [S.datos.temporada_actual];
  const tempSel = f.temporadas && f.temporadas.length > 1 ? "todas" : (p.temporadas_sel[0] || "");
  const activos = filtrosActivos(f);
  const vistas = [...new Set(p.partidos.map((x) => x.temporada))];   // C-05: los últimos N pueden cruzar temporadas
  const chipTemp = tempSel === "todas" ? "Todas las temporadas" : !f.temporadas && vistas.length > 1 ? `Temporadas ${vistas.join(" y ")}` : `Temporada ${tempSel}`;
  const chips = [chipTemp, NOMBRE_FASE[f.fase] || f.fase,
    ...(f.ultimos ? [] : ["Todos los partidos"]), ...activos];
  c.innerHTML = `
    ${cabeceraJugador(p)}
    ${lineaFiltros(chips, `<span class="apagado">${p.partidos.length} de ${p.total_sin_filtro} partidos</span><span class="apagado" title="Tiempo de la consulta">${p.ms} ms</span>`, !!S.prefs.filtros_visibles)}
    <div class="filtros${S.prefs.filtros_expandido ? " expandido" : ""}${S.prefs.filtros_visibles ? "" : " oculto"}" id="filtros">
      <label class="campo"><span>Temporada</span><select class="control" data-f="temporadas">
        ${temps.map((t) => `<option value="${t}" ${tempSel === t ? "selected" : ""}>${t}</option>`).join("")}
        ${temps.length > 1 ? `<option value="todas" ${tempSel === "todas" ? "selected" : ""}>Todas</option>` : ""}</select></label>
      <label class="campo"><span>Fase</span><select class="control" data-f="fase">
        ${[["Regular Season", "Fase regular"], ["Playoffs", "Playoffs"], ["PlayIn", "Play-in"], ["todas", "Todas"]].map(([v, t]) =>
          `<option value="${v}" ${f.fase === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <div class="campo"><span>Partidos</span><div class="segmentado" data-seg="ultimos">
        ${[[null, "Todos"], [5, "Últ. 5"], [10, "Últ. 10"], [20, "Últ. 20"]].map(([v, t]) =>
          `<button data-v="${v ?? ""}" class="${(f.ultimos || null) === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
      <label class="campo"><span>Rival</span><select class="control" data-f="rival"><option value="">Todos</option>
        ${S.equipos.map((e) => `<option value="${e.id}" ${Number(f.rival) === e.id ? "selected" : ""}>${esc(e.tricode)}  ${esc(e.nombre)}</option>`).join("")}</select></label>
      <div class="campo"><span>Condición</span><div class="segmentado" data-seg="lugar">
        ${[[null, "Todos"], ["local", "Local"], ["visita", "Visitante"]].map(([v, t]) =>
          `<button data-v="${v ?? ""}" class="${(f.lugar || null) === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
      <span class="espacio"></span>
      <button class="boton" data-accion="mas-filtros">${S.prefs.filtros_expandido ? "Menos filtros" : "Más filtros"}</button>
      <div class="filtros-mas">
        <label class="campo"><span>Desde</span><input type="date" class="control" data-f="desde" value="${f.desde || ""}"></label>
        <label class="campo"><span>Hasta</span><input type="date" class="control" data-f="hasta" value="${f.hasta || ""}"></label>
        <label class="campo"><span>Sin compañero</span><select class="control" data-f="sin_companero"><option value="">—</option>
          ${p.companeros.map((x) => `<option value="${x.id}" ${S.sinCompanero === x.id ? "selected" : ""}>${esc(x.nombre)} (${x.pj} PJ juntos)</option>`).join("")}</select></label>
        <div class="campo"><span>Palizas</span><div class="fila">
          <label class="interruptor"><input type="checkbox" data-f="excluir_palizas" ${f.excluir_palizas ? "checked" : ""}>Excluir margen ≥</label>
          <input type="number" class="control" data-f="margen_paliza" min="5" max="60" value="${f.margen_paliza}"></div></div>
        <label class="campo"><span>Mín. minutos</span><input type="number" class="control" data-f="min_minutos" min="0" max="48" value="${f.min_minutos || 0}"></label>
        <span class="espacio"></span>
        <button class="boton" data-accion="limpiar-filtros">Restablecer filtros</button>
      </div>
    </div>
    <div class="pestanas">${PESTANAS.map(([k, t, fase]) => `<button class="pestana${pestana === k ? " activa" : ""}" data-pestana="${k}">${t}${k === "notas" && S.usuario.notas.includes(fi.id) ? '<i class="punto-nota" title="Tiene nota"></i>' : ""}${fase ? `<span class="proximamente">F${fase}</span>` : ""}</button>`).join("")}</div>
    <div id="panel"></div>`;
  aplicarEquipo(eq?.team_id);
  contarNumeros(c.querySelector(".cabecera"));
  const panel = $("#panel");
  if (!p.partidos.length) {
    panel.innerHTML = `<div class="vacio">No hay partidos con estos filtros.${activos.length ? ' <a href="#" data-accion="limpiar-filtros">Restablecer filtros</a>' : ""}</div>`;
    return;
  }
  ({ resumen: panelResumen, partidos: panelPartidos, splits: panelSplits, tracking: panelTracking, tiro: panelTiro, versus: panelVersus, notas: panelNotas }[pestana] || panelProximo)(panel, pestana);
  contarKpis(panel);
}

function panelProximo(panel, pestana) {
  const textos = {
    tracking: [3, ["Rebotes y asistencias potenciales con tasas de conversión (J-04)", "Gráfico con barra rellena (logrado) y contorno (potencial) (G-02, G-07)"]],
    tiro: [3, ["Shot chart con cada tiro de la temporada (J-05)", "Porcentajes por zona"]],
    versus: [5, ["Stats cuando también jugó X (V-01)", "Matchup directo: quién lo defendió y a quién defendió (V-02)"]],
    notas: [6, ["Notas propias por jugador (P-02)"]],
  };
  const [fase, items] = textos[pestana];
  panel.innerHTML = `<div class="proximo"><h2>Llega en la fase ${fase}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    <p class="apagado" style="margin-top:10px">Los datos ya están en la base: ${S.perfil.partidos.filter((x) => x.reb_chances != null).length} partidos con tracking.</p></div>`;
}

// ---- resumen (J-02)
const FILAS_RESUMEN = [
  ["min", "MIN", f1], ["pts", "PTS", f1], ["reb", "REB", f1], ["oreb", "REB OF", f1], ["dreb", "REB DEF", f1],
  ["ast", "AST", f1], ["pra", "PTS+REB+AST", f1], ["fg3m", "3PM", f1], ["stl", "ROB", f1], ["blk", "TAP", f1],
  ["tov", "PÉR", f1], ["pf", "FAL", f1], ["fg_pct", "TC%", pct], ["fg3_pct", "3P%", pct], ["ft_pct", "TL%", pct],
  ["ts_pct", "TS%", pct], ["usg_pct", "USG%", pct], ["plus_minus", "+/-", signo1],
  ["reb_chances", "Chances de REB", f1], ["reb_conv", "% conv. REB", pct], ["ast_pot", "AST potenciales", f1], ["ast_conv", "% conv. AST", pct],
];
function panelResumen(panel) {
  const r = S.perfil.resumen;
  const kp = (k, t, fmt) => {
    const v = r.total[k], u5 = r.u5[k];
    let d = "";
    if (v != null && u5 != null && r.total.pj > 5) {
      const dif = u5 - v;
      d = `<div class="d ${dif > 0.05 ? "mas" : dif < -0.05 ? "menos" : "apagado"}">Últ. 5: ${fmt(u5)}</div>`;
    }
    const rg = S.perfil.rangos?.[k];
    const rango = rg ? `<div class="d apagado" title="La mitad central de sus partidos: en uno de cada cuatro hizo menos de ${nf1.format(rg[0])} y en uno de cada cuatro más de ${nf1.format(rg[1])}">Rango ${fmtRango(rg)}</div>` : "";
    return `<div class="kpi"><div class="k">${t} ${pildoraPercentil(S.perfil, k, k === "tov")}</div><div class="v">${fmt(v)}</div>${d}${rango}</div>`;
  };
  panel.innerHTML = `${bloqueProximoRival()}<div id="senales-jugador"></div><div class="kpis">${kp("pts", "PTS", f1)}${kp("reb", "REB", f1)}${kp("ast", "AST", f1)}${kp("pra", "PRA", f1)}${kp("fg3m", "3PM", f1)}
      ${kp("min", "MIN", f1)}${kp("ts_pct", "TS%", pct)}${kp("reb_chances", "Ch. REB", f1)}${kp("ast_pot", "AST pot.", f1)}</div>
    <div class="tabla-caja" style="max-width:760px"><table><thead><tr><th>Promedios</th>
      ${[["total", "Período"], ["u5", "Últ. 5"], ["u10", "Últ. 10"], ["u20", "Últ. 20"]].map(([k, t]) => `<th>${t}<div class="apagado" style="font-weight:400">${r[k].pj} PJ</div></th>`).join("")}
      </tr></thead><tbody>
      ${FILAS_RESUMEN.map(([k, t, fmt]) => `<tr><td class="izq">${t}</td>${["total", "u5", "u10", "u20"].map((v, i) =>
        `<td class="${i === 0 ? "fuerte" : ""}">${r[v].pj ? fmt(r[v][k]) : SIN}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>
    <p class="apagado" style="margin-top:10px">Los porcentajes salen de los totales del período, no del promedio de cada partido. Las stats de tracking promedian solo los partidos que tienen el dato.</p>`;
  const cs = panel.querySelector("#senales-jugador");
  if (cs) senalesDelJugador(cs, S.perfil.ficha.id);     // M-06
}

// ---- partidos / game log (J-03)
const COLUMNAS = [
  { id: "fecha", t: "Fecha", g: "Partido", izq: 1, v: (p) => p.fecha, f: (p) => fechaCorta(p.fecha), fija: 1 },
  { id: "rival", t: "Rival", g: "Partido", izq: 1, v: (p) => p.rival, f: (p) => `<span class="apagado">${p.local ? "vs" : "@"}</span> ${esc(p.rival)}` },
  { id: "res", t: "Res.", g: "Partido", izq: 1, v: (p) => p.margen, f: (p) => `<span class="${p.resultado === "W" ? "gano" : "perdio"}">${p.resultado === "W" ? "G" : "P"}</span> ${p.pts_eq}-${p.pts_riv}` },
  { id: "titular", t: "Tit.", g: "Partido", v: (p) => p.titular, f: (p) => (p.titular == null ? SIN : p.titular ? "Sí" : "No") },
  { id: "descanso", t: "Desc.", g: "Partido", v: (p) => p.descanso, f: (p) => (p.descanso == null ? SIN : p.descanso <= 0 ? '<span class="etiqueta">B2B</span>' : `${p.descanso} d`) },
  { id: "margen", t: "Margen", g: "Partido", v: (p) => p.margen, f: (p) => signo(p.margen) },
  { id: "min", t: "MIN", g: "Básicas", v: (p) => p.min, f: (p) => mmss(p.min) },
  { id: "pts", t: "PTS", g: "Básicas", fuerte: 1 }, { id: "reb", t: "REB", g: "Básicas" },
  { id: "oreb", t: "REB OF", g: "Básicas" }, { id: "dreb", t: "REB DEF", g: "Básicas" }, { id: "ast", t: "AST", g: "Básicas" },
  { id: "stl", t: "ROB", g: "Básicas" }, { id: "blk", t: "TAP", g: "Básicas" }, { id: "tov", t: "PÉR", g: "Básicas" },
  { id: "pf", t: "FAL", g: "Básicas" },
  { id: "pra", t: "PRA", g: "Básicas", v: (p) => p.pts + p.reb + p.ast },
  { id: "plus_minus", t: "+/-", g: "Básicas", f: (p) => signo(p.plus_minus) },
  { id: "fg", t: "TC", g: "Tiro", v: (p) => p.fgm, f: (p) => `${p.fgm}-${p.fga}` },
  { id: "fg_pct", t: "TC%", g: "Tiro", v: (p) => (p.fga ? p.fgm / p.fga : null), f: (p) => pct(p.fga ? p.fgm / p.fga : null) },
  { id: "fg3", t: "3P", g: "Tiro", v: (p) => p.fg3m, f: (p) => `${p.fg3m}-${p.fg3a}` },
  { id: "fg3_pct", t: "3P%", g: "Tiro", v: (p) => (p.fg3a ? p.fg3m / p.fg3a : null), f: (p) => pct(p.fg3a ? p.fg3m / p.fg3a : null) },
  { id: "ft", t: "TL", g: "Tiro", v: (p) => p.ftm, f: (p) => `${p.ftm}-${p.fta}` },
  { id: "ft_pct", t: "TL%", g: "Tiro", v: (p) => (p.fta ? p.ftm / p.fta : null), f: (p) => pct(p.fta ? p.ftm / p.fta : null) },
  { id: "ts_pct", t: "TS%", g: "Avanzadas", f: (p) => pct(p.ts_pct) }, { id: "efg_pct", t: "eFG%", g: "Avanzadas", f: (p) => pct(p.efg_pct) },
  { id: "usg_pct", t: "USG%", g: "Avanzadas", f: (p) => pct(p.usg_pct) },
  { id: "off_rating", t: "ORtg", g: "Avanzadas", f: (p) => f1(p.off_rating) }, { id: "def_rating", t: "DRtg", g: "Avanzadas", f: (p) => f1(p.def_rating) },
  { id: "pie", t: "PIE", g: "Avanzadas", f: (p) => pct(p.pie) },
  { id: "reb_chances", t: "Ch. REB", g: "Tracking" }, { id: "oreb_chances", t: "Ch. REB OF", g: "Tracking" },
  { id: "dreb_chances", t: "Ch. REB DEF", g: "Tracking" }, { id: "ast_pot", t: "AST pot.", g: "Tracking" },
  { id: "ast_sec", t: "AST sec.", g: "Tracking" }, { id: "ast_tl", t: "AST TL", g: "Tracking" },
  { id: "pases", t: "Pases", g: "Tracking" }, { id: "toques", t: "Toques", g: "Tracking" }, { id: "drives", t: "Drives", g: "Tracking" },
];
const COLUMNAS_DEFECTO = ["fecha", "rival", "res", "min", "pts", "reb", "ast", "stl", "blk", "tov", "fg", "fg_pct", "fg3", "fg3_pct", "ft", "plus_minus", "reb_chances", "ast_pot"];
const valor = (col, p) => (col.v ? col.v(p) : p[col.id]);

function panelPartidos(panel) {
  const vista = S.prefs.vista_partidos || "tabla";
  const conmutador = `<div class="segmentado" title="Tabla o gráficos">
      <button data-vista="tabla" class="${vista === "tabla" ? "activo" : ""}">Tabla</button>
      <button data-vista="graficos" class="${vista === "graficos" ? "activo" : ""}">Gráficos</button></div>`;
  if (vista === "graficos") {
    panel.innerHTML = `<div class="fila" style="margin-bottom:12px">${conmutador}<span class="espacio"></span>
      <span class="apagado">Pasá el mouse por una barra para ver el partido completo</span></div><div class="grafico" id="graf-partidos"></div>`;
    graficoPartidos($("#graf-partidos"), { clave: "partidos", stat: "pts" });
    return;
  }
  const visibles = new Set(S.prefs.columnas || COLUMNAS_DEFECTO);
  const cols = COLUMNAS.filter((c) => c.fija || visibles.has(c.id));
  const orden = S.prefs.orden || { col: "fecha", dir: -1 };
  const colOrden = COLUMNAS.find((c) => c.id === orden.col) || COLUMNAS[0];
  const filas = [...S.perfil.partidos].sort((a, b) => {
    const x = valor(colOrden, a), y = valor(colOrden, b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x < y ? -1 : x > y ? 1 : 0) * orden.dir;
  });
  const grupos = [...new Set(COLUMNAS.filter((c) => !c.fija).map((c) => c.g))];
  panel.innerHTML = `<div class="fila" style="margin-bottom:10px">
      ${conmutador}
      <span class="espacio"></span><span class="apagado">Clic en un encabezado para ordenar</span>
      <div class="selector-columnas"><button class="boton" data-accion="columnas">Columnas (${cols.length})</button>
        <div class="columnas-menu" id="columnas-menu">
          ${grupos.map((g) => `<h4>${g}</h4>` + COLUMNAS.filter((c) => c.g === g && !c.fija).map((c) =>
            `<label><input type="checkbox" data-col="${c.id}" ${visibles.has(c.id) ? "checked" : ""}>${c.t}</label>`).join("")).join("")}
          <h4></h4><a href="#" data-accion="columnas-defecto" style="grid-column:1/-1">Volver a las columnas de siempre</a>
        </div></div></div>
    <div class="tabla-caja"><table><thead><tr>
      ${cols.map((c) => `<th class="ordenable${c.izq ? " izq" : ""}${c.id === orden.col ? " orden" : ""}" data-orden="${c.id}">${c.t}${c.id === orden.col ? (orden.dir < 0 ? " ↓" : " ↑") : ""}</th>`).join("")}
    </tr></thead><tbody>
      ${filasPorTemporada(filas, cols.length, orden.col === "fecha", (p, cl) => `<tr${cl} data-partido="${p.game_id}" title="Ver el partido">${cols.map((c) => `<td class="${c.izq ? "izq" : ""}${c.fuerte ? " fuerte" : ""}">${c.f ? c.f(p) : f0(valor(c, p))}</td>`).join("")}</tr>`)}
    </tbody></table></div>`;
}

/* G-11: filas de una tabla partido por partido con varias temporadas. Ordenada por fecha, una fila
   con el nombre separa cada temporada; con otro orden, las de temporadas anteriores van marcadas. */
function filasPorTemporada(filas, ncols, porFecha, fila) {
  const temps = [...new Set(filas.map((p) => p.temporada).filter(Boolean))];
  if (temps.length < 2) return filas.map((p) => fila(p, "")).join("");
  const actual = temps.slice().sort().pop();
  let previa = null, html = "";
  for (const p of filas) {
    if (porFecha && p.temporada !== previa) html += `<tr class="sep-temp"><td colspan="${ncols}">Temporada ${esc(p.temporada)}</td></tr>`;
    previa = p.temporada;
    html += fila(p, p.temporada !== actual ? ` class="temp-ant" title="Temporada ${esc(p.temporada)}"` : "");
  }
  return html;
}

// ---- splits (J-06)
const COLS_SPLIT = [["pj", "PJ", f0], ["min", "MIN", f1], ["pts", "PTS", f1], ["reb", "REB", f1], ["ast", "AST", f1], ["pra", "PRA", f1],
  ["fg3m", "3PM", f1], ["fg_pct", "TC%", pct], ["reb_chances", "Ch. REB", f1], ["ast_pot", "AST pot.", f1]];
function panelSplits(panel) {
  const sp = S.perfil.splits, tot = S.perfil.resumen.total;
  const tabla = (titulo, filas, ayuda) => `<div class="tarjeta" style="padding:12px 0 4px"><h2 style="padding:0 14px">${titulo}${ayuda ? ` <span class="apagado" style="font-weight:400">${ayuda}</span>` : ""}</h2>
    <div class="caja-split" style="max-height:${filas.length > 8 ? "340px" : "none"};overflow-y:auto"><table><thead><tr><th>${titulo === "Por rival" ? "Rival" : ""}</th>${COLS_SPLIT.map(([, t]) => `<th>${t}</th>`).join("")}</tr></thead><tbody>
    ${filas.map((f) => `<tr><td class="izq fuerte">${esc(f.grupo)}</td>${COLS_SPLIT.map(([k, , fmt]) => {
      let cl = "";
      if (k !== "pj" && k !== "fg_pct" && f[k] != null && tot[k]) {
        const r = f[k] / tot[k];
        cl = r >= 1.08 ? "mas" : r <= 0.92 ? "menos" : "";
      }
      return `<td class="${cl}">${fmt(f[k])}</td>`;
    }).join("")}</tr>`).join("") || `<tr><td class="izq apagado" colspan="${COLS_SPLIT.length + 1}">Sin partidos</td></tr>`}
    </tbody></table></div></div>`;
  const cu = S.perfil.cuartos;
  const COLS_CUARTO = [["min", "MIN", f1], ["pts", "PTS", f1], ["reb", "REB", f1], ["ast", "AST", f1], ["fg3m", "3PM", f1],
    ["fga", "TCI", f1], ["fg_pct", "TC%", pct], ["tov", "PÉR", f1], ["pf", "FAL", f1]];
  const tablaCuartos = (titulo, filas, nota) => `<div class="tarjeta" style="padding:12px 0 4px"><h2 style="padding:0 14px">${titulo}${nota ? ` <span class="apagado" style="font-weight:400">${nota}</span>` : ""}</h2>
    <div class="caja-split"><table><thead><tr><th></th>${COLS_CUARTO.map(([, t]) => `<th>${t}</th>`).join("")}</tr></thead><tbody>
    ${filas.map((f) => `<tr><td class="izq fuerte">${esc(f.grupo)}</td>${COLS_CUARTO.map(([k, , fmt]) => `<td>${fmt(f[k])}</td>`).join("")}</tr>`).join("")}
    </tbody></table></div></div>`;
  const cl = cu.clutch;
  const clutch = `<div class="tarjeta"><h2>Clutch <span class="apagado" style="font-weight:400">últimos 5 minutos con diferencia de 5 o menos</span></h2>
    ${cl ? `<div class="kpis kpis-8">
      <div class="kpi"><div class="k">Partidos</div><div class="v">${cl.partidos}<span class="apagado" style="font-size:13px"> de ${cl.de}</span></div></div>
      <div class="kpi"><div class="k">PTS</div><div class="v">${cl.pts}</div><div class="d apagado">${f1(cl.pts_pj)} por partido</div></div>
      <div class="kpi"><div class="k">TC</div><div class="v">${cl.fgm}/${cl.fga}</div><div class="d apagado">${pct(cl.fg_pct)}</div></div>
      <div class="kpi"><div class="k">3P</div><div class="v">${cl.fg3m}/${cl.fg3a}</div></div>
      <div class="kpi"><div class="k">TL</div><div class="v">${cl.ftm}/${cl.fta}</div></div>
      <div class="kpi"><div class="k">REB / AST</div><div class="v">${cl.reb} / ${cl.ast}</div></div>
      <div class="kpi"><div class="k">PÉR</div><div class="v">${cl.tov}</div></div>
      <div class="kpi"><div class="k">+/-</div><div class="v">${signo(cl.plus_minus)}</div></div></div>`
      : '<div class="apagado">Ningún partido del período tuvo minutos clutch para este jugador.</div>'}</div>`;
  panel.innerHTML = `<div class="grilla" style="margin-bottom:14px">
      <div class="splits">${tablaCuartos("Por cuarto", cu.cuartos, "promedio por partido, sin prórrogas")}${tablaCuartos("Por mitad", cu.mitades)}</div>
      ${clutch}</div>
    <p class="apagado" style="margin:0 0 12px">En verde, 8% o más por encima del promedio del período; en rojo, 8% o más por debajo.</p>
    <div class="splits">
      ${tabla("Local / visitante", sp.lugar)}
      ${tabla("Descanso", sp.descanso, "días sin jugar del equipo")}
      ${tabla("Titular / suplente", sp.rol)}
      ${tabla("Resultado", sp.resultado)}
      ${tabla("Por mes", sp.mes)}
      ${tabla("Por rival", sp.rival)}
    </div>`;
}

// ---- tracking (J-04, J-08, J-09)
function panelTracking(panel) {
  const p = S.perfil.partidos, r = S.perfil.resumen.total, h = S.perfil.hustle, pt = S.perfil.playtypes;
  const suma = (k) => p.reduce((a, x) => a + (x[k] || 0), 0);
  const conCont = p.filter((x) => x.reb_contest != null);
  const pctCont = conCont.length ? conCont.reduce((a, x) => a + x.reb_contest, 0) / Math.max(1, conCont.reduce((a, x) => a + x.reb, 0)) : null;
  const kp = (k, t, v, d) => `<div class="kpi"><div class="k">${t}</div><div class="v">${v}</div>${d ? `<div class="d apagado">${d}</div>` : ""}</div>`;
  const conTrack = p.filter((x) => x.reb_chances != null).length;
  const conPot = p.filter((x) => x.ast_pot != null).length;
  panel.innerHTML = `
    <div class="kpis kpis-6">
      ${kp("chreb", "Ch. REB", f1(r.reb_chances), `${f1(r.oreb_chances)} of., ${f1(r.dreb_chances)} def.`)}
      ${kp("reb", "REB", f1(r.reb), `${f1(r.oreb)} of., ${f1(r.dreb)} def.`)}
      ${kp("conv", "% conv. REB", pct(r.reb_conv), "rebotes / chances")}
      ${kp("cont", "% REB contestados", pct(pctCont), conCont.length < p.length ? `${conCont.length} de ${p.length} PJ con dato` : "")}
      ${kp("pot", "AST pot.", f1(r.ast_pot), conPot < p.length ? `${conPot} de ${p.length} PJ con dato` : "")}
      ${kp("conva", "% conv. AST", pct(r.ast_conv), "asistencias / potenciales")}
      ${kp("ast", "AST", f1(r.ast), `${f1(r.ast_sec)} sec., ${f1(r.ast_tl)} de TL`)}
      ${kp("pases", "Pases", f1(r.pases), "")}
      ${kp("toques", "Toques", f1(r.toques), "")}
      ${kp("drives", "Drives", f1(r.drives), "")}
      ${kp("cs", "Catch & shoot", conTrack ? `${suma("cs_fgm")}/${suma("cs_fga")}` : SIN, "convertidos / intentados")}
      ${kp("pu", "Pull-up", conTrack ? `${suma("pu_fgm")}/${suma("pu_fga")}` : SIN, "convertidos / intentados")}
    </div>
    <div class="grafico" id="graf-tracking" style="margin-bottom:16px"></div>
    <div class="splits">
      <div class="tarjeta"><h2>Hustle <span class="apagado" style="font-weight:400">por partido</span></h2>
        ${h.con_datos ? `<div class="kpis kpis-chico">
          ${[["desvios", "Desvíos"], ["contestados", "Tiros contestados"], ["box_outs", "Box outs"], ["sueltas", "Pelotas sueltas"],
             ["pantallas_ast", "Bloqueos con gol"], ["cargas", "Cargas recibidas"]].map(([k, t]) => kp(k, t, f1(h[k]),
             k === "contestados" ? `${f1(h.contestados2)} de 2, ${f1(h.contestados3)} de 3` : k === "pantallas_ast" ? `${f1(h.pantallas_ast_pts)} pts generados` : "")).join("")}</div>
          ${h.con_datos < h.de ? `<p class="apagado" style="margin:8px 0 0">La NBA no publicó hustle de este jugador en ${h.de - h.con_datos} de ${h.de} partidos: no se cuentan como cero.</p>` : ""}`
          : '<div class="apagado">Sin datos de hustle en estos partidos.</div>'}</div>
      <div class="tarjeta" style="padding:12px 0 4px"><h2 style="padding:0 14px">Play types <span class="apagado" style="font-weight:400">temporada ${esc(S.perfil.temporadas_sel[0])}, por partido</span></h2>
        ${pt.length ? `<div class="caja-split"><table><thead><tr><th>Tipo de jugada</th><th>Pos.</th><th>Frec.</th><th>PTS</th><th>Pts/pos.</th><th>Percentil</th></tr></thead><tbody>
          ${pt.map((x) => `<tr><td class="izq fuerte">${esc(x.nombre)}</td><td>${f1(x.poss)}</td><td>${pct(x.poss_pct)}</td><td>${f1(x.pts)}</td>
            <td>${x.ppp == null ? SIN : x.ppp.toFixed(2).replace(".", ",")}</td>
            <td><span class="percentil" style="--p:${Math.round((x.percentil || 0) * 100)}%">${Math.round((x.percentil || 0) * 100)}</span></td></tr>`).join("")}
          </tbody></table></div>` : ""}
        <p class="apagado" style="margin:8px 14px">${pt.length ? "Solo totales de temporada: no cambian con los filtros. " : "Sin play types para este jugador. "}La NBA solo publica los tipos de jugada en los que el jugador tiene un volumen mínimo.</p></div>
    </div>`;
  graficoPartidos($("#graf-tracking"), { clave: "tracking", stats: ["reb", "ast", "oreb", "dreb", "fg3m", "fgm"], stat: "reb", pot: true });
}

// ---- tiro (J-05)
async function panelTiro(panel) {
  panel.innerHTML = '<div class="vacio">Cargando tiros…</div>';
  const pedido = S.perfilPedido;
  const d = await llamar("tiros", S.ruta.id, { ...filtros(), sin_companero: S.sinCompanero });
  if (pedido !== S.perfilPedido || (S.prefs.pestana || "resumen") !== "tiro" || !$("#panel")) return;
  if (!d.total) { panel.innerHTML = '<div class="vacio">No hay tiros registrados en estos partidos.</div>'; return; }
  const filtro = S.prefs.filtro_tiros || "todos";
  const m = d.tiros.filter((t) => t[2]).length;
  panel.innerHTML = `<div class="tiro-grilla">
      <div class="tarjeta"><div class="fila" style="margin-bottom:10px"><h2 style="margin:0">Mapa de tiros</h2><span class="espacio"></span>
        <div class="segmentado" id="filtro-tiros">${[["todos", "Todos"], ["convertidos", "Convertidos"], ["fallados", "Fallados"]].map(([k, t]) =>
          `<button data-ft="${k}" class="${filtro === k ? "activo" : ""}">${t}</button>`).join("")}</div></div>
        <div id="cancha"></div>
        <div class="graf-leyenda"><span><i style="background:${COLOR.verde};border-radius:50%"></i>Convertido</span><span><b style="color:${COLOR.rojo}">✕</b> Fallado</span>
          <span class="apagado">${d.total} tiros en ${d.partidos_con_tiros} partidos</span></div></div>
      <div class="tarjeta" style="padding:12px 0 4px;align-self:start"><h2 style="padding:0 14px">Por zona</h2>
        <table><thead><tr><th>Zona</th><th>TC</th><th>TC%</th><th>Frecuencia</th></tr></thead><tbody>
        ${d.zonas.map((z) => `<tr><td class="izq fuerte">${esc(z.nombre)}</td><td>${z.fgm}/${z.fga}</td><td>${pct(z.pct)}</td>
          <td><span class="barrita"><i style="width:${Math.round(z.frecuencia * 100)}%"></i></span>${pct(z.frecuencia)}</td></tr>`).join("")}
        <tr><td class="izq fuerte">Total</td><td>${m}/${d.total}</td><td class="fuerte">${pct(m / d.total)}</td><td></td></tr>
        </tbody></table></div></div>`;
  const pintarMapa = () => mapaTiros($("#cancha"), d, S.prefs.filtro_tiros || "todos");
  pintarMapa();
  $("#filtro-tiros").onclick = (e) => {
    const b = e.target.closest("[data-ft]");
    if (!b) return;
    S.prefs.filtro_tiros = b.dataset.ft; guardarPrefs();
    document.querySelectorAll("#filtro-tiros button").forEach((x) => x.classList.toggle("activo", x === b));
    pintarMapa();
  };
}

// ---------------------------------------------------------------- vista: ajustes
function vistaAjustes(c) {
  const a = S.act || {};
  const u = a.resumen || S.datos?.ultima_actualizacion;
  c.innerHTML = `<h1 style="margin-bottom:16px">Ajustes</h1>
    <div class="grilla" style="grid-template-columns:repeat(auto-fill,minmax(360px,1fr))">
      <div class="tarjeta"><h2>Actualización de datos</h2>
        <div class="sub" id="ajustes-estado">${a.corriendo ? `En curso: ${esc(a.etapa)} ${a.total > 1 ? `${a.hecho + 1}/${a.total}` : ""}` :
          u ? `Última: ${esc(new Date(u.fin).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }))}. ${u.partidos_nuevos} partidos nuevos, ${u.pedidos} pedidos, ${u.segundos} s` : "Todavía no se actualizó"}</div>
        ${u && u.cortado ? `<div style="color:var(--ambar);margin-top:6px">Se cortó: ${esc(u.cortado)}</div>` : ""}
        ${u ? Object.entries(u.errores || {}).map(([b, e]) => `<div style="color:var(--ambar);margin-top:6px">Falló ${esc(b)}: ${esc(e)}</div>`).join("") : ""}
        ${u ? (u.avisos || []).map((x) => `<div class="apagado" style="margin-top:6px">Aviso: ${esc(x)}</div>`).join("") : ""}
        <div class="fila" style="margin-top:14px">
          <button class="boton primario" data-accion="actualizar" ${a.corriendo ? "disabled" : ""}>Actualizar ahora</button>
          ${a.corriendo ? '<button class="boton" data-accion="cancelar">Cancelar</button>' : ""}</div>
        <p class="apagado" style="margin-top:12px">Se actualiza sola cada vez que abrís la app. Solo baja lo nuevo; lo que la NBA todavía no publicó se vuelve a pedir la próxima vez.</p></div>
      <div class="tarjeta"><h2>Temporadas</h2>
        <div class="sub">En la base: ${esc((S.datos?.temporadas || []).join(", ") || "ninguna")}</div>
        ${tarjetaTemporadas()}</div>
      <div class="tarjeta" id="ajustes-vivo"><h2>En vivo y alertas</h2><div class="sub">Cargando…</div></div>
      <div class="tarjeta" id="copia-claude"><h2>Copia para Claude</h2><div class="sub">Buscando la última copia…</div></div>
      <div class="tarjeta"><h2>Atajos de teclado</h2><table class="tabla-simple"><tbody>
        ${[["Ctrl K", "Buscar jugador o equipo"], ["Alt 1 … 8", "Ir a cada sección"], ["Alt 9", "Ajustes"], ["Alt ←  o  botón atrás del mouse", "Volver"],
          ["↑ ↓ y Enter", "Elegir en el buscador"], ["Esc", "Cerrar el buscador o el glosario"], ["?", "Abrir el glosario de abreviaturas"]].map(([k, t]) => `<tr><td class="izq"><span class="atajo">${k}</span></td><td class="izq sub">${t}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="tarjeta"><h2>Acerca de</h2><div class="sub">Versión ${esc(S.datos?.version || "")}</div>
        <p class="apagado">Datos de stats.nba.com guardados en la carpeta <code>datos</code>. Tus preferencias se guardan aparte, en <code>datos/preferencias.json</code>.</p></div>
    </div>`;
  pintarCopiaClaude();
  pintarAjustesVivo();
}

// X-06: copia comprimida y partida de la base, para que Claude la pueda traer entera
async function pintarCopiaClaude() {
  const caja = $("#copia-claude");
  if (!caja) return;
  let d;
  try { d = await llamar("copia_claude"); } catch (e) { return; }
  if (!caja.isConnected) return;
  const cuando = d.creada ? new Date(d.creada).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : null;
  caja.innerHTML = `<h2>Copia para Claude</h2>
    <div class="sub">${d.corriendo ? "Haciendo la copia…" : cuando ? `Última: ${esc(cuando)}, ${d.pedazos} pedazo${d.pedazos === 1 ? "" : "s"}, ${d.mb} MB` : "Todavía no hay copia"}</div>
    ${d.error ? `<div style="color:var(--ambar);margin-top:6px">Falló la última: ${esc(d.error)}</div>` : ""}
    <div class="fila" style="margin-top:14px"><button class="boton" data-accion="copia-claude" ${d.corriendo ? "disabled" : ""}>Preparar copia ahora</button></div>
    <p class="apagado" style="margin-top:12px">Se hace sola después de cada actualización: la base completa, comprimida y partida en pedazos chicos en <code>datos/copia_claude</code>, para que Claude la pueda traer entera y armarte los picks con todos los datos.</p>`;
  if (d.corriendo) setTimeout(pintarCopiaClaude, 3000);
}

// D-05: sumar la temporada anterior completa
function tarjetaTemporadas() {
  const extra = S.datos?.temporadas_extra || [];
  // D-05: la siguiente temporada para sumar es la anterior a la más vieja que ya está (o pedida)
  const previa = (t) => `${Number(t.slice(0, 4)) - 1}-${t.slice(2, 4)}`;
  const tenidas = [...(S.datos?.temporadas || []), ...extra.map((x) => x.temporada), S.datos?.temporada_actual].filter(Boolean).sort();
  let ant = S.datos?.temporada_anterior;
  if (tenidas.length && extra.some((x) => x.temporada === ant)) ant = previa(tenidas[0]);
  if (ant && Number(ant.slice(0, 4)) < 2013) ant = null;          // antes de 2013-14 no hay tracking
  const filas = extra.map((x) => `<div class="fila" style="margin-top:8px"><b>${esc(x.temporada)}</b>
    ${x.completa ? '<span class="acento">completa</span>' : `<span class="apagado">bajando: ${x.con_datos} de ${x.partidos || "?"} partidos con datos. Sigue sola en cada actualización.</span>`}</div>`).join("");
  const boton = ant && !extra.some((x) => x.temporada === ant)
    ? `<div class="fila" style="margin-top:12px"><button class="boton primario" data-accion="sumar-temporada" data-temporada="${esc(ant)}">Sumar temporada ${esc(ant)}</button></div>
       <p class="apagado" style="margin-top:10px">Baja todas las stats de esa temporada: box score, avanzadas, cuartos, tracking, hustle, clutch, matchups, tiros, play types y en cancha. La primera vez tarda entre una y dos horas; podés seguir usando la app, y si la cerrás sigue desde donde quedó en la próxima actualización.</p>` : "";
  return filas + boton;
}

// ---------------------------------------------------------------- actualización (D-01, I-04)
let sondeo;
async function iniciarActualizacion() {
  await llamar("actualizar").catch(() => {});
  vigilarActualizacion();
}
function vigilarActualizacion() {
  clearInterval(sondeo);
  const paso = async () => {
    const a = await window.pywebview.api.estado_actualizacion();
    S.act = a;
    pintarEstado();
    if (!a.corriendo) {
      clearInterval(sondeo);
      if (a.cambios > S.cambiosVistos) {
        S.cambiosVistos = a.cambios;
        await alTerminarActualizacion(a);
      }
    }
  };
  paso();
  sondeo = setInterval(paso, 1000);
}
async function alTerminarActualizacion(a) {
  const r = a.resumen || {};
  await cargarDatos();
  if (r.cortado) aviso(`La actualización se cortó: ${r.cortado}`, 7000);
  else if (r.errores && Object.keys(r.errores).length) aviso(`Base actualizada con ${Object.keys(r.errores).length} bloque(s) con error. Detalle en Ajustes.`, 6000);
  else if ((r.extra || []).some((x) => !x.cortado && !Object.keys(x.errores || {}).length)) aviso(`Temporada ${r.extra.map((x) => x.temporada).join(", ")} completa.`, 6000);
  else if (r.partidos_nuevos) aviso(`Base actualizada: ${r.partidos_nuevos} partido(s) nuevo(s).`);
  if (S.ruta.s === "jugador") cargarPerfil();
  else if (["inicio", "ajustes", "jugadores", "unidades"].includes(S.ruta.s)) pintar();
}
function pintarEstado() {
  const a = S.act || {};
  const caja = $("#estado-act");
  caja.classList.toggle("corriendo", !!a.corriendo);
  const u = a.resumen || S.datos?.ultima_actualizacion;
  const conProblema = u && (u.cortado || Object.keys(u.errores || {}).length);
  caja.classList.toggle("error", !a.corriendo && !!conProblema);
  if (a.corriendo) {
    const p = a.total ? Math.round(((a.hecho + 1) / a.total) * 100) : 5;
    $("#estado-texto").innerHTML = `Actualizando…<br><span class="apagado">${esc(a.etapa)}${a.total > 1 ? ` ${a.hecho + 1}/${a.total}` : ""}</span>
      <div class="barra"><div style="width:${p}%"></div></div>`;
  } else if (u) {
    const h = new Date(u.fin).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    $("#estado-texto").innerHTML = conProblema ? `Actualizada con problemas<br><span class="apagado">${h}, ver Ajustes</span>` : `Base al día<br><span class="apagado">actualizada ${h}</span>`;
  } else {
    $("#estado-texto").textContent = S.datos?.vacia ? "Base vacía" : "Sin actualizar";
  }
  const ae = $("#ajustes-estado");
  if (ae && a.corriendo) ae.textContent = `En curso: ${a.etapa} ${a.total > 1 ? `${a.hecho + 1}/${a.total}` : ""}`;
}

// ---------------------------------------------------------------- eventos
document.addEventListener("click", (e) => {
  const t = e.target;
  const nav = t.closest("[data-sec]");
  if (nav) return ir({ s: nav.dataset.sec });
  const res = t.closest(".resultado");
  if (res) return abrirResultado(res.dataset.tipo, res.dataset.id);
  const jug = t.closest("[data-jugador]");
  if (jug) return ir({ s: "jugador", id: Number(jug.dataset.jugador) });
  const vi = t.closest("[data-vista]");
  if (vi) { S.prefs.vista_partidos = vi.dataset.vista; guardarPrefs(); panelPartidos($("#panel")); return entrar($("#panel")); }
  const pe = t.closest("[data-pestana]");
  if (pe) { S.prefs.pestana = pe.dataset.pestana; guardarPrefs(); pintarPerfil(); return entrar($("#panel")); }
  const seg = t.closest("[data-seg] button");
  if (seg) {
    const campo = seg.parentElement.dataset.seg, v = seg.dataset.v;
    filtros()[campo] = v === "" ? null : campo === "ultimos" ? Number(v) : v;
    return recargarPerfil();
  }
  const ls = t.closest("#lideres-stat button");
  if (ls) {
    S.prefs.lideres_stat = ls.dataset.stat; guardarPrefs();
    document.querySelectorAll("#lideres-stat button").forEach((b) => b.classList.toggle("activo", b === ls));
    return pintarLideres(ls.dataset.stat);
  }
  const th = t.closest("th[data-orden]");
  if (th) {
    const o = S.prefs.orden || { col: "fecha", dir: -1 };
    S.prefs.orden = o.col === th.dataset.orden ? { col: o.col, dir: -o.dir } : { col: th.dataset.orden, dir: -1 };
    guardarPrefs();
    return panelPartidos($("#panel"));
  }
  const acc = t.closest("[data-accion]");
  if (acc) {
    e.preventDefault();
    const a = acc.dataset.accion;
    if (a === "buscar") abrirBuscador();
    else if (a === "ajustes") ir({ s: "ajustes" });
    else if (a === "mas-filtros") { S.prefs.filtros_expandido = !S.prefs.filtros_expandido; guardarPrefs(); pintarPerfil(); if (S.prefs.filtros_expandido) entrar($(".filtros-mas"), "desplegar"); }
    else if (a === "limpiar-filtros") { S.prefs.filtros = { ...FILTROS_BASE }; S.sinCompanero = null; recargarPerfil(); }
    else if (a === "columnas") { const m = $("#columnas-menu"); m.classList.remove("quieto"); m.classList.toggle("abierto"); e.stopPropagation(); }
    else if (a === "columnas-defecto") { S.prefs.columnas = [...COLUMNAS_DEFECTO]; guardarPrefs(); panelPartidos($("#panel")); }
    else if (a === "actualizar") { iniciarActualizacion(); setTimeout(pintar, 300); }
    else if (a === "sumar-temporada") {
      llamar("sumar_temporada", acc.dataset.temporada || null).then(async () => { vigilarActualizacion(); await cargarDatos(); pintar(); aviso("Empezó a bajar la temporada anterior. Va a tardar un rato; podés seguir usando la app."); }).catch(() => {});
    }
    else if (a === "copia-claude") llamar("preparar_copia_claude").then(() => setTimeout(pintarCopiaClaude, 300)).catch(() => {});
    else if (a === "cancelar") llamar("cancelar_actualizacion");
    else if (a === "comparar-con") compararCon(S.ruta.id);
    else if (a === "ver-filtros") alternarFiltros();
    return;
  }
  const menu = $("#columnas-menu");
  if (menu && !t.closest(".selector-columnas")) menu.classList.remove("abierto");
  if (t.id === "buscador-fondo") cerrarBuscador();
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.col) {
    const set = new Set(S.prefs.columnas || COLUMNAS_DEFECTO);
    t.checked ? set.add(t.dataset.col) : set.delete(t.dataset.col);
    S.prefs.columnas = COLUMNAS.filter((c) => set.has(c.id)).map((c) => c.id);
    guardarPrefs();
    panelPartidos($("#panel"));
    $("#columnas-menu").classList.add("abierto", "quieto");
    return;
  }
  const campo = t.dataset.f;
  if (!campo) return;
  const f = filtros();
  if (campo === "temporadas") f.temporadas = t.value === "todas" ? [...S.perfil.ficha.temporadas] : [t.value];
  else if (campo === "sin_companero") S.sinCompanero = t.value ? Number(t.value) : null;
  else if (campo === "excluir_palizas") f.excluir_palizas = t.checked;
  else if (campo === "rival") f.rival = t.value ? Number(t.value) : null;
  else if (campo === "margen_paliza" || campo === "min_minutos") f[campo] = Number(t.value) || 0;
  else f[campo] = t.value || null;
  recargarPerfil();
});

$("#buscador-entrada").addEventListener("input", () => { B.sel = 0; pintarBuscador(); });
$("#buscador-entrada").addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { B.sel = Math.min(B.sel + 1, B.res.length - 1); pintarBuscador(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { B.sel = Math.max(B.sel - 1, 0); pintarBuscador(); e.preventDefault(); }
  else if (e.key === "Enter" && B.res[B.sel]) { const r = B.res[B.sel]; abrirResultado(r.tipo, r.item.id); }
  else if (e.key === "Escape") cerrarBuscador();
});
$("#abrir-buscador").addEventListener("click", abrirBuscador);
$("#atras").addEventListener("click", atras);

document.addEventListener("keydown", (e) => {
  const escribiendo = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); B.abierto ? cerrarBuscador() : abrirBuscador(); return; }
  if (e.key === "Escape" && B.abierto) { cerrarBuscador(); return; }
  if (e.altKey && /^[1-9]$/.test(e.key)) {
    e.preventDefault();
    const s = [...SECCIONES, AJUSTES].find((x) => x.tecla === e.key);
    if (s) ir({ s: s.id });
    return;
  }
  if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); atras(); return; }
  if (!escribiendo && e.key === "/") { e.preventDefault(); abrirBuscador(); }
  if (!escribiendo && e.key === "?") { e.preventDefault(); alternarGlosario(); }
  if (e.key === "Escape" && !$("#glosario").hidden) alternarGlosario(false);
});
window.addEventListener("mouseup", (e) => { if (e.button === 3) { e.preventDefault(); atras(); } });

// ---------------------------------------------------------------- arranque
async function cargarDatos() {
  const d = await llamar("inicio");
  S.datos = d;
  S.jugadores = d.jugadores || [];
  S.equipos = d.equipos || [];
  S.jugadorPorId = Object.fromEntries(S.jugadores.map((j) => [j.id, j]));
  S.equipoPorId = Object.fromEntries(S.equipos.map((e) => [e.id, e]));
  S.usuario = { favoritos: [], lineas: {}, notas: [], grupos: [], ...(d.usuario || {}) };
  prepararBusqueda();
}
async function arrancar() {
  await cargarDatos();
  S.prefs = S.datos.prefs || {};
  if (S.prefs.lineas) { delete S.prefs.lineas; guardarPrefs(); }   // ya pasaron a datos/usuario.db (S-04)
  const r = S.prefs.ultima_ruta;
  S.ruta = r && (r.s !== "jugador" || S.jugadorPorId[r.id]) ? r : { s: "inicio" };
  pintar();
  pintarEstado();
  pintarCarrito();            // U-13: el parlay en armado sigue ahí al volver a abrir
  iniciarActualizacion();     // D-01: al abrir, en segundo plano
}
if (window.pywebview && window.pywebview.api) arrancar();
else window.addEventListener("pywebviewready", arrancar, { once: true });
