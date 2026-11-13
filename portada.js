"use strict";
/* Stats NBA - X-04: el Inicio como portada. Partidos de hoy, rachas de los que juegan,
   lo mejor de anoche y tus favoritos que juegan. */

const STAT_LARGO = { pts: "puntos", reb: "rebotes", ast: "asistencias", fg3m: "triples", pra: "PTS+REB+AST",
  pr: "PTS+REB", pa: "PTS+AST", ra: "REB+AST", sb: "robos + tapas" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_LARGO = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const horaCorta = (iso) => (iso ? new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "");
const fechaLarga = (d) => `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;

async function vistaPortada(c) {
  if (!c.querySelector(".portada")) c.innerHTML = '<div class="portada"><div class="vacio">Cargando…</div></div>';
  if (S.datos?.vacia) { c.innerHTML = `<h1>Inicio</h1><div class="vacio">Todavía no hay datos: la primera descarga corre en segundo plano.</div>`; return; }
  const d = await llamar("portada");
  if (S.ruta.s !== "inicio") return;
  S.portada = d;
  pintarPortada(c, d);
}

function pintarPortada(c, d) {
  const n = d.partidos.length;
  const primero = d.partidos[0];
  const dia = primero ? new Date(primero.hora_utc || primero.fecha + "T12:00:00") : new Date();
  const enVivo = d.partidos.filter((p) => p.estado === 2).length;
  const titulo = !n ? "Hoy no hay partidos" : d.hoy ? `${n} partido${n === 1 ? "" : "s"} ${enVivo ? "hoy" : "esta noche"}` : `Sin NBA hoy: ${n} partido${n === 1 ? "" : "s"} el ${DIAS_LARGO[dia.getDay()].toLowerCase()}`;
  const frases = [];
  if (primero && d.hoy && !enVivo) frases.push(`El primero arranca a las ${horaCorta(primero.hora_utc)}.`);
  if (enVivo) frases.push(`${enVivo} en juego ahora.`);
  if (d.favoritos.length) frases.push(`${d.favoritos.length === 1 ? "Uno de tus favoritos juega" : `${d.favoritos.length} de tus favoritos juegan`}${d.hoy ? " hoy" : ""}.`);
  if (d.rachas.length) frases.push(`Hay ${d.rachas.length} rachas fuertes entre los que salen a la cancha.`);

  c.innerHTML = `<div class="portada">
    <section class="portada-hero">
      <div class="hero-aro" aria-hidden="true"></div><div class="hero-aro chico" aria-hidden="true"></div>
      <div class="hero-fecha">${esc(fechaLarga(d.hoy ? new Date() : dia))}</div>
      <h1 class="hero-titulo">${esc(titulo)}</h1>
      ${frases.length ? `<p class="hero-sub">${esc(frases.join(" "))}</p>` : ""}
    </section>

    <section id="portada-apuestas" aria-label="Tus apuestas"></section>

    ${n ? `<section class="portada-partidos" aria-label="Partidos">${d.partidos.map(tarjetaPartido).join("")}</section>` : ""}

    <section class="portada-bloque" aria-labelledby="t-rachas-hoy">
      <div class="bloque-cab"><h2 id="t-rachas-hoy">${d.hoy ? "Rachas de hoy" : "Rachas"}</h2>
        <span class="apagado">${d.hoy ? "de los que juegan" : "de los que juegan el próximo día"}</span>
        <span class="espacio"></span><a href="#" data-sec="rachas" class="enlace">Ver todas</a></div>
      ${d.rachas.length ? `<div class="rachas-grilla">${d.rachas.filter((r, i, a) => a.findIndex((x) => x.player_id === r.player_id) === i).slice(0, 4).map(tarjetaRacha).join("")}</div>`
        : `<div class="tarjeta apagado">Ninguno de los que juegan viene superando su línea en el 75% de sus últimos partidos. En la sección Rachas están todos, también los que no juegan.</div>`}
    </section>

    <div class="portada-dos">
      <section class="portada-bloque" aria-labelledby="t-anoche" style="flex:1.35">
        <div class="bloque-cab"><h2 id="t-anoche">Lo mejor de la última noche</h2>
          ${d.anoche_fecha ? `<span class="apagado">${esc(fechaCorta(d.anoche_fecha).replace(/<[^>]+>/g, ""))}</span>` : ""}</div>
        ${d.anoche.length ? `<div class="lista-anoche">${d.anoche.map(filaAnoche).join("")}</div>` : '<div class="tarjeta apagado">Todavía no hay partidos terminados.</div>'}
      </section>
      <section class="portada-bloque" aria-labelledby="t-favs-hoy" style="flex:1">
        <div class="bloque-cab"><h2 id="t-favs-hoy">Tus favoritos ${d.hoy ? "hoy" : "que juegan"}</h2><span class="espacio"></span><a href="#" data-sec="favoritos" class="enlace">Ver todos</a></div>
        ${d.favoritos.length ? `<div class="lista-favs">${d.favoritos.map(filaFavHoy).join("")}</div>`
          : `<div class="tarjeta apagado">${S.usuario.favoritos.length ? "Ninguno de tus favoritos juega." : "Marcá jugadores con la estrella y acá vas a ver cuándo juegan y cómo vienen."}</div>`}
        ${recientes().length ? `<div class="bloque-cab" style="margin-top:22px"><h2>Vistos recientemente</h2></div><div class="fila">${chipsRecientes()}</div>` : ""}
      </section>
    </div>
  </div>`;
  contarNumeros(c.querySelector(".rachas-grilla") || c);
  pintarInicioVivo();
  pintarApuestasPortada();
}

function tarjetaPartido(p) {
  // 0.22: duelo horizontal con el color de cada equipo (visitante a la izquierda, local a la derecha)
  const col = (id) => { const q = paletaEquipo(id); return !q ? "#2a2836" : luminancia(q.fondo) < 0.02 ? q.acento : q.fondo; };
  const fila = (e, lado) => `<a href="#" class="pp-equipo ${lado}" data-equipo="${e.id}">${logoMini(e.id)}<b>${esc(e.tri)}</b>
    <span class="apagado">${e.w != null ? `${e.w}-${e.l}` : ""}</span></a>`;
  const dato = p.favoritos.length ? `${p.favoritos.length === 1 ? esc(p.favoritos[0].split(" ").slice(-1)[0]) + " juega" : `${p.favoritos.length} favoritos en cancha`}`
    : p.ritmo ? `Partido ${p.ritmo}: ~${nf0.format(p.pace)} posesiones` : p.pace ? `~${nf0.format(p.pace)} posesiones` : "";
  return `<div class="tarjeta-partido${p.estado === 2 ? " en-vivo" : ""}${p.favoritos.length ? " con-fav" : ""}" data-partido="${p.game_id}" title="Ver el partido" style="--c-vis:${col(p.visita.id)}; --c-loc:${col(p.local.id)}">
    <div class="pp-duelo">${fila(p.visita, "vis")}
      <div class="pp-centro">${p.estado === 2 ? '<span class="pp-hora viva"><i class="punto-vivo"></i>En vivo</span>' : `<span class="pp-hora">${esc(horaCorta(p.hora_utc))}</span>`}</div>
      ${fila(p.local, "loc")}</div>
    <div class="pp-vivo" data-ppvivo="${p.game_id}"></div>
    <div class="pp-dato">${dato}</div></div>`;
}

function tarjetaRacha(r) {
  const pal = paletaEquipo(r.team_id) || { fondo: "#2a2836", oscuro: "#16151c", acento: "#2a2836" };
  const fondo = luminancia(pal.fondo) < 0.02 ? mezclar(pal.acento, "#0c0b10", 0.5) : pal.fondo;   // base negra (Spurs, Nets): más color
  const foto = S.datos?.imagenes ? `<img src="https://cdn.nba.com/headshots/nba/latest/1040x760/${r.player_id}.png" alt="" onload="this.classList.add('lista')" onerror="this.remove()">` : "";
  return `<a href="#" class="tarjeta-racha" data-racha="${r.player_id}|${r.stat}" style="--c-fondo:${fondo}; --c-oscuro:${pal.oscuro}"
      title="Ver el gráfico de ${esc(r.nombre)}">
    <div class="tr-foto" aria-hidden="true">${foto}</div>
    ${r.etiqueta ? `<span class="tr-etiqueta">${esc(r.etiqueta[0].toUpperCase() + r.etiqueta.slice(1))}</span>` : ""}
    <div class="tr-numero"><span data-contar="${r.u5.si}" data-dec="0">${r.u5.si}</span>/${r.u5.n}</div>
    <div class="tr-detalle">sobre ${nf1.format(r.linea)} ${esc(STAT_LARGO[r.stat] || r.stat)}${r.base ? ` (línea ${esc(r.base.slice(2))})` : ""}${r.rival ? `, ${r.rival.local ? "vs" : "@"} ${esc(r.rival.rival)}` : ""}</div>
    <div class="tr-nombre">${esc(r.nombre)}</div>
    ${puntitos(r.ultimos, r.linea)}
  </a>`;
}

function filaAnoche(a) {
  const pal = paletaEquipo(a.team_id);
  const stats = [["PTS", a.pts], ["REB", a.reb], ["AST", a.ast]].concat(a.fg3m >= 4 ? [["3PM", a.fg3m]] : a.stl + a.blk >= 4 ? [["ROB+TAP", a.stl + a.blk]] : []);
  return `<a href="#" class="fila-anoche" data-jugador="${a.player_id}" style="--c-borde:${pal ? pal.acento : "var(--panel-3)"}">
    ${avatarJ(a.player_id, a.nombre)}
    <div class="fa-nombre"><b>${esc(a.nombre)}</b><span class="apagado">${esc(a.partido)}</span></div>
    <div class="fa-stats">${stats.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join("")}</div></a>`;
}

function filaFavHoy(f) {
  const ev = f.evaluacion;
  const linea = ev ? `${nf1.format(ev.linea)} ${STAT_G[ev.stat]?.t || ev.stat}` : "";
  const estado = ev ? (ev.propia ? `Tu línea: ${ev.u5.si} de ${ev.u5.n}` : `Últimos 10: ${ev.u10.si} de ${ev.u10.n} sobre la mediana`) : "";
  return `<a href="#" class="fila-fav-hoy" data-jugador="${f.id}">
    ${avatarJ(f.id, f.nombre)}
    <div class="fa-nombre"><b>${esc(f.nombre)}</b><span class="apagado">${f.local ? "vs" : "@"} ${esc(f.rival)}, ${esc(horaCorta(f.hora_utc))} h</span></div>
    <div class="ffh-linea"><b>${esc(linea)}</b><span class="${ev?.propia ? "acento" : "apagado"}">${esc(estado)}</span></div></a>`;
}

document.addEventListener("click", (e) => {
  if (S.ruta?.s !== "inicio") return;
  const r = e.target.closest(".tarjeta-racha");
  if (r) { e.preventDefault(); const [pid, stat] = r.dataset.racha.split("|"); irGrafico(pid, stat); }
});

// Rediseño 0.20: lo primero que se ve en Inicio son tus apuestas en juego o por jugarse
async function pintarApuestasPortada() {
  const caja = $("#portada-apuestas");
  if (!caja) return;
  let d = null;
  try { d = await llamar("vivo_apuestas"); } catch (e) { return; }
  if (!caja.isConnected) return;
  const lista = (d?.apuestas || []).filter((a) => a.estado === "pendiente" || a.estado === "en_juego");
  if (!lista.length) { caja.innerHTML = ""; return; }
  const enJuego = lista.reduce((t, a) => t + (Number(a.unidades) || 0), 0);
  caja.innerHTML = `<div class="bloque-cab"><h2>Tus apuestas</h2><span class="apagado">${lista.length} abierta${lista.length === 1 ? "" : "s"} · ${nf1.format(enJuego)} u en juego</span>
      <span class="espacio"></span><a href="#" data-sec="unidades" class="enlace">Ver en Unidades</a></div>
    <div class="pa-grilla">${lista.map((a) => {
      const falladas = a.patas.filter((x) => ((x.vivo || {}).estado || x.estado) === "fallada").length;
      return `<a href="#" data-sec="unidades" class="pa-tarjeta${a.estado === "en_juego" ? " viva" : ""}">
        <div class="pa-cab"><b>${a.n > 1 ? `Combinada de ${a.n}` : esc((a.patas[0] || {}).jugador || "Simple")}</b>${a.estado === "en_juego" ? '<span class="pa-vivo"><span class="punto-vivo"></span>en juego</span>' : ""}</div>
        <div class="pa-num"><span>cuota <b>${nfC.format(a.cuota)}</b></span><span>${nf1.format(a.unidades)} u</span><span>${a.cumplidas} de ${a.n}</span></div>
        <div class="pa-puntos" aria-hidden="true">${a.patas.map((x) => { const e = (x.vivo || {}).estado || x.estado; return `<i class="${e === "cumplida" || e === "ganada" ? "ok" : e === "fallada" || e === "perdida" ? "mal" : e === "peligro" ? "ojo" : ""}"></i>`; }).join("")}</div>
      </a>`; }).join("")}</div>`;
}
setInterval(() => { if (S.ruta?.s === "inicio") pintarApuestasPortada(); }, 20000);
