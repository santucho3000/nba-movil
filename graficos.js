"use strict";
/* Stats NBA - gráficos (fase 3).
   Gráfico de barras por partido (G-01 a G-10) y mapa de tiros (J-05).
   SVG hecho a mano: sin librerías, funciona sin internet. */

const COLOR = {
  verde: "#4ade9a", rojo: "#f0605a", gris: "#858195", texto: "#f1f0f5", tenue: "#b3b0c0",
  apagado: "#858195", grilla: "#24222e", ambar: "#e0b84a", potencial: "#dfe3e9",
  comp: { pts: "#5b8def", reb: "#e59a4e", ast: "#2fb5a8", stl: "#e0799b", blk: "#d6b25e" },
};
const NOMBRE_COMP = { pts: "PTS", reb: "REB", ast: "AST", stl: "ROB", blk: "TAP" };

// stats disponibles en el gráfico. pot = campo del valor potencial (G-02); comp = combo (G-06)
const STATS_G = [
  { id: "pts", t: "PTS" },
  { id: "reb", t: "REB", pot: "reb_chances", potT: "chances de rebote" },
  { id: "ast", t: "AST", pot: "ast_pot", potT: "asistencias potenciales" },
  { id: "fg3m", t: "3PM", pot: "fg3a", potT: "triples intentados" },
  { id: "pra", t: "PRA", comp: ["pts", "reb", "ast"] },
  { id: "pr", t: "P+R", comp: ["pts", "reb"] },
  { id: "pa", t: "P+A", comp: ["pts", "ast"] },
  { id: "ra", t: "R+A", comp: ["reb", "ast"] },
  { id: "stl", t: "ROB" }, { id: "blk", t: "TAP" }, { id: "sb", t: "ROB+TAP", comp: ["stl", "blk"] },
  { id: "tov", t: "PÉR" },
  { id: "fgm", t: "TC", pot: "fga", potT: "tiros de campo intentados" },
  { id: "ftm", t: "TL", pot: "fta", potT: "libres intentados" },
  { id: "fga", t: "TCI" }, { id: "fg3a", t: "3PA" },
  { id: "oreb", t: "REB OF", pot: "oreb_chances", potT: "chances de rebote ofensivo" },
  { id: "dreb", t: "REB DEF", pot: "dreb_chances", potT: "chances de rebote defensivo" },
  { id: "min", t: "MIN" },
  // solo equipos (E-13)
  { id: "opp_pts", t: "PTS perm." }, { id: "total", t: "Total partido" }, { id: "margen", t: "Margen" },
  { id: "pace", t: "Pace" }, { id: "opp_reb", t: "REB perm." }, { id: "opp_ast", t: "AST perm." },
  { id: "opp_fg3m", t: "3PM perm.", pot: "opp_fg3a", potT: "triples intentados del rival" },
];
const STAT_G = Object.fromEntries(STATS_G.map((s) => [s.id, s]));

// U-22: los demás mercados de las casas (para anotar, seguir y resolver; chance aproximada)
const MERC_EXTRA = { stl: "ROB", blk: "TAP", sb: "ROB+TAP", tov: "PÉR", pf: "FAL", ftm: "TLM", fta: "TLI", oreb: "REB OF", dreb: "REB DEF",
  pts1: "PTS 1C", reb1: "REB 1C", ast1: "AST 1C", pra1: "PRA 1C", dd: "Doble-doble", td: "Triple-doble", fb: "Primer canasto" };
const SI_NO = new Set(["dd", "td", "fb"]);
// "más de 24,5 PTS" o "Sí: doble-doble"
function textoLinea(lado, linea, stat, nombre) {
  if (SI_NO.has(stat)) return `${lado === "mas" ? "Sí" : "No"}: ${(nombre || MERC_EXTRA[stat]).toLowerCase()}`;
  return `${lado === "mas" ? "más" : lado === "menos" ? "menos" : "línea"} de ${String(linea).replace(".", ",")} ${nombre || stat}`;
}

