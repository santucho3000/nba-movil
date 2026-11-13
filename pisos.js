"use strict";
/* Stats NBA - M-15: combinada de pisos (pestaña de Señales).
   Las patas más seguras entre las líneas que Stake ofrece de verdad, y la combinación con más chance de salir
   que llega a la cuota que elegís. La chance de cada pata es mitad la de la app y mitad la de Stake sin margen. */

const PS_CORTO = { pts: "PTS", reb: "REB", ast: "AST", pra: "PRA", pr: "P+R", pa: "P+A", ra: "R+A", fga: "TCI", fg3m: "3PM" };
const PS_RIESGO = { paliza: "riesgo de paliza", minutos: "pocos minutos", min_irregular: "minutos irregulares", min_inflado: "minutos inflados",
  min_baja: "minutos en baja", historial: "historial flojo" };
const PS_TIT_RIESGO = {
  paliza: "Titular en un partido con diferencia esperada de 12 o más. En la prueba del 10/11 no cambió el acierto de los pisos (+0,3 puntos), así que entra por defecto",
  minutos: "Juega menos de 24 minutos: cualquier cambio en la rotación lo deja sin piso (en la prueba, 3,7 puntos menos de lo prometido)",
  min_irregular: "Sus minutos varían mucho de un partido a otro (en la prueba, 4,2 puntos menos de lo prometido)",
  min_inflado: "Viene jugando 10% más que lo habitual sin que falte nadie: suele volver a lo normal (en la prueba, 5,5 puntos menos)",
  min_baja: "Viene jugando 10% menos que lo habitual (en la prueba, 3,5 puntos menos de lo prometido)",
  historial: "Pasó esta línea en menos de 14 de sus últimos 20 (en la prueba, 3 puntos menos de lo prometido)",
};
const PS = { d: null, pidiendo: 0, espera: null, todas: false };

function opcionesPisos() {
  S.prefs.pisos = { objetivo: "10", minimo: 0.75, max_patas: 10, max_partido: 4, partidos: [], triples: false, paliza: true,
    pocos_minutos: false, excluir: [], fijas: [], fecha: null, ...(S.prefs.pisos || {}) };
  if ((S.prefs.pisos.v || 1) < 2) { S.prefs.pisos.paliza = true; S.prefs.pisos.v = 2; }   // M-16: la paliza no influye en los pisos
  if (S.prefs.pisos.v < 3) { Object.assign(S.prefs.pisos, { max_patas: 4, objetivo: "3", minimo: 0.7, v: 3 }); }   // M-17: combinadas cortas por defecto
  return S.prefs.pisos;
}
const psClave = (x) => `${x.player_id}|${x.stat}|${String(x.linea)}`;
const psPct = (p) => `${nf0.format(p * 100)}%`;
const psLinea = (x) => `Más de ${lin(x.linea)} ${PS_CORTO[x.stat] || x.stat}`;
const psHora = (u) => (u ? new Date(u).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "");

async function vistaPisos(c) {
  if (!c.querySelector(".pisos")) {
    c.innerHTML = `<div class="senales pisos"><h1>Señales</h1>${pestanasSenales()}<div class="vacio">Buscando las líneas más seguras de Stake…</div></div>`;
  }
  await pedirPisos(c);
}

async function pedirPisos(c, actualizar = true) {
  const o = opcionesPisos();
  const n = ++PS.pidiendo;
  const d = await llamar("pisos", { ...o, actualizar }).catch(() => null);
  if (n !== PS.pidiendo || S.ruta.s !== "senales" || S.prefs.sen_tab !== "pisos") return;
  if (!d) return;
  if (o.fecha !== d.fecha) {                      // otro día: lo que se sacó o se fijó ayer ya no sirve
    Object.assign(o, { fecha: d.fecha, excluir: [], fijas: [], partidos: [] });
    guardarPrefs();
    if (d.combinada) return pedirPisos(c, false);
  }
  PS.d = d;
  pintarPisos(c || $("#contenido"));
  clearTimeout(PS.espera);
  if (d.actualizando || d.verificar) PS.espera = setTimeout(() => pedirPisos(null, false), 7000);
}

