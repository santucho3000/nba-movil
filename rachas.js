"use strict";
/* Stats NBA - fase 6: rachas (R-01 a R-09). */

const ETIQUETAS = {
  "sostenible": ["sostenible", "Subió el promedio y también su potencial (más chances, más tiros o más asistencias potenciales)."],
  "posible suerte": ["suerte", "Subió el promedio pero no su potencial: está convirtiendo más de lo habitual."],
  "baja real": ["baja-real", "Bajó el promedio y también su potencial: tiene menos oportunidades."],
  "posible mala suerte": ["mala-suerte", "Bajó el promedio pero no su potencial: le está entrando menos de lo habitual."],
};
function etiquetaRacha(e) {
  if (!e) return SIN;
  const [cl, ayuda] = ETIQUETAS[e];
  return `<span class="etiqueta-racha ${cl}" title="${esc(ayuda)}">${esc(e[0].toUpperCase() + e.slice(1))}</span>`;
}
function filtrosRachas() {
  const f = { direccion: "arriba", stat: "", min_pj: 3, min_min: 20, solo_pronto: false, ...(S.prefs.filtros_rachas || {}) };
  if (!f.v2) { f.v2 = true; if (f.min_pj === 8) f.min_pj = 3; }   // R-11: el mínimo de antes (8) pasa a 3
  S.prefs.filtros_rachas = f;
  return f;
}
// R-11: la línea sale de la temporada pasada mientras tenga menos de 10 partidos en esta
const marcaBase = (r) => (r.base ? ` <span class="marca-base" title="Línea de su temporada ${esc(r.base)}: en esta todavía tiene menos de 10 partidos">${esc(r.base.slice(2))}</span>` : "");
// los últimos 10 como cuadraditos: verde si superó la línea, rojo si no (de más viejo a más nuevo)
function puntitos(vals, linea) {
  return `<span class="puntitos" title="Últimos ${vals.length}, del más viejo al más reciente">${vals.map((v) =>
    `<i class="${v > linea ? "si" : "no"}" title="${nf0.format(v)}"></i>`).join("")}</span>`;
}
const pctTxt = (c) => (c.n ? `<span title="${c.si} de ${c.n}">${nf0.format((c.si / c.n) * 100)}%</span> <span class="apagado">${c.si}/${c.n}</span>` : SIN);

function irGrafico(pid, stat) {
  S.prefs.pestana = "partidos";
  S.prefs.vista_partidos = "graficos";
  S.prefs.graf = S.prefs.graf || {};
  S.prefs.graf.partidos = { ...(S.prefs.graf.partidos || {}), stat };
  S.prefs.filtros = { ...filtros(), temporadas: null, ultimos: 10 };   // C-05: los últimos 10, aunque crucen temporadas
  ir({ s: "jugador", id: Number(pid) });
}