function valorStat(st, p) {
  if (st.comp) {
    if (st.comp.some((c) => p[c] == null)) return null;
    return st.comp.reduce((a, c) => a + p[c], 0);
  }
  return p[st.id] == null ? null : p[st.id];
}
function mediana(vals) {
  if (!vals.length) return null;
  const v = [...vals].sort((a, b) => a - b), m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
/* Línea "mediana" llevada a .5 (regla R-01 / G-03): si la mediana ya termina en .5, es la línea;
   si es entera, medio punto abajo o arriba, del lado que deje más cerca de la mitad de los
   partidos por encima (empate: abajo). Nunca por debajo de 0,5. */
function lineaMediana(vals) {
  const m = mediana(vals);
  if (m == null) return null;
  if (Math.abs(m % 1 - 0.5) < 1e-9) return m;
  if (m % 1 !== 0) return Math.floor(m) + 0.5;
  const sobre = (l) => vals.filter((v) => v > l).length / vals.length;
  const abajo = m - 0.5, arriba = m + 0.5;
  if (abajo < 0.5) return arriba;
  const dist = (l) => Math.round(Math.abs(sobre(l) - 0.5) * 1e6);   // sin errores de decimales
  return dist(abajo) <= dist(arriba) ? abajo : arriba;
}

// ---------------------------------------------------------------- línea de referencia (G-03)
// Líneas propias por jugador (o equipo) y stat (P-04): viven en datos/usuario.db
function configLinea(pid, stat) {
  const l = S.usuario?.lineas || {};
  return (l[pid] || {})[stat] || { modo: "mediana", valor: null };
}
function guardarLinea(pid, stat, cfg) {
  S.usuario.lineas = S.usuario.lineas || {};
  S.usuario.lineas[pid] = { ...(S.usuario.lineas[pid] || {}), [stat]: cfg };
  llamar("guardar_linea", pid, stat, cfg).catch(() => {});
}
function calcularLinea(cfg, vals) {
  if (cfg.modo === "manual" && cfg.valor != null) return Number(cfg.valor);
  if (!vals.length) return null;
  if (cfg.modo === "promedio") return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  return lineaMediana(vals);
}

// ---------------------------------------------------------------- gráfico por partido
/* opciones: clave (dónde se recuerda la stat elegida), stats (ids permitidos), stat y pot iniciales */
function graficoPartidos(caja, opciones) {
  // fuente: de dónde salen los partidos, los filtros y dónde se guardan las líneas
  const fuente = opciones.fuente || { partidos: S.perfil.partidos, idLinea: S.perfil.ficha.id, filtros, recargar: recargarPerfil };
  const pid = fuente.idLinea;
  S.prefs.graf = S.prefs.graf || {};
  const estado = { stat: opciones.stat || "pts", pot: opciones.pot ?? true, ...(S.prefs.graf[opciones.clave] || {}) };
  const soloEquipo = new Set(["opp_pts", "total", "margen", "pace", "opp_reb", "opp_ast", "opp_fg3m"]);
  const deEquipo = String(pid).startsWith("e");
  const permitidas = (opciones.stats || STATS_G.map((s) => s.id).filter((id) => deEquipo || !soloEquipo.has(id))).filter((id) => STAT_G[id]);
  if (!permitidas.includes(estado.stat)) estado.stat = permitidas[0];
  const st = STAT_G[estado.stat];
  const f = fuente.filtros();
  const partidos = [...fuente.partidos].reverse();                 // de más viejo a más nuevo
  const vals = partidos.map((p) => valorStat(st, p)).filter((v) => v != null);
  const cfg = configLinea(pid, st.id);
  const linea = calcularLinea(cfg, vals);
  const conPot = !!st.pot && estado.pot;

  const guardarEstado = (cambios) => {
    S.prefs.graf[opciones.clave] = { stat: estado.stat, pot: estado.pot, ...cambios };
    guardarPrefs();
    graficoPartidos(caja, opciones);
  };

  // resumen de cumplimiento (G-05)
  const cumple = (lista) => {
    const v = lista.map((p) => valorStat(st, p)).filter((x) => x != null);
    return { si: v.filter((x) => x > linea).length, n: v.length };
  };
  let resumenTxt = "";
  if (linea != null && vals.length) {
    const tot = cumple(partidos);
    const u5 = cumple(partidos.slice(-5)), u10 = cumple(partidos.slice(-10));
    const p100 = tot.n ? Math.round((tot.si / tot.n) * 100) : 0;
    resumenTxt = `<span class="resumen-linea ${p100 >= 50 ? "mas" : "menos"}">Superó ${nf1.format(linea)} en <b>${tot.si} de ${tot.n}</b> (${p100}%)</span>`;
    if (tot.n > 5) resumenTxt += `<span class="apagado">Últ. 5: ${u5.si}/${u5.n}</span>`;
    if (tot.n > 10) resumenTxt += `<span class="apagado">Últ. 10: ${u10.si}/${u10.n}</span>`;
    resumenTxt += `<span class="apagado">Promedio ${nf1.format(vals.reduce((a, b) => a + b, 0) / vals.length)}</span><span class="apagado">Mediana ${nf1.format(mediana(vals))}</span>`;
    if (vals.length >= 5) {            // J-12: la mitad central de sus partidos
      const v = [...vals].sort((a, b) => a - b), q = (x) => { const i = (v.length - 1) * x, a = Math.floor(i); return v[a] + (v[Math.min(a + 1, v.length - 1)] - v[a]) * (i - a); };
      resumenTxt += `<span class="apagado" title="La mitad central de estos partidos">Rango habitual ${nf0.format(Math.round(q(0.25)))} a ${nf0.format(Math.round(q(0.75)))}</span>`;
    }
    if (conPot) {
      const con = partidos.filter((p) => p[st.id] != null && p[st.pot]);
      const a = con.reduce((x, p) => x + p[st.id], 0), b = con.reduce((x, p) => x + p[st.pot], 0);
      if (b) resumenTxt += `<span class="apagado">Conversión ${a}/${b} = ${Math.round(Math.min(1, a / b) * 100)}%</span>`;
    }
  }

  caja.innerHTML = `
    <div class="graf-barra">
      <div class="segmentado graf-stats">${permitidas.map((id) => `<button data-gstat="${id}" class="${id === st.id ? "activo" : ""}">${STAT_G[id].t}</button>`).join("")}</div>
    </div>
    <div class="graf-barra">
      ${esCelular() ? `<div class="segmentado" title="Cuántos partidos se ven en el gráfico">${[5, 8, 10, 15, 20].map((v) =>
        `<button data-gbarras="${v}" class="${barrasCelular() === v ? "activo" : ""}">${v}</button>`).join("")}</div>` : ""}
      <div class="segmentado${esCelular() ? " solo-pc" : ""}" title="Rango: cambia el filtro de partidos de todo el perfil">
        ${[[5, "Últ. 5"], [10, "Últ. 10"], [20, "Últ. 20"], [null, "Temporada"]].map(([v, t]) =>
          `<button data-grango="${v ?? ""}" class="${(f.ultimos || null) === v && !f.rival ? "activo" : ""}">${t}</button>`).join("")}</div>
      <select class="control" data-grival title="Solo partidos contra un rival">
        <option value="">Cualquier rival</option>
        ${S.equipos.map((e) => `<option value="${e.id}" ${Number(f.rival) === e.id ? "selected" : ""}>vs ${esc(e.tricode)}</option>`).join("")}</select>
      ${st.pot ? `<label class="interruptor" title="${esc(st.potT)}"><input type="checkbox" data-gpot ${estado.pot ? "checked" : ""}>Potencial</label>` : ""}
      <span class="espacio"></span>
      <span class="apagado">Línea</span>
      <div class="segmentado">${[["mediana", "Mediana"], ["promedio", "Promedio"], ["manual", "Manual"]].map(([m, t]) =>
        `<button data-glinea="${m}" class="${cfg.modo === m ? "activo" : ""}">${t}</button>`).join("")}</div>
      <input type="number" class="control" step="0.5" min="0" data-glinea-valor value="${linea ?? ""}" title="Escribí una línea propia (se guarda para este jugador y esta stat)">
      ${!deEquipo && U_STATS.includes(st.id) ? `<button class="boton" data-gapuesta="simple" title="Registrar una apuesta con este jugador, esta stat y esta línea">Registrar apuesta</button>
        <button class="boton" data-gapuesta="parlay" title="Sumar esta pierna al parlay que estás armando">+ Parlay</button>
        <button class="boton" data-gapuesta="anotar" title="Guardar esta línea en el Anotador, sin apostarla">Anotar</button>` : ""}
    </div>
    <div class="graf-resumen">${resumenTxt || '<span class="apagado">Sin datos para esta stat con estos filtros.</span>'}</div>
    <div class="graf-lienzo"></div>
    ${st.comp ? `<div class="graf-leyenda">${st.comp.map((c) => `<span><i style="background:${COLOR.comp[c]}"></i>${NOMBRE_COMP[c]}</span>`).join("")}
      <span class="apagado">Arriba de cada barra, el total en verde si superó la línea y en rojo si no.</span></div>` :
      conPot ? `<div class="graf-leyenda"><span><i style="background:${COLOR.verde}"></i>Realizado (número adentro de la barra; verde si superó la línea)</span><span><i class="contorno"></i>${esc(st.potT[0].toUpperCase() + st.potT.slice(1))} (número arriba del contorno)</span></div>` : ""}
    <div class="graf-tip" hidden></div>`;

  const lienzo = caja.querySelector(".graf-lienzo");
  const dibujar = () => dibujarBarras(lienzo, caja.querySelector(".graf-tip"), partidos, st, linea, conPot);
  dibujar();
  if (caja._obs) caja._obs.disconnect();
  caja._obs = new ResizeObserver(() => { if (lienzo.isConnected) dibujar(); });
  caja._obs.observe(lienzo);

  // eventos del gráfico
  caja.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.gstat) { estado.stat = b.dataset.gstat; guardarEstado({}); }
    else if (b.dataset.gbarras) { try { localStorage.setItem("graf_barras", b.dataset.gbarras); } catch (err) {} guardarEstado({}); }
    else if (b.dataset.grango !== undefined) {
      const fl = fuente.filtros();
      fl.ultimos = b.dataset.grango ? Number(b.dataset.grango) : null;
      fl.rival = null;
      fuente.recargar();
    } else if (b.dataset.gapuesta) {         // U-03, U-13: jugador, stat y línea ya completos
      const j = S.jugadorPorId[pid];
      const pierna = { deporte: "NBA", player_id: Number(pid), jugador: j?.nombre || "", stat: st.id, linea: linea ?? "", lado: "mas", cuota: "" };
      if (b.dataset.gapuesta === "simple") abrirFormulario({ piernas: [pierna] });
      else if (b.dataset.gapuesta === "anotar") abrirFormulario({ modo: "anotar", piernas: [pierna] });
      else agregarAlParlay(pierna);
    } else if (b.dataset.glinea) {
      const nuevo = { modo: b.dataset.glinea, valor: b.dataset.glinea === "manual" ? (linea ?? 0) : null };
      guardarLinea(pid, st.id, nuevo);
      graficoPartidos(caja, opciones);
    }
  };
  caja.onchange = (e) => {
    const t = e.target;
    if (t.matches("[data-gpot]")) { estado.pot = t.checked; guardarEstado({}); }
    else if (t.matches("[data-grival]")) { const fl = fuente.filtros(); fl.rival = t.value ? Number(t.value) : null; fl.ultimos = null; fuente.recargar(); }
    else if (t.matches("[data-glinea-valor]")) {
      const v = parseFloat(String(t.value).replace(",", "."));
      if (!Number.isNaN(v)) { guardarLinea(pid, st.id, { modo: "manual", valor: v }); graficoPartidos(caja, opciones); }
    }
    e.stopPropagation();
  };
}