function pintarPisos(c) {
  const d = PS.d, o = opcionesPisos();
  const abiertos = d.partidos.filter((p) => !p.empezo);
  const elegidos = new Set(o.partidos.filter((g) => abiertos.some((p) => p.game_id === g)));
  const conLineas = abiertos.filter((p) => p.leida_utc);
  const scroll = c.scrollTop;
  c.innerHTML = `<div class="senales pisos">
    <h1>Señales</h1>
    <p class="sub" style="margin:4px 0 16px">En una combinada importa que salgan todas, y las chances se multiplican: 8 patas al 80% salen el 17% de las veces, al 70% el 6%.
      Acá se arma con el piso de cada jugador, solo con líneas que Stake ofrece.</p>
    ${pestanasSenales()}
    ${estadoStakePisos(d, conLineas.length)}
    <section class="tarjeta ps-form">
      <div class="campo"><span>Cuota objetivo</span>
        <div class="ps-objetivo"><input class="control" data-ps="objetivo" inputmode="decimal" value="${esc(String(o.objetivo))}">
          <div class="segmentado">${[3, 5, 10, 20].map((v) => `<button data-psobj="${v}" class="${String(o.objetivo) === String(v) ? "activo" : ""}">${v}</button>`).join("")}</div></div></div>
      <div class="campo"><span title="Mitad la chance de la app y mitad la de Stake sin margen">Chance mínima por pata</span>
        <div class="segmentado" data-psseg="minimo">${[[0.7, "70%"], [0.75, "75%"], [0.8, "80%"]].map(([v, t]) => `<button data-v="${v}" class="${Number(o.minimo) === v ? "activo" : ""}">${t}</button>`).join("")}</div></div>
      <label class="campo"><span>Máximo de patas</span><input class="control ps-num" data-ps="max_patas" inputmode="numeric" value="${esc(String(o.max_patas))}"></label>
      <div class="campo"><span title="Las patas del mismo partido caen juntas si el partido se escapa">Máximo por partido</span>
        <div class="segmentado" data-psseg="max_partido">${[2, 3, 4, 5].map((v) => `<button data-v="${v}" class="${Number(o.max_partido) === v ? "activo" : ""}">${v}</button>`).join("")}</div></div>
      <div class="ps-interruptores">
        <label class="interruptor"><input type="checkbox" data-psb="triples" ${o.triples ? "checked" : ""}> Incluir triples</label>
        <label class="interruptor" title="${esc(PS_TIT_RIESGO.paliza)}"><input type="checkbox" data-psb="paliza" ${o.paliza ? "checked" : ""}> Titulares con riesgo de paliza</label>
        <label class="interruptor" title="${esc(PS_TIT_RIESGO.minutos)}"><input type="checkbox" data-psb="pocos_minutos" ${o.pocos_minutos ? "checked" : ""}> Minutos o historial en riesgo</label>
      </div>
      <div class="campo ps-partidos-campo"><span>Partidos ${elegidos.size ? `<button class="enlace" data-pstodos>usar todos</button>` : '<span class="apagado">(todos; tocá uno para elegir)</span>'}</span>
        <div class="ps-partidos">${abiertos.length ? abiertos.map((p) => `<button class="chip${elegidos.has(p.game_id) ? " elegido" : ""}" data-psp="${p.game_id}" ${p.leida_utc ? "" : "disabled"}
            title="${p.leida_utc ? `${p.patas} patas posibles${p.margen != null ? `, diferencia esperada ${nf1.format(Math.abs(p.margen))}` : ""}` : "Todavía sin cuotas de Stake"}">
            ${esc(p.partido)} <span class="apagado">${psHora(p.hora_utc)} · ${p.leida_utc ? p.patas : "sin cuotas"}</span>${p.margen != null && Math.abs(p.margen) >= 12 ? ' <span class="ps-tag ambar" title="Diferencia esperada de 12 o más: los titulares pueden jugar menos">paliza</span>' : ""}</button>`).join("")
          : '<span class="apagado">No quedan partidos por empezar hoy.</span>'}</div></div>
      <div class="ps-acciones"><button class="boton primario" data-psarmar>Armar combinada</button>
        ${o.excluir.length || o.fijas.length ? `<button class="enlace" data-psreset>Volver a empezar <span class="apagado">(${o.fijas.length} fijas, ${o.excluir.length} sacadas)</span></button>` : ""}</div>
    </section>
    <div id="ps-res">${resultadoPisos(d.combinada, o)}</div>
    ${tablaPatasPisos(d, o)}
  </div>`;
  c.scrollTop = scroll;
}