async function vistaRachas(c) {
  const f = filtrosRachas();
  c.innerHTML = `<h1>Rachas</h1>
    <p class="sub" style="margin:4px 0 16px">Las stats que cada jugador viene superando más (o menos) de lo habitual. La línea de cada uno es su mediana de la temporada; si todavía tiene menos de 10 partidos, la de la temporada pasada.</p>
    <div class="filtros" id="filtros-rachas">
      <div class="campo"><span>Dirección</span><div class="segmentado" data-rseg="direccion">
        ${[["arriba", "En alza"], ["abajo", "En baja"]].map(([v, t]) => `<button data-v="${v}" class="${f.direccion === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
      <label class="campo"><span>Stat</span><select class="control" data-rf="stat"><option value="">Todas</option>
        ${["pts", "reb", "ast", "fg3m", "pra", "pr", "pa", "ra", "sb"].map((k) => `<option value="${k}" ${f.stat === k ? "selected" : ""}>${STAT_G[k].t}</option>`).join("")}</select></label>
      <label class="campo"><span>Mín. partidos</span><input type="number" class="control" data-rf="min_pj" min="1" max="82" value="${f.min_pj}"></label>
      <label class="campo"><span>Mín. minutos</span><input type="number" class="control" data-rf="min_min" min="0" max="48" value="${f.min_min}"></label>
      <label class="interruptor" style="align-self:center;margin-top:16px"><input type="checkbox" data-rf="solo_pronto" ${f.solo_pronto ? "checked" : ""}>Solo los que juegan en las próximas 24 h</label>
      <span class="espacio"></span><span class="apagado" id="rachas-ms"></span>
    </div>
    <div id="rachas-cuerpo"><div class="vacio">Calculando…</div></div>`;
  await pintarRachas();
}

async function pintarRachas() {
  const f = filtrosRachas();
  const pedido = (S.rachasPedido = (S.rachasPedido || 0) + 1);
  const d = await llamar("rachas", f);
  const caja = $("#rachas-cuerpo");
  if (pedido !== S.rachasPedido || !caja) return;
  $("#rachas-ms").textContent = `${d.ms} ms`;
  const arriba = f.direccion === "arriba";
  const fila = (r, tuya) => {
    const rv = r.rival;
    const puesto = rv && rv.puesto != null ? chipPuesto(rv.puesto, rv.n_equipos, `1º = el que más le permite a los ${rv.posicion || ""}`) : "";
    return `<tr class="clic" data-racha="${r.player_id}|${r.stat}" title="Ver el gráfico de ${esc(r.nombre)} en ${esc(STAT_G[r.stat]?.t || r.stat)}">
      <td class="izq"><div class="celda-jugador">${avatarJ(r.player_id, r.nombre, "chico")}<span class="fuerte">${esc(r.nombre)}</span><span class="tricode">${esc(r.equipo || "")}</span>${estrella(r.player_id, "chica")}</div></td>
      <td class="izq fuerte">${esc(STAT_G[r.stat]?.t || r.stat)}</td>
      <td>${nf1.format(r.linea)}${tuya ? ' <span class="apagado">tuya</span>' : marcaBase(r)}</td>
      <td class="izq">${puntitos(r.ultimos, r.linea)}</td>
      <td>${pctTxt(r.u5)}</td><td>${pctTxt(r.u10)}</td><td>${pctTxt(r.base_cumple)}</td>
      <td>${f1(r.prom_u5)} <span class="apagado">/ ${f1(r.prom_base)}</span></td>
      <td class="izq">${etiquetaRacha(r.etiqueta)}</td>
      <td class="izq" title="${rv ? esc(diaCorto(rv.hora_utc, rv.fecha)) : ""}">${rv ? `<span class="apagado">${rv.local ? "vs" : "@"}</span> ${esc(rv.rival)} ${puesto}` : SIN}</td></tr>`;
  };
  const cab = `<thead><tr><th class="izq">Jugador</th><th class="izq">Stat</th><th>Línea</th><th class="izq">Últimos 10</th><th>Últ. 5</th><th>Últ. 10</th><th title="La temporada, o la pasada si todavía tiene menos de 10 partidos">Base</th>
    <th title="Promedio de los últimos 5 / de su base">Prom. últ. 5</th><th class="izq">Etiqueta</th><th class="izq">Próximo</th></tr></thead>`;
  let html = "";
  if (d.tuyas.length) {
    html += `<div class="tarjeta rachas-tuyas" style="padding:16px 0 6px;margin-bottom:16px"><h2 style="padding:0 18px">Tus líneas <span class="apagado" style="font-weight:400">las que pusiste a mano en los gráficos</span></h2>
      <div class="caja-split"><table>${cab}<tbody>${d.tuyas.map((r) => fila(r, true)).join("")}</tbody></table></div></div>`;
  }
  if (!d.filas.length) {
    const corto = d.max_pj < f.min_pj;
    const sinBase = !d.con_referencia && d.max_pj < 10;
    html += `<div class="vacio">${corto
      ? `La temporada lleva como mucho ${d.max_pj} partidos por jugador y pediste un mínimo de ${f.min_pj}.<br>
         <button class="boton" style="margin-top:12px" data-rmin="${Math.max(1, d.max_pj)}">Ver con ${Math.max(1, d.max_pj)} partidos</button>`
      : sinBase
        ? `Todavía no está la temporada ${esc(d.anterior)}, que da la línea mientras haya pocos partidos.<br>Se baja sola en la próxima actualización.`
        : `Ningún jugador ${arriba ? "superó" : "quedó abajo de"} su línea en el 75% o más de sus últimos partidos con estos filtros.`}</div>`;
  } else {
    html += `<div class="tabla-caja"><table>${cab}<tbody>${d.filas.map((r) => fila(r, false)).join("")}</tbody></table></div>
      <p class="apagado" style="margin-top:10px">${arriba ? "En alza: superó la línea" : "En baja: quedó abajo de la línea"} en el 75% o más de los últimos 5 o de los últimos 10.
      Primero lo que más ${arriba ? "sube" : "baja"} contra su base; hasta 2 stats por jugador. Las líneas marcadas ${esc((d.anterior || "").slice(2))} salen de la temporada pasada, porque en esta todavía tiene menos de 10 partidos.
      La etiqueta compara el promedio de los últimos 5 con el de su potencial. El puesto del rival es lo que le permite a esa posición (1º = el que más permite). Clic en una fila para ver el gráfico.</p>`;
  }
  caja.innerHTML = html;
}
function diaCorto(horaUtc, fecha) {
  if (horaUtc) {
    const d = new Date(horaUtc);
    return `${DIAS[d.getDay()]} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
  }
  return fecha ? fecha.slice(8, 10) + "/" + fecha.slice(5, 7) : "";
}

let rachasTimer;
function recargarRachas() {
  guardarPrefs();
  clearTimeout(rachasTimer);
  rachasTimer = setTimeout(() => pintarRachas(), 150);
}
document.addEventListener("click", (e) => {
  if (S.ruta?.s !== "rachas") return;
  const t = e.target;
  const seg = t.closest("[data-rseg] button");
  if (seg) {
    filtrosRachas()[seg.parentElement.dataset.rseg] = seg.dataset.v;
    seg.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("activo", b === seg));
    return recargarRachas();
  }
  const m = t.closest("[data-rmin]");
  if (m) { filtrosRachas().min_pj = Number(m.dataset.rmin); return vistaRachas($("#contenido")); }
  const fila = t.closest("[data-racha]");
  if (fila) { const [pid, stat] = fila.dataset.racha.split("|"); irGrafico(pid, stat); }
});
document.addEventListener("change", (e) => {
  if (S.ruta?.s !== "rachas" || !e.target.dataset.rf) return;
  const t = e.target, f = filtrosRachas();
  f[t.dataset.rf] = t.type === "checkbox" ? t.checked : t.type === "number" ? Number(t.value) : t.value;
  recargarRachas();
});
