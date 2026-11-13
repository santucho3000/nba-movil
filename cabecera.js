"use strict";
/* Stats NBA - X-04: cabecera del perfil (foto, colores del equipo y sus números) y de la ficha de equipo,
   la línea compacta de filtros y los números que cuentan hasta su valor. */

function partirNombre(n) {
  const t = (n || "").split(" ");
  if (n.length <= 15 || t.length < 2) return esc(n);
  return `${esc(t[0])}<br>${esc(t.slice(1).join(" "))}`;
}
// número grande que cuenta desde 0 (data-contar = valor, data-dec = decimales, data-signo = muestra +)
function numeroContable(v, dec = 1, signo = false) {
  if (v == null || Number.isNaN(v)) return "—";
  const txt = (signo && v > 0 ? "+" : "") + (dec ? nf1.format(v) : nf0.format(v));
  return `<span data-contar="${v}" data-dec="${dec}" data-signo="${signo ? 1 : ""}">${txt}</span>`;
}
function contarNumeros(raiz = document) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  raiz.querySelectorAll("[data-contar]").forEach((el, i) => {
    const fin = Number(el.dataset.contar), dec = Number(el.dataset.dec), signo = !!el.dataset.signo;
    const fmt = (v) => (signo && v > 0 ? "+" : "") + (dec ? nf1.format(v) : nf0.format(Math.round(v)));
    const dur = 650, demora = Math.min(i * 60, 300), t0 = performance.now() + demora;
    el.textContent = fmt(0);
    const paso = (t) => {
      const x = Math.min(1, Math.max(0, (t - t0) / dur));
      el.textContent = fmt(fin * (1 - (1 - x) ** 3));
      if (x < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
}

function fondoCabecera(tid) {
  const p = paletaEquipo(tid) || { fondo: "#1e1d27", franja: "#9d8cff", oscuro: "#121118" };
  return `--c-fondo:${p.fondo}; --c-franja:${p.franja}; --c-oscuro:${p.oscuro}`;
}

// J-11: percentil entre los de su posición, pintado de rojo (bajo) a verde (alto); en pérdidas, al revés
function pildoraPercentil(p, k, invertir = false) {
  const pc = p?.percentiles?.pct?.[k];
  if (pc == null) return "";
  const v = invertir ? 100 - pc : pc;
  return `<span class="pctl" style="--h:${Math.round(v * 1.25)}" title="Percentil ${pc} entre ${esc(p.percentiles.grupo)} con 15+ minutos (promedio de la temporada ${esc(p.percentiles.temporada)}): está por encima del ${pc}% de ellos">p${pc}</span>`;
}
const fmtRango = (r) => (r ? `${nf0.format(Math.round(r[0]))}–${nf0.format(Math.round(r[1]))}` : "");

// ---- jugador
function cabeceraJugador(p) {
  const fi = p.ficha, eq = fi.equipo, r = p.resumen.total, u5 = p.resumen.u5;
  const tendencia = (k) => {
    if (!(r.pj > 5) || u5[k] == null || !r[k]) return "";
    const d = u5[k] / r[k] - 1;
    const flecha = d >= 0.05 ? "▲" : d <= -0.05 ? "▼" : "•";
    return `<span class="cab-u5 ${d >= 0.05 ? "sube" : d <= -0.05 ? "baja" : ""}" title="Promedio de los últimos 5">${flecha} ${nf1.format(u5[k])}</span>`;
  };
  const nums = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["pra", "PRA"], ["fg3m", "3PM"]];
  const foto = S.datos?.imagenes ? `<img src="https://cdn.nba.com/headshots/nba/latest/1040x760/${fi.id}.png" alt="" onload="this.parentElement.classList.add('con-foto')" onerror="this.remove()">` : "";
  return `<header class="cabecera" style="${fondoCabecera(eq?.team_id)}">
    <div class="cab-franja" aria-hidden="true"></div><div class="cab-franja fina" aria-hidden="true"></div>
    ${fi.numero ? `<div class="cab-dorsal" aria-hidden="true">${esc(fi.numero)}</div>` : ""}
    <div class="cab-foto" role="img" aria-label="Foto de ${esc(fi.nombre)}"><span>${esc(iniciales(fi.nombre))}</span>${foto}</div>
    <div class="cab-info">
      <div class="cab-meta">
        ${eq ? `${logoMini(eq.team_id)}<a href="#" data-equipo="${eq.team_id}">${esc(`${eq.ciudad} ${eq.nombre}`)}</a>` : "<span>Sin equipo</span>"}
        ${[fi.numero ? `#${fi.numero}` : null, fi.posicion, fi.altura, fi.peso, fi.edad ? `${fi.edad} años` : null].filter(Boolean).map((x) => `<span class="cab-sep">${esc(x)}</span>`).join("")}
        <span class="espacio"></span>${estrella(fi.id)}
        <button class="boton cab-boton" data-accion="comparar-con">Comparar con…</button>
      </div>
      <h1 class="cab-nombre">${partirNombre(fi.nombre)}</h1>
      <div class="cab-numeros">${nums.map(([k, t]) => `<div class="cab-num"><b>${numeroContable(r[k])}</b>
        <div><span class="cab-k">${t}</span>${tendencia(k)}${pildoraPercentil(p, k)}</div></div>`).join("")}</div>
    </div>
  </header>`;
}

// ---- equipo
function cabeceraEquipo(d) {
  const e = d.equipo, a = d.agregado, po = d.posicion, pu = d.puestos || {}, n = d.n_equipos;
  const logo = S.datos?.imagenes ? `<img src="https://cdn.nba.com/logos/nba/${e.team_id}/global/D/logo.svg" alt="" onload="this.parentElement.classList.add('con-logo')" onerror="this.remove()">` : "";
  const nums = [
    ["Récord", a.pj ? `<span>${a.g}-${a.p}</span>` : "—", po ? `${po.puesto_conf}º del ${e.conferencia === "East" ? "Este" : "Oeste"}` : ""],
    ["PF", numeroContable(a.pts), pu.pts ? `${pu.pts}º de ${n}` : ""],
    ["PC", numeroContable(a.opp_pts), ""],
    ["Neto", numeroContable(a.net, 1, true), pu.net ? `${pu.net}º de ${n}` : ""],
    ["Pace", numeroContable(a.pace), pu.pace ? `${pu.pace}º de ${n}` : ""],
  ];
  const prox = d.proximo;
  return `<header class="cabecera equipo" style="${fondoCabecera(e.team_id)}">
    <div class="cab-franja" aria-hidden="true"></div><div class="cab-franja fina" aria-hidden="true"></div>
    <div class="cab-dorsal" aria-hidden="true">${esc(e.tricode || "")}</div>
    <div class="cab-foto logo" role="img" aria-label="Logo de ${esc(e.nombre || "")}"><span>${esc(e.tricode || "")}</span>${logo}</div>
    <div class="cab-info">
      <div class="cab-meta">
        <span>${esc(NOMBRE_CONF[e.conferencia] || "")}</span><span class="cab-sep">${esc(e.division || "")}</span>
        ${po && po.racha ? `<span class="cab-sep">Racha ${esc(po.racha.replace("W", "G").replace("L", "P"))}</span>` : ""}
        ${prox ? `<span class="cab-sep">Próximo: ${prox.local ? "vs" : "@"} <a href="#" data-equipo="${prox.rival_id}">${esc(prox.rival)}</a>, ${esc(horaArg(prox.hora_utc))}</span>` : ""}
      </div>
      <h1 class="cab-nombre">${esc(e.ciudad || "")}<br>${esc(e.nombre || "")}</h1>
      <div class="cab-numeros">${nums.map(([t, v, det]) => `<div class="cab-num"><b>${v}</b>
        <div><span class="cab-k">${t}</span>${det ? `<span class="cab-u5">${esc(det)}</span>` : ""}</div></div>`).join("")}</div>
    </div>
  </header>`;
}

// ---- línea compacta de filtros: lo que se está viendo y un botón para abrir el panel completo
function lineaFiltros(chips, derecha, abierto) {
  return `<div class="filtros-linea">
    <span class="apagado">Viendo</span>${chips.map((c) => `<span class="filtro-chip">${esc(c)}</span>`).join("")}
    <button class="enlace" data-accion="ver-filtros" aria-expanded="${abierto}">${abierto ? "Ocultar filtros" : "Cambiar filtros"}</button>
    <span class="espacio"></span>${derecha}</div>`;
}
const NOMBRE_FASE = { "Regular Season": "Fase regular", Playoffs: "Playoffs", PlayIn: "Play-in", todas: "Todas las fases" };
function alternarFiltros() {
  S.prefs.filtros_visibles = !S.prefs.filtros_visibles;
  guardarPrefs();
  const panel = $("#filtros") || $("#filtros-eq");
  const boton = $('[data-accion="ver-filtros"]');
  if (panel) {
    panel.classList.toggle("oculto", !S.prefs.filtros_visibles);
    if (S.prefs.filtros_visibles) entrar(panel, "desplegar");
  }
  if (boton) {
    boton.textContent = S.prefs.filtros_visibles ? "Ocultar filtros" : "Cambiar filtros";
    boton.setAttribute("aria-expanded", S.prefs.filtros_visibles);
  }
}

// X-04: los números de las tarjetas (KPIs) también cuentan hasta su valor, respetando su formato
function contarKpis(raiz) {
  if (!raiz || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  raiz.querySelectorAll(".kpi .v, .mini-kpi b, .fav-stat b").forEach((el, i) => {
    if (el.children.length) return;
    const m = el.textContent.trim().match(/^([+\-−]?)(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?(%?)$/);
    if (!m) return;
    const signo = m[1], dec = m[3] ? m[3].length : 0, suf = m[4];
    const fin = Number(m[2].replace(/\./g, "") + (dec ? "." + m[3] : "")) * (signo && signo !== "+" ? -1 : 1);
    const fmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const dur = 600, t0 = performance.now() + Math.min(i * 35, 280);
    const pintar = (v) => { el.textContent = (signo === "+" && v > 0 ? "+" : "") + fmt.format(v).replace("-", "−") + suf; };
    pintar(0);
    const paso = (t) => {
      const x = Math.min(1, Math.max(0, (t - t0) / dur));
      pintar(fin * (1 - (1 - x) ** 3));
      if (x < 1) requestAnimationFrame(paso); else el.textContent = m[0];
    };
    requestAnimationFrame(paso);
  });
}