function estadoStakePisos(d, n) {
  if (d.activo === false) return '<div class="ab-casa fila ambar"><span class="ab-casa-txt ambar">Las cuotas de Stake están apagadas en Ajustes: sin ellas no hay pisos.</span></div>';
  if (d.verificar) return '<div class="ab-casa fila ambar"><span class="ab-casa-txt ambar">Stake pide verificar que sos humano: marcá la casilla en la ventana de Stake que se abrió.</span></div>';
  const txt = d.actualizando ? "Leyendo de nuevo las cuotas de Stake de los partidos de hoy… la combinada se rehace sola cuando lleguen."
    : `Cuotas de Stake de ${n} partido${n === 1 ? "" : "s"}.`;
  return `<div class="ab-casa fila"><span class="ab-casa-txt">${txt}</span>${d.error ? `<span class="ambar" title="${esc(d.error)}">No se pudo leer Stake</span>` : ""}
    ${d.descartes ? `<span class="espacio"></span><span class="apagado" title="No entran: afuera o dudosos en el reporte de lesiones, y los mercados donde la app y Stake ven partidos muy distintos (alarma)">Fuera: ${d.descartes.dudoso} dudosos, ${d.descartes.alarma} con alarma</span>` : ""}</div>`;
}

function resultadoPisos(r, o) {
  if (!r) return '<div class="vacio">Elegí la cuota y tocá Armar combinada.</div>';
  if (r.falta) return `<div class="tarjeta ps-falta"><b>${esc(r.falta)}</b>
    ${r.falta.includes("fijaste") ? "" : '<p class="apagado">Probá bajar la chance mínima por pata, permitir más patas o más por partido, o sumar partidos.</p>'}</div>`;
  const unoDe = r.chance > 0 ? Math.round(1 / r.chance) : null;
  return `<section class="tarjeta ps-combo">
    <div class="ps-totales">
      <div><span class="apagado">Cuota</span><b class="ps-grande">${nfC.format(r.cuota)}</b><span class="apagado">multiplicando las patas</span></div>
      <div><span class="apagado">Chance de que salga</span><b class="ps-grande">${nf1.format(r.chance * 100)}%</b><span class="apagado">${unoDe ? `1 de cada ${nf0.format(unoDe)}` : ""}</span></div>
      <div><span class="apagado">Patas</span><b class="ps-grande">${r.patas.length}</b><span class="apagado">${r.bloques.length} partido${r.bloques.length === 1 ? "" : "s"}</span></div>
    </div>
    ${r.bloques.map((b) => `<div class="ps-bloque">
      <div class="fila ps-bloque-cab"><b>${esc(b.partido)}</b><span class="apagado">${b.patas.length} patas · cuota ${nfC.format(b.cuota)} · ${psPct(b.chance)}</span></div>
      ${b.patas.map((x) => filaPata(x, true)).join("")}</div>`).join("")}
    ${avisoPatas(r.patas.length)}
    <p class="apagado ps-nota">La chance supone patas independientes. En el mismo partido no lo son: si se escapa, suelen fallar juntas.
      Stake ajusta la cuota de las patas del mismo partido, así que la de tu boleto puede salir más baja que esta.</p>
    <div class="fila"><span class="espacio"></span><button class="boton primario" data-psticket>Pasar al ticket</button></div>
  </section>`;
}