function escalaLinda(max) {
  if (max <= 0) return { tope: 1, paso: 1 };
  const crudo = max / 4, mag = Math.pow(10, Math.floor(Math.log10(crudo)));
  // pasos enteros (1, 2, 5, 10…): las stats son números enteros y el eje no tiene que redondear
  const paso = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= crudo) || 10 * mag);
  return { tope: Math.ceil(max / paso) * paso, paso };
}

// celular: cuántas barras entran cómodas (configurable arriba del gráfico; por defecto 8)
function esCelular() { return window.innerWidth < 560; }
function barrasCelular() { let v = 8; try { v = Number(localStorage.getItem("graf_barras")) || 8; } catch (e) {} return v; }

function dibujarBarras(lienzo, tip, partidos, st, linea, conPot) {
  if (esCelular() && partidos.length > barrasCelular()) partidos = partidos.slice(-barrasCelular());
  const n = partidos.length;
  const W = Math.max(320, lienzo.clientWidth);
  if (!n) { lienzo.innerHTML = '<div class="vacio">No hay partidos con estos filtros.</div>'; return; }
  // G-11: dónde cambia la temporada (los partidos van de más viejo a más nuevo)
  const cortes = partidos.map((p, i) => (i > 0 && p.temporada && partidos[i - 1].temporada && p.temporada !== partidos[i - 1].temporada ? i : null)).filter((i) => i != null);
  const chico = W < 560;                                     // celular: márgenes y letras más chicas, etiqueta en cada barra
  const izq = chico ? 30 : 66, der = chico ? 36 : 46, arriba = cortes.length ? 40 : 22, alto = 230;
  const esEquipo = partidos[0] && partidos[0].opp_pts !== undefined;
  const filasAbajo = ["fecha", "rival"].concat(esEquipo ? [] : ["min"], conPot ? ["conv", "convpct"] : []);
  const altoFila = 16, H = arriba + alto + 10 + filasAbajo.length * altoFila + 6;
  const slot = (W - izq - der) / n;
  const bw = Math.max(4, Math.min(42, slot * 0.68));
  const vals = partidos.map((p) => valorStat(st, p));
  const pots = conPot ? partidos.map((p) => p[st.pot]) : [];
  const maxDato = Math.max(1, ...vals.filter((v) => v != null), ...pots.filter((v) => v != null), linea ?? 0);
  const { tope, paso } = escalaLinda(maxDato * 1.08);
  const y = (v) => arriba + alto - (v / tope) * alto;
  const cx = (i) => izq + slot * i + slot / 2;
  const cada = Math.max(1, Math.ceil((chico ? 24 : 40) / slot));            // cada cuántas barras se escribe la etiqueta
  const minProm = partidos.reduce((a, p) => a + (p.min || 0), 0) / n;

  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="graf-svg" font-family="inherit">`;
  if (cortes.length) {
    const tramos = [0, ...cortes].map((a, k, l) => [a, k + 1 < l.length ? l[k + 1] : n]);
    const ultima = partidos[n - 1].temporada;
    tramos.forEach(([a, b]) => {
      const x0 = izq + slot * a, ancho = slot * (b - a), t = partidos[a].temporada;
      if (t !== ultima) s += `<rect class="graf-temp-ant" x="${x0}" y="${arriba - 26}" width="${ancho}" height="${H - arriba + 24}" rx="6"/>`;
      const txt = ancho > 110 ? `Temporada ${t}` : ancho > 44 ? t : t.slice(2);
      s += `<text class="graf-temp-txt${t === ultima ? " actual" : ""}" x="${x0 + ancho / 2}" y="${arriba - 12}" text-anchor="middle">${esc(txt)}</text>`;
    });
    cortes.forEach((i) => {
      const x = izq + slot * i;
      s += `<line class="graf-temp-corte" x1="${x}" x2="${x}" y1="${arriba - 26}" y2="${H - 2}"/>`;
    });
  }
  for (let v = 0; v <= tope + 1e-9; v += paso) {
    s += `<line x1="${izq}" x2="${W - der}" y1="${y(v)}" y2="${y(v)}" stroke="${COLOR.grilla}" stroke-width="1"/>
      <text x="${izq - (chico ? 4 : 8)}" y="${y(v) + 4}" text-anchor="end" font-size="${chico ? 10 : 11}" fill="${COLOR.apagado}">${nf0.format(v)}</text>`;
  }
  const tramo = Math.min(450, n * 35);                       // X-04: las barras crecen una tras otra
  partidos.forEach((p, i) => {
    const v = vals[i], x = cx(i) - bw / 2;
    const anim = `style="--d:${Math.round((i / Math.max(1, n - 1)) * tramo)}ms"`;
    const estado = v == null || linea == null ? "gris" : v > linea ? "verde" : v < linea ? "rojo" : "gris";
    const color = COLOR[estado];
    if (conPot && pots[i] != null) {
      s += `<rect class="ba" ${anim} x="${x + 0.75}" y="${y(pots[i])}" width="${bw - 1.5}" height="${Math.max(0, y(0) - y(pots[i]))}" fill="none" stroke="${COLOR.potencial}" stroke-width="1.5" rx="2" opacity=".85"/>`;
    }
    if (v == null) {
      s += `<text x="${cx(i)}" y="${y(0) - 6}" text-anchor="middle" font-size="11" fill="${COLOR.apagado}">—</text>`;
    } else if (st.comp) {
      let base = 0;
      for (const c of st.comp) {
        const h = y(base) - y(base + p[c]);
        s += `<rect class="ba" ${anim} x="${x}" y="${y(base + p[c])}" width="${bw}" height="${Math.max(0, h)}" fill="${COLOR.comp[c]}" opacity=".88"/>`;
        base += p[c];
      }
      s += `<rect class="ea" ${anim} x="${x}" y="${y(v) - 3}" width="${bw}" height="3" fill="${color}" rx="1"/>`;
    } else {
      s += `<rect class="ba" ${anim} x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(v > 0 ? 1.5 : 0, y(0) - y(v))}" fill="${color}" opacity=".9" rx="2"/>`;
    }
    if (v != null && slot >= 16) {
      const fs = slot < 26 ? 10 : 11.5;
      const texto = (txt, yy, col, peso = 600) =>
        `<text class="ea" ${anim} x="${cx(i)}" y="${yy}" text-anchor="middle" font-size="${fs}" font-weight="${peso}" fill="${col}">${txt}</text>`;
      if (conPot && pots[i] != null) {
        // con potencial (G-02): arriba del contorno el potencial; lo realizado adentro de la barra
        const altoBarra = y(0) - y(v), yPot = y(pots[i]) - 5;
        if (altoBarra >= fs + 6) {
          s += texto(nf0.format(v), y(v) + fs + 2, "#ffffff", 700);
          s += texto(nf0.format(pots[i]), yPot, COLOR.tenue, 500);
        } else if (y(v) - 5 - yPot >= fs + 2) {
          s += texto(nf0.format(v), y(v) - 4, COLOR.texto, 700);
          s += texto(nf0.format(pots[i]), yPot, COLOR.tenue, 500);
        } else {
          s += texto(`${nf0.format(v)}<tspan fill="${COLOR.tenue}" font-weight="500">/${nf0.format(pots[i])}</tspan>`, yPot, COLOR.texto, 700);
        }
      } else {
        s += texto(nf0.format(v), y(v) - (st.comp ? 8 : 5), st.comp ? color : COLOR.texto);
      }
    }
    // filas de abajo: fecha, rival, minutos (G-01, G-08) y conversión (G-07)
    if (i % cada === 0 || i === n - 1) {
      const base = arriba + alto + 10;
      const [yy, mm, dd] = p.fecha.split("-");
      const poco = p.min != null && p.min < 0.75 * minProm;
      const filas = {
        fecha: [`${dd}/${mm}`, COLOR.tenue],
        rival: [chico ? `${p.local ? "" : "@"}${p.rival}` : `${p.local ? "vs" : "@"}${p.rival}`, COLOR.apagado],
        min: [p.min == null ? "—" : nf0.format(Math.round(p.min)), poco ? COLOR.ambar : COLOR.apagado],
        conv: [p[st.id] != null && pots[i] ? `${p[st.id]}/${pots[i]}` : "—", COLOR.tenue],
        convpct: [p[st.id] != null && pots[i] ? `${Math.round(Math.min(1, p[st.id] / pots[i]) * 100)}%` : "", COLOR.apagado],
      };
      filasAbajo.forEach((fila, k) => {
        const [txt, col] = filas[fila];
        s += `<text x="${cx(i)}" y="${base + k * altoFila + 11}" text-anchor="middle" font-size="${chico ? (slot < 30 ? 8.5 : 9.5) : 10.5}" fill="${col}"${poco && fila === "min" ? ' font-weight="700"' : ""}>${esc(txt)}</text>`;
      });
    }
    s += `<rect class="graf-zona" data-i="${i}" x="${izq + slot * i}" y="${arriba}" width="${slot}" height="${H - arriba}" fill="transparent"/>`;
  });
  // títulos de las filas de abajo
  const base = arriba + alto + 10;
  const titulos = { fecha: "", rival: "", min: "MIN", conv: "Conv.", convpct: "" };
  filasAbajo.forEach((fila, k) => {
    if (titulos[fila]) s += `<text x="${izq - (chico ? 3 : 8)}" y="${base + k * altoFila + 11}" text-anchor="end" font-size="10" font-weight="600" fill="${COLOR.apagado}">${titulos[fila]}</text>`;
  });
  if (linea != null) {
    s += `<g class="la"><line x1="${izq}" x2="${W - der}" y1="${y(linea)}" y2="${y(linea)}" stroke="${COLOR.texto}" stroke-width="1.2" stroke-dasharray="5 4" opacity=".85"/>
      <rect x="${W - der + 4}" y="${y(linea) - 9}" width="${der - 6}" height="18" rx="4" fill="#2a3547"/>
      <text x="${W - der / 2 + 1}" y="${y(linea) + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${COLOR.texto}">${nf1.format(linea)}</text></g>`;
  }
  s += "</svg>";
  lienzo.innerHTML = s;

  // detalle al pasar el mouse (G-08)
  const svg = lienzo.querySelector("svg");
  svg.onmousemove = (e) => {
    const z = e.target.closest(".graf-zona");
    if (!z) { tip.hidden = true; return; }
    const p = partidos[Number(z.dataset.i)];
    tip.innerHTML = detallePartido(p, st, linea, conPot, cortes.length > 0);
    tip.hidden = false;
    const caja = tip.parentElement.getBoundingClientRect();
    let left = e.clientX - caja.left + 14, top = e.clientY - caja.top + 14;
    if (left + 250 > caja.width) left -= 270;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  };
  svg.onmouseleave = () => { tip.hidden = true; };
}