// M-16: el porqué de cada pata (contexto del partido y de sus minutos)
const PQ_POS = { G: "bases y escoltas", F: "aleros", C: "pivots" };
const PQ_STAT = { pts: "puntos", reb: "rebotes", ast: "asistencias", pra: "PRA", fg3m: "triples", fga: "tiros" };
const pqPct = (v) => `${v >= 0 ? "+" : "−"}${nf0.format(Math.abs(v) * 100)}%`;
function textoPorque(pq, compacto = false) {
  if (!pq) return "";
  const partes = [];
  if (pq.puesto) {
    const [p, n, f] = pq.puesto;
    const cls = p <= 10 ? "mas" : p > n - 10 ? "menos" : "";
    partes.push(`<span class="${cls}" title="Lo que ${esc(pq.rival)} le permite a los ${PQ_POS[pq.pos] || "de su posición"} en ${PQ_STAT[pq.puesto_stat] || ""} por posesión, contra la liga${f != null ? ` (${pqPct(f)})` : ""}">vs ${esc(pq.rival)}: ${p}º que más permite${compacto ? "" : ` a ${PQ_POS[pq.pos] || "su posición"}`}</span>`);
  } else if (pq.rival) partes.push(`vs ${esc(pq.rival)}`);
  if (pq.ritmo && Math.abs(pq.ritmo) >= 0.015) partes.push(`<span class="${pq.ritmo > 0 ? "mas" : "menos"}" title="Posesiones del rival contra la liga: más ritmo, más chances">ritmo ${pqPct(pq.ritmo)}</span>`);
  if (pq.grupo_def) partes.push(`<span class="${pq.grupo_def === "bottom" ? "mas" : "menos"}" title="Defensa del rival por puntos permitidos cada 100 posesiones">defensa ${pq.grupo_def === "top" ? "top 10" : "bottom 10"}</span>`);
  if (pq.min5 != null) {
    const dif = pq.min5 - pq.base_min;
    const proy = pq.min_proy != null ? pq.min_proy : pq.min5;
    partes.push(`<span class="${proy - pq.base_min <= -3 ? "menos" : ""}" title="Minutos esperados hoy: salen de su promedio habitual (${nf0.format(pq.base_min)}), de los últimos 5 (${nf0.format(pq.min5)}), de quién falta o vuelve en su posición y del riesgo de paliza. En un partido puntual se equivoca unos 5 minutos en promedio">se esperan ${nf0.format(proy)} min (habitual ${nf0.format(pq.base_min)})</span>`);
  }
  if (pq.cv_min != null && pq.cv_min >= 0.25) partes.push('<span class="ambar" title="Sus minutos varían mucho de un partido a otro">minutos irregulares</span>');
  if (pq.inicio === "cambio") partes.push(`<span class="ambar" title="Con pocos partidos en su equipo nuevo, lo esperado sale alto y varía más: la app ya le bajó la chance">equipo nuevo, ${pq.n_temp} partido${pq.n_temp === 1 ? "" : "s"}</span>`);
  else if (pq.inicio === "inicio") partes.push(`<span class="ambar" title="Con menos de 5 partidos en la temporada la app le baja un poco la chance">${pq.n_temp} partido${pq.n_temp === 1 ? "" : "s"} en la temporada</span>`);
  if (pq.vuelven && pq.vuelven.length) partes.push(`<span class="ambar" title="Compañeros que venían faltando y hoy vuelven: le pueden sacar minutos y pelotas">vuelve ${esc(pq.vuelven.join(", "))}</span>`);
  if (pq.faltan && pq.faltan.length) partes.push(`<span title="Compañeros habituales que no juegan">faltan ${esc(pq.faltan.join(", "))}</span>`);
  return partes.join(" · ");
}

function filaPata(x, enCombo) {
  const fija = enCombo ? x.fija : opcionesPisos().fijas.includes(psClave(x));
  const tags = [...x.riesgos.map((r) => `<span class="ps-tag${r === "paliza" ? "" : " ambar"}" title="${esc(PS_TIT_RIESGO[r])}">${PS_RIESGO[r]}</span>`),
    x.aprox ? '<span class="ps-tag" title="El modelo no mira esta stat para él: chance desde su promedio">aprox.</span>' : "",
    x.principal ? '<span class="ps-tag" title="Es la línea principal de Stake (la pareja)">principal</span>' : "",
    fija ? '<span class="ps-tag fija">fija</span>' : ""].join("");
  return `<div class="ps-pata">
    <div class="ps-pata-jug"><a href="#" data-jugador="${x.player_id}">${esc(x.jugador)}</a> <span class="apagado">${esc(x.equipo || "")}${enCombo ? "" : ` · ${esc(x.partido)}`}</span>${tags}</div>
    <div class="ps-pata-linea"><b>${psLinea(x)}</b></div>
    <div class="ps-num-c" title="Cuota de Stake">${nfC.format(x.cuota)}</div>
    <div class="ps-num-c ps-chance" title="App ${psPct(x.chance_app)} · Stake ${x.chance_stake != null ? psPct(x.chance_stake) : "—"}, corregida con lo que viene saliendo ${x.chance_casa != null ? psPct(x.chance_casa) : "—"}">${psPct(x.chance)}</div>
    <div class="ps-num-c apagado" title="Partidos de los últimos ${x.n} en que pasó la línea">${x.arriba}/${x.n}</div>
    <div class="ps-pata-acc">
      <button class="enlace" data-psfijar="${esc(psClave(x))}" title="${fija ? "Que la combinada pueda sacarla" : "Que esté sí o sí en la combinada"}">${fija ? "Soltar" : "Fijar"}</button>
      ${enCombo && !fija ? `<button class="enlace" data-pssacar="${x.player_id}|${x.stat}" title="Sacar este mercado del jugador y rearmar">Cambiar</button>` : ""}
    </div>
    ${x.porque ? `<div class="ps-porque apagado">${textoPorque(x.porque)}</div>` : ""}</div>`;
}

function tablaPatasPisos(d, o) {
  const usadas = new Set((d.combinada?.patas || []).map(psClave));
  const elegidos = new Set(o.partidos);
  const permitido = (x) => x.riesgos.every((r) => (r === "paliza" ? o.paliza : o.pocos_minutos));
  const lista = d.patas.filter((x) => !usadas.has(psClave(x)) && (!elegidos.size || elegidos.has(x.game_id)) && permitido(x));
  if (!lista.length) return "";
  const ver = PS.todas ? lista : lista.slice(0, 25);
  return `<section class="tarjeta ps-todas">
    <div class="fila"><h2 style="margin:0">Otras patas posibles</h2><span class="apagado">${lista.length} con ${psPct(Number(o.minimo))} o más, de la más segura a la menos</span></div>
    <div class="ps-pata ps-pata-titulos apagado"><div>Jugador</div><div>Línea</div><div class="ps-num-c">Cuota</div><div class="ps-num-c">Chance</div><div class="ps-num-c">Últ.</div><div></div></div>
    ${ver.map((x) => filaPata(x, false)).join("")}
    ${lista.length > ver.length ? `<div class="fila" style="margin-top:8px"><button class="enlace" data-psmas>Ver las ${lista.length}</button></div>` : ""}
  </section>`;
}