function detallePartido(p, st, linea, conPot, conTemporada = false) {
  const v = valorStat(st, p);
  const temp = conTemporada && p.temporada ? ` <span class="apagado">${esc(p.temporada)}</span>` : "";
  const res = `<span class="${p.resultado === "W" ? "gano" : "perdio"}">${p.resultado === "W" ? "Ganó" : "Perdió"} ${p.pts_eq}-${p.pts_riv}</span>`;
  const fila = (k, val) => `<div><span>${k}</span><b>${val}</b></div>`;
  if (p.opp_pts !== undefined) {           // partido de un equipo (E-13)
    const t = (m, a) => (a ? `${m}/${a} (${Math.round((m / a) * 100)}%)` : "0/0");
    return `<div class="tip-cab">${fechaCorta(p.fecha)}, ${p.local ? "vs" : "@"} ${esc(p.rival)}${temp}</div>
      <div class="tip-sub">${res}, total ${p.total}</div>
      ${v != null && linea != null ? `<div class="tip-linea ${v > linea ? "mas" : v < linea ? "menos" : ""}">${st.t}: ${nf1.format(v).replace(",0", "")} ${v > linea ? "superó" : v < linea ? "no superó" : "igualó"} ${nf1.format(linea)}</div>` : ""}
      <div class="tip-grilla">
        ${fila("PTS / perm.", `${p.pts} / ${p.opp_pts}`)}${fila("REB / perm.", `${p.reb} / ${p.opp_reb}`)}
        ${fila("AST / perm.", `${p.ast} / ${p.opp_ast}`)}${fila("3P", t(p.fg3m, p.fg3a))}
        ${fila("TC", t(p.fgm, p.fga))}${fila("TL", t(p.ftm, p.fta))}
        ${fila("ROB / TAP", `${p.stl} / ${p.blk}`)}${fila("PÉR", p.tov)}
        ${fila("Pace", p.pace != null ? nf1.format(p.pace) : "—")}${fila("Rating", p.off_rating != null ? `${nf1.format(p.off_rating)} / ${nf1.format(p.def_rating)}` : "—")}
      </div>`;
  }
  const tiro = (m, a) => (a ? `${m}/${a} (${Math.round((m / a) * 100)}%)` : "0/0");
  return `<div class="tip-cab">${fechaCorta(p.fecha)}, ${p.local ? "vs" : "@"} ${esc(p.rival)}${temp}</div>
    <div class="tip-sub">${res}, ${mmss(p.min)} min${p.titular === 0 ? ", suplente" : ""}${p.descanso === 0 ? ", B2B" : ""}</div>
    ${v != null && linea != null ? `<div class="tip-linea ${v > linea ? "mas" : v < linea ? "menos" : ""}">${st.t}: ${nf1.format(v).replace(",0", "")} ${v > linea ? "superó" : v < linea ? "no superó" : "igualó"} ${nf1.format(linea)}</div>` : ""}
    <div class="tip-grilla">
      ${fila("PTS", p.pts)}${fila("REB", `${p.reb}${p.reb_chances != null ? ` <i>de ${p.reb_chances}</i>` : ""}`)}
      ${fila("AST", `${p.ast}${p.ast_pot != null ? ` <i>de ${p.ast_pot}</i>` : ""}`)}${fila("3P", tiro(p.fg3m, p.fg3a))}
      ${fila("TC", tiro(p.fgm, p.fga))}${fila("TL", tiro(p.ftm, p.fta))}
      ${fila("ROB / TAP", `${p.stl} / ${p.blk}`)}${fila("PÉR / FAL", `${p.tov} / ${p.pf}`)}
      ${fila("+/-", p.plus_minus > 0 ? `+${p.plus_minus}` : p.plus_minus)}${fila("USG%", p.usg_pct != null ? Math.round(p.usg_pct * 100) + "%" : "—")}
    </div>`;
}