function pisosAlTicket() {
  const r = PS.d?.combinada;
  if (!r || r.falta) return;
  const bloques = r.bloques.map((b) => ({ game_id: b.game_id, partido: b.partido, cuota: "",
    patas: b.patas.map((x) => ({ player_id: x.player_id, jugador: x.jugador, stat: x.stat, linea: x.linea, lado: "mas", chance: x.chance, cuota_casa: x.cuota })) }));
  const poner = () => {
    const t = ticket();
    t.bloques = bloques; t.cuota = ""; t.casa = "Stake";
    t.nota = `Combinada de pisos, cuota ${nfC.format(r.cuota)} armada`;
    guardarPrefs(); pintarBarraTicket(); abrirTicket();
    aviso("La cuota sale de multiplicar las de Stake: si al armarla Stake te da otra, cambiala antes de guardar.", 7000);
  };
  const t = S.prefs.ticket;
  if (t && t.bloques && t.bloques.length) {
    confirmar("¿Reemplazar el ticket?", "Ya tenés combinadas en el ticket: se cambian por esta.", "Reemplazar").then((si) => si && poner());
  } else poner();
}

function rearmarPisos() {
  const res = $("#ps-res");
  if (res) res.innerHTML = '<div class="vacio">Armando…</div>';
  pedirPisos($("#contenido"), false);
}

document.addEventListener("click", (e) => {
  if (S.ruta?.s !== "senales" || S.prefs.sen_tab !== "pisos") return;
  const o = opcionesPisos();
  const t = e.target;
  const ob = t.closest("[data-psobj]");
  if (ob) { o.objetivo = ob.dataset.psobj; guardarPrefs(); return rearmarPisos(); }
  const sg = t.closest("[data-psseg] button");
  if (sg) { o[sg.parentElement.dataset.psseg] = Number(sg.dataset.v); guardarPrefs(); return rearmarPisos(); }
  const pp = t.closest("[data-psp]");
  if (pp) {
    const g = pp.dataset.psp, i = o.partidos.indexOf(g);
    if (i >= 0) o.partidos.splice(i, 1); else o.partidos.push(g);
    guardarPrefs(); return rearmarPisos();
  }
  if (t.closest("[data-pstodos]")) { o.partidos = []; guardarPrefs(); return rearmarPisos(); }
  if (t.closest("[data-psarmar]")) return rearmarPisos();
  if (t.closest("[data-psreset]")) { o.excluir = []; o.fijas = []; guardarPrefs(); return rearmarPisos(); }
  const fj = t.closest("[data-psfijar]");
  if (fj) {
    e.preventDefault();
    const k = fj.dataset.psfijar, i = o.fijas.indexOf(k);
    if (i >= 0) o.fijas.splice(i, 1);
    else { const pid = k.split("|")[0]; o.fijas = o.fijas.filter((f) => f.split("|")[0] !== pid); o.fijas.push(k); }
    guardarPrefs(); return rearmarPisos();
  }
  const sc = t.closest("[data-pssacar]");
  if (sc) { e.preventDefault(); if (!o.excluir.includes(sc.dataset.pssacar)) o.excluir.push(sc.dataset.pssacar); guardarPrefs(); return rearmarPisos(); }
  if (t.closest("[data-psmas]")) { PS.todas = true; return pintarPisos($("#contenido")); }
  if (t.closest("[data-psticket]")) return pisosAlTicket();
});
document.addEventListener("change", (e) => {
  if (S.ruta?.s !== "senales" || S.prefs.sen_tab !== "pisos") return;
  const o = opcionesPisos();
  const b = e.target.closest("[data-psb]");
  if (b) { o[b.dataset.psb] = b.checked; guardarPrefs(); return rearmarPisos(); }
  const x = e.target.closest("[data-ps]");
  if (x) { o[x.dataset.ps] = x.value; guardarPrefs(); return rearmarPisos(); }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !e.target.closest?.("[data-ps]")) return;
  const o = opcionesPisos();
  o[e.target.dataset.ps] = e.target.value; guardarPrefs(); rearmarPisos();
});