// ---------------------------------------------------------------- mapa de tiros (J-05)
function mapaTiros(caja, datos, filtro) {
  const tiros = datos.tiros.filter((t) => filtro === "todos" || (filtro === "convertidos" ? t[2] : !t[2]));
  // la NBA mide en décimas de pie con el aro en (0, 0); se dibuja con el aro abajo
  const Y = (y) => 422.5 - y;
  const lin = `stroke="#2f3b4c" stroke-width="2" fill="none"`;
  const a3 = Math.acos(220 / 237.5);
  const p3a = [220, Y(Math.sin(a3) * 237.5)], p3b = [-220, Y(Math.sin(a3) * 237.5)];
  let s = `<svg viewBox="-252 -2 504 476" class="cancha">
    <rect x="-250" y="0" width="500" height="470" fill="#131a23" stroke="#2f3b4c" stroke-width="2"/>
    <rect x="-80" y="${Y(142.5)}" width="160" height="190" ${lin}/>
    <rect x="-60" y="${Y(142.5)}" width="120" height="190" ${lin}/>
    <path d="M -60 ${Y(142.5)} A 60 60 0 0 1 60 ${Y(142.5)}" ${lin}/>
    <path d="M -60 ${Y(142.5)} A 60 60 0 0 0 60 ${Y(142.5)}" ${lin} stroke-dasharray="8 8"/>
    <path d="M -40 ${Y(0)} A 40 40 0 0 1 40 ${Y(0)}" ${lin}/>
    <line x1="-30" x2="30" y1="${Y(-7.5)}" y2="${Y(-7.5)}" stroke="#4a5768" stroke-width="3"/>
    <circle cx="0" cy="${Y(0)}" r="7.5" stroke="#f28c38" stroke-width="2" fill="none"/>
    <line x1="-220" x2="-220" y1="${Y(-47.5)}" y2="${p3b[1]}" stroke="#2f3b4c" stroke-width="2"/>
    <line x1="220" x2="220" y1="${Y(-47.5)}" y2="${p3a[1]}" stroke="#2f3b4c" stroke-width="2"/>
    <path d="M -220 ${p3b[1]} A 237.5 237.5 0 0 1 220 ${p3a[1]}" ${lin}/>
    <path d="M -60 0 A 60 60 0 0 0 60 0" ${lin}/>`;
  for (const [x, y, ok] of tiros) {
    if (y > 420) continue;
    if (ok) s += `<circle cx="${x}" cy="${Y(y)}" r="5.5" fill="${COLOR.verde}" fill-opacity=".85" stroke="#0c0b10" stroke-width="1"/>`;
    else s += `<path d="M ${x - 4.5} ${Y(y) - 4.5} L ${x + 4.5} ${Y(y) + 4.5} M ${x + 4.5} ${Y(y) - 4.5} L ${x - 4.5} ${Y(y) + 4.5}" stroke="${COLOR.rojo}" stroke-width="2" opacity=".85"/>`;
  }
  s += "</svg>";
  caja.innerHTML = s;
}
