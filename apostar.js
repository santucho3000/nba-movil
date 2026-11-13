"use strict";
/* Stats NBA - U-20 y U-21: la pestaña "Apostar" de cada partido, como una casa de apuestas, y el ticket.
   Cada jugador se despliega con sus mercados; la línea se cambia con − y +, y la chance de la app se
   recalcula al instante (binomial negativa calibrada, la misma cuenta de M-13, hecha acá). Tocar Más o
   Menos suma la pata a la combinada del partido; "Agregar al ticket" la pasa al ticket, que junta
   combinadas de varios partidos y se guarda en Unidades como una apuesta con grupos. */

const MERC = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["fg3m", "3PM"], ["pra", "PRA"], ["pr", "P+R"], ["pa", "P+A"], ["ra", "R+A"],
  ["fga", "TCI"], ["fgm", "TCM"], ["fg3a", "3PA"], ...Object.entries(MERC_EXTRA)];
const textoPataA = (x) => textoLinea(x.lado, lin(x.linea), x.stat, NOM_MERC[x.stat]);
const NOM_MERC = Object.fromEntries(MERC);
const ESTIMADA = new Set(["pr", "pa", "ra"]);
const A = { gid: null, m: null, abiertos: new Set(), lineas: {}, casa: null };
const lin = (L) => String(L).replace(".", ",");
const cuotaJ = (p) => (p > 0.005 ? (1 / p >= 20 ? nf0.format(1 / p) : nfC.format(1 / p)) : "—");

// --- la misma cuenta que senales.py (nb_sobre y _calibrar)
function nbSobre(L, m, v) {
  const k = Math.floor(L);
  if (k < 0) return 1;
  if (m <= 0) return 0;
  v = Math.max(v, m * 1.0001);
  const r = (m * m) / (v - m), q = r / (r + m);
  let pmf = Math.exp(r * Math.log(q)), acum = pmf;
  for (let i = 1; i <= k; i++) { pmf *= ((i - 1 + r) / i) * (1 - q); acum += pmf; }
  return Math.min(1, Math.max(0, 1 - acum));
}
function calibrarA(cal, p) {
  if (!cal) return p;
  const [xs, ys] = cal, n = xs.length;
  if (p < xs[0]) return ys[0] + (p - xs[0]) * (xs[0] ? ys[0] / xs[0] : 0);
  if (p >= xs[n - 1]) return ys[n - 1] + (p - xs[n - 1]) * (xs[n - 1] < 1 ? (1 - ys[n - 1]) / (1 - xs[n - 1]) : 0);
  for (let i = 1; i < n; i++) if (p <= xs[i]) { const t = xs[i] > xs[i - 1] ? (p - xs[i - 1]) / (xs[i] - xs[i - 1]) : 0; return ys[i - 1] + t * (ys[i] - ys[i - 1]); }
  return p;
}
const chanceMasA = (mk, s, L) => Math.min(0.995, Math.max(0.005, mk.p != null ? mk.p : calibrarA(A.m.cal[s], nbSobre(L, mk.E, mk.d * mk.E))));

// ---------------------------------------------------------------- la pestaña
async function pintarApostar(caja) {
  const gid = P.partido.game_id;
  if (A.gid !== gid || !A.m) {
    caja.innerHTML = '<div class="vacio">Armando los mercados del partido…</div>';
    const m = await llamar("mercado_partido", gid).catch(() => null);
    if (!m || S.ruta.s !== "partido" || S.ruta.id !== gid) return;
    A.gid = gid; A.m = m; A.abiertos = new Set(m.equipos.flatMap((e) => e.jugadores.slice(0, 1).map((j) => j.player_id)));
    A.casa = await llamar("lineas_partido", gid).catch(() => null);
    if (S.ruta.s !== "partido" || S.ruta.id !== gid) return;
    esperarCasa(caja, gid);
  }
  const m = A.m;
  if (m.falta) { caja.innerHTML = `<div class="vacio">${esc(m.falta)}</div>`; return; }
  caja.innerHTML = `${barraCasa()}<div class="ab-grilla">
    <div class="ab-equipos">${m.equipos.map(columnaEquipo).join("")}</div>
    <aside class="ab-aside"><div id="ab-combo"></div></aside></div>
    <p class="apagado ab-nota">La línea arranca en la principal de Stake (o cerca de su promedio si Stake no la tiene); cambiala con − y +. La chance es la de la app
      para esa línea exacta${m.con_lesiones ? ", con el reporte de lesiones" : ", sin reporte de lesiones reciente"}; la cuota justa es 1 dividido la chance.
      Debajo, la cuota de Stake de esa línea y cuánto paga de más (verde) o de menos según la app; la línea subrayada es la que tiene Stake. P+R, P+A y R+A son estimadas; los de "Más mercados" (robos, tapas, faltas, primer cuarto, doble-doble…) son aproximados.</p>`;
  pintarCombo();
}

// ---------------------------------------------------------------- U-23: cuotas de Stake
const casaDe = (pid, s) => A.casa?.mercados?.[String(pid)]?.[s] || null;
const casaLinea = (cm, L) => (cm ? cm.lineas[String(L)] || null : null);
function barraCasa() {
  const c = A.casa;
  if (!c) return "";
  if (c.activo === false) return "";
  const hora = c.leida_utc ? new Date(c.leida_utc).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : null;
  const n = Object.keys(c.mercados || {}).length;
  if (c.verificar) return `<div class="ab-casa fila ambar"><span class="ab-casa-txt ambar">Stake pide verificar que sos humano: marcá la casilla en la ventana de Stake que se abrió. Después se oculta sola y siguen las cuotas.</span></div>`;
  const txt = c.actualizando && !hora ? "Leyendo las cuotas de Stake…"
    : hora ? `Cuotas de Stake de las ${hora} (${n} jugador${n === 1 ? "" : "es"})${c.actualizando ? ", leyendo de nuevo…" : ""}`
    : c.empezo ? "El partido ya empezó: Stake solo da cuotas antes del partido." : "Todavía no hay cuotas de Stake para este partido.";
  const sin = (c.sin_cruzar || []).length ? ` <span class="apagado" title="${esc(c.sin_cruzar.join(", "))}">${c.sin_cruzar.length} sin cruzar</span>` : "";
  return `<div class="ab-casa fila"><span class="ab-casa-txt">${esc(txt)}${sin}</span>${c.error ? `<span class="ambar" title="${esc(c.error)}">No se pudo leer Stake</span>` : ""}
    <span class="espacio"></span>${c.empezo ? "" : '<button class="enlace" data-abcasa>Actualizar</button>'}</div>`;
}
function esperarCasa(caja, gid, intentos = 0) {
  if (!(A.casa?.actualizando || A.casa?.verificar) || intentos > 60) return;
  setTimeout(async () => {
    if (S.ruta.s !== "partido" || S.ruta.id !== gid || A.gid !== gid) return;
    const antes = A.casa?.leida_utc;
    const c = await llamar("lineas_partido", gid, false).catch(() => null);
    if (!c || A.gid !== gid) return;
    c.actualizando = c.leida_utc === antes && !c.error && intentos < 8;
    A.casa = c;
    if (document.body.contains(caja) && caja.querySelector(".ab-grilla")) pintarApostar(caja);
    esperarCasa(caja, gid, intentos + 1);
  }, 4000);
}

function columnaEquipo(e) {
  return `<section class="tarjeta ab-equipo" style="--c-eq:${colorBase(e.team_id)}">
    <div class="fila ab-eq-cab">${logoMini(e.team_id)}<b>${esc(e.tricode)}</b><span class="apagado">${e.local ? "local" : "visitante"}</span></div>
    ${e.jugadores.length ? e.jugadores.map(filaJugadorA).join("") : '<div class="apagado">Sin jugadores con minutos.</div>'}
  </section>`;
}

function filaJugadorA(j) {
  const ab = A.abiertos.has(j.player_id);
  const prom = (s) => (j.mercados[s] ? nf1.format(j.mercados[s].base) : "—");
  return `<div class="ab-jug${ab ? " abierto" : ""}${j.afuera ? " afuera" : ""}">
    <button class="ab-jug-cab" data-abjug="${j.player_id}" aria-expanded="${ab}">${avatarJ(j.player_id, j.nombre, "chico")}
      <span class="ab-jug-nom"><b>${esc(j.nombre)}</b><span class="apagado">${esc(j.pos || "")}${j.min ? ` · ${nf0.format(j.min)} min` : ""}${j.dudoso ? ' · <span class="ambar">dudoso</span>' : ""}${j.afuera ? ' · <span class="menos">afuera</span>' : ""}</span></span>
      <span class="ab-jug-prom apagado">${prom("pts")} PTS · ${prom("reb")} REB · ${prom("ast")} AST</span>
      <span class="u-flecha">${ab ? "▾" : "▸"}</span></button>
    ${ab ? `<div class="ab-mercados">${j.porque ? `<div class="ab-porque apagado">${textoPorque({ ...j.porque, puesto: j.porque.puesto?.pra || null, puesto_stat: "pra" })}</div>` : ""}${j.sin_modelo ? `<p class="apagado ab-sm">${j.afuera ? "Figura afuera en el reporte de lesiones. " : ""}${j.partidos < 10 && !j.afuera
        ? `Lleva ${j.partidos} partido${j.partidos === 1 ? "" : "s"} esta temporada: ` : ""}la chance sale de su promedio de los últimos 10, sin los factores del día.</p>` : ""}
      ${MERC.filter(([s]) => j.mercados[s] && !MERC_EXTRA[s]).map(([s]) => filaMercado(j, s)).join("")}
      ${MERC.some(([s]) => j.mercados[s] && MERC_EXTRA[s]) ? `<div class="ab-sub apagado" title="La chance de estos sale de su promedio y de cuánto varía en sus últimos 20 partidos, sin los factores del día. Primer cuarto: lo que hizo en el 1.º cuarto. Primer canasto: el primer doble o triple del partido (los libres no cuentan).">Más mercados <small>(chance aproximada)</small></div>
        ${MERC.filter(([s]) => j.mercados[s] && MERC_EXTRA[s]).map(([s]) => filaMercado(j, s)).join("")}` : ""}</div>` : ""}
  </div>`;
}

function filaMercado(j, s) {
  const mk = j.mercados[s];
  const clave = `${j.player_id}|${s}`;
  const cm = casaDe(j.player_id, s);
  const L = A.lineas[clave] ?? cm?.principal ?? mk.casa;
  const cl = casaLinea(cm, L);
  const pmApp = chanceMasA(mk, s, L);
  const pm = mezclaMas(pmApp, cl);          // M-17: lo que se muestra y con lo que se mide el valor
  // M-14: la app y Stake ven un partido muy distinto: casi siempre la casa sabe algo (una baja, un cambio de titulares)
  const alarma = cm && cm.principal != null && mk.E != null && Math.abs(mk.E - cm.principal) >= 0.25 * Math.max(cm.principal, 4);
  const arriba = mk.hist.filter((v) => v > L).length;
  const combo = comboDe(A.gid);
  const elegido = combo.patas.find((x) => x.player_id === j.player_id && x.stat === s && x.linea === L);
  const siNo = SI_NO.has(s);
  // M-17: los dos lados a la vista (en Stake los Menos vienen pagando mejor que los Más)
  const btn = (lado, ch) => `<button class="ab-lado ${lado}${elegido?.lado === lado ? " activo" : ""}" data-abelegir="${j.player_id}|${s}|${lado}">
      <span class="ab-lado-n">${siNo ? (lado === "mas" ? "Sí" : "No") : lado === "mas" ? "Más" : "Menos"}</span>
      <b class="ab-lado-ch${ch >= 0.6 ? " mas" : ""}" title="Chance ${nf0.format(ch * 100)}%: la cuota justa sería ${cuotaJ(ch)}">${nf0.format(ch * 100)}%</b>
      ${alarma && cl && cl[lado] ? `<small class="ab-q"><b>${nfC.format(cl[lado])}</b><span class="ambar">⚠</span></small>` : cuotaCasa(cl, lado, ch)}</button>`;
  const n = mk.hist.length;
  const titulo = siNo ? (n ? `Le pasó en ${arriba} de sus últimos ${n}` : "Sale de su parte de los puntos del equipo y de si suele ser titular")
    : `Promedio ${nf1.format(mk.base)}${mk.aprox ? "" : `, la app espera ${nf1.format(mk.E)}`}. Superó ${lin(L)} en ${arriba} de sus últimos ${n}`;
  const resumen = siNo ? (n ? `${arriba}/${n}` : "") : `${nf1.format(mk.base)} · ${arriba}/${n}`;
  const tituloLinea = cm ? `Stake: principal ${lin(cm.principal)}${cl && cl.prob != null ? `; a esta línea la app le da ${nf0.format(pmApp * 100)}% al Más y Stake ${nf0.format(cl.prob * 100)}% (corregida con lo que viene saliendo, ${nf0.format(corregirStake(A.casa?.corr, cl.prob) * 100)}%). La chance que ves es la mezcla` : "; Stake no tiene esta línea: la chance es la de la app"}` : "Sin cuotas de Stake: la chance es la de la app";
  return `<div class="ab-merc${mk.aprox ? " aprox" : ""}" data-abm="${clave}">
    <span class="ab-merc-nom" title="${esc(alarma ? `La app espera ${nf1.format(mk.E)} y Stake puso la línea en ${lin(cm.principal)}: casi siempre la casa sabe algo (una baja, un cambio de titulares). Revisá las bajas antes de apostar.` : titulo)}">${NOM_MERC[s]}${ESTIMADA.has(s) ? "*" : ""}${alarma ? ' <span class="ambar">⚠</span>' : ""}<small class="apagado">${resumen}</small></span>
    ${siNo ? '<span class="ab-linea ab-linea-sn apagado">Sí / No</span>'
      : `<span class="ab-linea${cl ? " en-casa" : ""}" title="${esc(tituloLinea)}"><button class="ab-paso" data-abpaso="${clave}|-1" aria-label="Bajar la línea">−</button><b>${lin(L)}</b><button class="ab-paso" data-abpaso="${clave}|1" aria-label="Subir la línea">+</button></span>`}
    ${btn("mas", pm)}${btn("menos", 1 - pm)}
  </div>`;
}

// la cuota de Stake de ese lado y si paga más de lo que vale para la app
function cuotaCasa(cl, lado, ch) {
  const q = cl ? cl[lado] : null;
  if (!q || cl.susp) return cl?.susp ? '<small class="ab-q apagado">Stake suspendida</small>' : "";
  const v = ch * q - 1;
  return `<small class="ab-q" title="Cuota de Stake ${nfC.format(q)}: con la mezcla de la app y Stake ${v >= 0 ? "paga" : "le falta"} ${nf0.format(Math.abs(v) * 100)}% ${v >= 0 ? "más de lo que vale" : "para lo que vale"}"><b>${nfC.format(q)}</b><span class="ab-v ${v >= 0.03 ? "mas" : "neutro"}">${v >= 0 ? "+" : "−"}${nf0.format(Math.abs(v) * 100)}%</span></small>`;
}

// ---------------------------------------------------------------- M-17: Stake corregida, mezcla y aviso de patas
function corregirStake(corr, p) {
  if (p == null || !corr || !corr.length) return p;
  let d = corr[corr.length - 1][1];
  if (p <= corr[0][0]) d = corr[0][1];
  else for (let i = 1; i < corr.length; i++) if (p <= corr[i][0]) { const [x0, d0] = corr[i - 1], [x1, d1] = corr[i]; d = x1 > x0 ? d0 + ((d1 - d0) * (p - x0)) / (x1 - x0) : d0; break; }
  return Math.min(0.99, Math.max(0.01, p + d));
}
// la chance con la que se mide el valor: mitad la app y mitad Stake corregida (si Stake tiene la línea)
function mezclaMas(pm, cl) {
  if (!cl || cl.prob == null || cl.susp) return pm;
  return 0.5 * pm + 0.5 * corregirStake(A.casa?.corr, cl.prob);
}
async function cargarCal() {
  if (S.cal || S.calPidiendo) return S.cal;
  S.calPidiendo = true;
  try { S.cal = await llamar("calibracion"); } catch (e) { /* sin datos todavía */ }
  S.calPidiendo = false;
  return S.cal;
}
function avisoPatas(n) {
  if (n < 2) return "";
  const p = S.cal?.patas;
  const partes = [];
  if (p && p.n >= 30 && p.acierto) {
    const cada = Math.round(1 / Math.pow(p.acierto, n));
    partes.push(`Con tu acierto real por pata (${nf0.format(p.acierto * 100)}%, ${p.n} patas en Unidades), una combinada de ${n} sale <b>1 de cada ${nf0.format(cada)}</b>.`);
  }
  if (n > 4) partes.push('<span class="ambar">Más de 4 patas: el margen de la casa se multiplica en cada una.</span>');
  return partes.length ? `<p class="apagado ab-aviso ab-aviso-patas">${partes.join(" ")}</p>` : "";
}
setTimeout(() => cargarCal().catch(() => {}), 2500);

// ---------------------------------------------------------------- combinada del partido y ticket
function comboDe(gid) {
  S.prefs.combos = S.prefs.combos || {};
  if (!S.prefs.combos[gid]) S.prefs.combos[gid] = { patas: [], cuota: "" };
  return S.prefs.combos[gid];
}
function ticket() {
  S.prefs.ticket = S.prefs.ticket || { bloques: [], cuota: "", unidades: S.prefs.unid_ultima ?? 1, casa: "Stake", nota: "" };
  return S.prefs.ticket;
}
const chanceCombo = (patas) => patas.reduce((a, x) => a * x.chance, 1);
// U-24: la cuota se calcula sola con las cuotas de Stake de cada pata; si se escribe una a mano, manda esa
const cuotaAuto = (patas) => (patas.length && patas.every((x) => x.cuota_casa > 1) ? patas.reduce((a, x) => a * x.cuota_casa, 1) : null);
const cuotaBloque = (b) => numero(b.cuota) || cuotaAuto(b.patas);
const fmtQ = (q) => (q ? nfC.format(q) : "");
function origenCuota(manual, auto, patas, attr) {
  if (manual) return `<small class="ab-origen">a mano${auto ? ` · <a href="#" class="enlace" ${attr}>usar la de Stake (${nfC.format(auto)})</a>` : ""}</small>`;
  if (auto) return '<small class="ab-origen">calculada con Stake</small>';
  const faltan = patas.filter((x) => !(x.cuota_casa > 1)).length;
  return `<small class="ab-origen ambar">${faltan} pata${faltan === 1 ? "" : "s"} sin cuota de Stake: escribila a mano</small>`;
}

function pintarCombo() {
  const caja = $("#ab-combo");
  if (!caja) return;
  const c = comboDe(A.gid);
  const ch = chanceCombo(c.patas);
  const auto = cuotaAuto(c.patas);
  const q = numero(c.cuota) || auto;
  const t = ticket();
  caja.innerHTML = `<section class="tarjeta ab-combo">
    <div class="fila"><h2 style="margin:0">Combinada del partido</h2><span class="espacio"></span><span class="apagado">${c.patas.length} pata${c.patas.length === 1 ? "" : "s"}</span></div>
    ${c.patas.length ? `<div class="ab-patas">${c.patas.map((x, i) => `<div class="ab-pata"><span><b>${esc(x.jugador)}</b> ${esc(textoPataA(x))}${x.cuota_casa ? ` <span class="apagado">· Stake ${nfC.format(x.cuota_casa)}</span>` : ""}</span>
        <span class="apagado">${nf0.format(x.chance * 100)}%</span><button class="boton-menu" data-abquitar="${i}" title="Quitar">✕</button></div>`).join("")}</div>
      <div class="ab-tot"><div><span class="apagado">Chance de que salgan todas</span><b>${nf0.format(ch * 100)}%</b><span class="apagado">cuota justa ${cuotaJ(ch)}</span></div>
        <label class="campo"><span>Cuota</span><input class="control" data-abcuota inputmode="decimal" placeholder="a mano" value="${esc(String(c.cuota || fmtQ(auto)))}">
          <span id="ab-origen">${origenCuota(numero(c.cuota), auto, c.patas, "data-abauto")}</span></label></div>
      <div class="ab-valor" id="ab-valor">${textoValor(ch, q)}</div>
      ${c.patas.length > 1 ? '<p class="apagado ab-aviso">Las patas del mismo partido no son independientes: si el partido se escapa, suelen fallar juntas.</p>' : ""}
      ${avisoPatas(c.patas.length)}
      <div class="fila" style="margin-top:8px"><button class="enlace" data-abvaciar>Vaciar</button><span class="espacio"></span>
        <button class="boton primario" data-abticket>Agregar al ticket</button></div>`
    : '<p class="apagado" style="margin:8px 0 0">Desplegá un jugador y tocá Más o Menos en el mercado que quieras.</p>'}
  </section>
  ${t.bloques.length ? `<section class="tarjeta ab-ticket-mini"><div class="fila"><b>Ticket</b><span class="apagado">${t.bloques.length} combinada${t.bloques.length === 1 ? "" : "s"}, ${t.bloques.reduce((a, b) => a + b.patas.length, 0)} patas</span>
      <span class="espacio"></span><button class="boton" data-ticket="abrir">Ver ticket</button></div>
      ${t.bloques.map((b) => `<div class="apagado ab-tm">${esc(b.partido)}: ${b.patas.map((x) => esc(x.jugador.split(" ").slice(-1)[0])).join(", ")}</div>`).join("")}</section>` : ""}`;
}

function textoValor(ch, q) {
  if (!q) return "";
  const v = ch * q - 1;
  return `<span class="${v >= 0 ? "mas" : "menos"}">${v >= 0 ? "A favor" : "En contra"}: ${v >= 0 ? "+" : "−"}${nf0.format(Math.abs(v) * 100)}%</span>`;
}

function pintarBarraTicket() {
  let el = $("#ticket-barra");
  const t = S.prefs?.ticket;
  const n = t?.bloques?.length || 0;
  if (!n) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "ticket-barra"; el.className = "carrito ticket-barra"; document.body.appendChild(el); entrar(el); }
  el.innerHTML = `<div class="carrito-txt"><b>Ticket en armado</b><span class="apagado">${n} combinada${n === 1 ? "" : "s"}: ${t.bloques.map((b) => esc(b.partido)).join(", ")}</span></div>
    <button class="boton primario" data-ticket="abrir">Ver ticket</button>`;
}

function abrirTicket() {
  document.querySelectorAll(".ticket-fondo").forEach((x) => x.remove());
  const t = ticket();
  const fondo = document.createElement("div");
  fondo.className = "dialogo-fondo ticket-fondo";
  document.body.appendChild(fondo);
  const pintar = () => {
    const prod = productoTicket(t);
    fondo.innerHTML = `<div class="dialogo ticket-dialogo" role="dialog" aria-label="Ticket">
      <div class="fila"><h2 style="margin:0">Ticket</h2><span class="espacio"></span><span class="apagado">${t.bloques.length} combinada${t.bloques.length === 1 ? "" : "s"}</span></div>
      <div class="tk-bloques">${t.bloques.map((b, i) => `<div class="tk-bloque">
        <div class="fila"><b>${i + 1}. ${esc(b.partido)}</b><span class="espacio"></span>
          <label class="tk-cuota">cuota <input class="control" data-tkcuota="${i}" inputmode="decimal" placeholder="a mano" value="${esc(String(b.cuota || fmtQ(cuotaAuto(b.patas))))}"></label>
          <button class="boton-menu" data-tkquitar="${i}" title="Sacar esta combinada">✕</button></div>
        ${b.patas.map((x) => `<div class="tk-pata">${esc(x.jugador)} ${esc(textoPataA(x))} <span class="apagado">${nf0.format(x.chance * 100)}%${x.cuota_casa ? ` · Stake ${nfC.format(x.cuota_casa)}` : ""}</span></div>`).join("")}
        <div class="tk-origen" data-tkorigen="${i}">${origenCuota(numero(b.cuota), cuotaAuto(b.patas), b.patas, `data-tkauto="${i}"`)}</div>
      </div>`).join("")}</div>
      <div class="tk-totales">
        <label class="campo"><span>Cuota total</span><input class="control" data-tk="cuota" inputmode="decimal" placeholder="a mano" value="${esc(String(t.cuota || fmtQ(prod)))}">
          <span data-tkorigen="total">${origenTotal(t)}</span></label>
        <label class="campo"><span>Unidades</span><input class="control" data-tk="unidades" inputmode="decimal" value="${esc(String(t.unidades ?? 1))}"></label>
        <label class="campo"><span>Casa</span><input class="control" data-tk="casa" value="${esc(t.casa || "")}"></label>
      </div>
      <div class="tk-resumen" id="tk-resumen">${resumenTicket(t)}</div>
      <label class="campo" style="margin-top:8px"><span>Nota</span><input class="control" data-tk="nota" value="${esc(t.nota || "")}" placeholder="opcional"></label>
      <div class="u-error" role="alert"></div>
      <div class="fila" style="margin-top:12px"><button class="enlace" data-tkvaciar>Vaciar ticket</button><span class="espacio"></span>
        <button class="boton" data-tkcerrar>Seguir armando</button><button class="boton primario" data-tkguardar>Guardar apuesta</button></div>
    </div>`;
  };
  pintar();
  fondo.addEventListener("input", (e) => {
    const x = e.target;
    if (x.dataset.tkcuota != null) {
      const i = Number(x.dataset.tkcuota), b = t.bloques[i], auto = cuotaAuto(b.patas);
      b.cuota = auto && numero(x.value) === Number(auto.toFixed(2)) ? "" : x.value;
      const o = fondo.querySelector(`[data-tkorigen="${i}"]`); if (o) o.innerHTML = origenCuota(numero(b.cuota), auto, b.patas, `data-tkauto="${i}"`);
    } else if (x.dataset.tk === "cuota") {
      const pr = productoTicket(t);
      t.cuota = pr && numero(x.value) === Number(pr.toFixed(2)) ? "" : x.value;
    } else if (x.dataset.tk) t[x.dataset.tk] = x.value;
    guardarPrefs();
    const r = fondo.querySelector("#tk-resumen"); if (r) r.innerHTML = resumenTicket(t);
    const tot = fondo.querySelector("[data-tk=cuota]"), pr = productoTicket(t);
    if (tot && !numero(t.cuota) && x.dataset.tk !== "cuota") tot.value = fmtQ(pr);    // el total sigue a las combinadas mientras no sea a mano
    const ot = fondo.querySelector('[data-tkorigen="total"]'); if (ot) ot.innerHTML = origenTotal(t);
  });
  fondo.addEventListener("click", async (e) => {
    const x = e.target;
    if (x === fondo || x.closest("[data-tkcerrar]")) { fondo.remove(); return; }
    const ta = x.closest("[data-tkauto]");
    if (ta) { e.preventDefault(); const v = ta.dataset.tkauto; if (v === "total") t.cuota = ""; else t.bloques[Number(v)].cuota = ""; guardarPrefs(); return pintar(); }
    const q = x.closest("[data-tkquitar]");
    if (q) { t.bloques.splice(Number(q.dataset.tkquitar), 1); guardarPrefs(); pintarBarraTicket(); if (!t.bloques.length) { fondo.remove(); pintarCombo(); return; } return pintar(); }
    if (x.closest("[data-tkvaciar]")) {
      if (await confirmar("¿Vaciar el ticket?", "Se sacan todas las combinadas que agregaste.", "Vaciar")) { S.prefs.ticket = null; guardarPrefs(); fondo.remove(); pintarBarraTicket(); pintarCombo(); }
      return;
    }
    if (x.closest("[data-tkguardar]")) {
      const r2 = (q) => (q ? Math.round(q * 100) / 100 : q);              // como las muestra Stake
      const total = r2(numero(t.cuota) || productoTicket(t));
      const piernas = t.bloques.flatMap((b, gi) => b.patas.map((p) => ({ deporte: "NBA", player_id: p.player_id, game_id: b.game_id, stat: p.stat,
        linea: p.linea, lado: p.lado, cuota: b.patas.length === 1 ? (r2(cuotaBloque(b)) || null) : (r2(p.cuota_casa) || null), grupo: t.bloques.length > 1 || b.patas.length > 1 ? gi : null })));
      const datos = { cuota: total, unidades: t.unidades, casa: t.casa, nota: t.nota, piernas,
        grupos: t.bloques.map((b) => ({ partido: b.partido, game_id: b.game_id, cuota: r2(cuotaBloque(b)) })) };
      const r = await window.pywebview.api.guardar_apuesta(datos);
      if (r && r.error) { fondo.querySelector(".u-error").textContent = r.error.includes("cuota") ? "Poné la cuota total del ticket (la que te da la casa)." : r.error; return; }
      S.prefs.unid_ultima = numero(t.unidades) || 1;
      S.prefs.ticket = null; guardarPrefs();
      fondo.remove(); pintarBarraTicket(); pintarCombo();
      aviso("Ticket guardado en Unidades. Lo vas a poder seguir en vivo con las barritas.", 6000);
      if (S.ruta.s === "unidades") recargarUnidades();
    }
  });
}

function productoTicket(t) {
  const cuotas = t.bloques.map(cuotaBloque);
  return cuotas.length && cuotas.every((q) => q && q > 1) ? cuotas.reduce((a, b) => a * b, 1) : null;
}
function origenTotal(t) {
  const pr = productoTicket(t);
  if (numero(t.cuota)) return `<small class="ab-origen">a mano${pr ? ` · <a href="#" class="enlace" data-tkauto="total">usar la calculada (${nfC.format(pr)})</a>` : ""}</small>`;
  if (pr) return `<small class="ab-origen">${t.bloques.every((b) => !numero(b.cuota)) ? "calculada con Stake" : "multiplicando las combinadas"}</small>`;
  return '<small class="ab-origen ambar">escribila a mano</small>';
}
function resumenTicket(t) {
  const total = numero(t.cuota) || productoTicket(t);
  const ch = t.bloques.reduce((a, b) => a * chanceCombo(b.patas), 1);
  const u = numero(t.unidades);
  const nPatas = t.bloques.reduce((a, b) => a + b.patas.length, 0);
  return `${avisoPatas(nPatas)}<div><span class="apagado">Chance de que salga todo</span><b>${nf1.format(ch * 100)}%</b><span class="apagado">cuota justa ${cuotaJ(ch)}</span></div>
    ${total ? `<div><span class="apagado">Con cuota ${nfC.format(total)}</span><b class="${ch * total - 1 >= 0 ? "mas" : "menos"}">${ch * total - 1 >= 0 ? "+" : "−"}${nf0.format(Math.abs(ch * total - 1) * 100)}%</b>
      <span class="apagado">${u ? `a ganar ${nfU.format(u * (total - 1))} u` : ""}</span></div>` : ""}`;
}

// ---------------------------------------------------------------- eventos
document.addEventListener("click", async (e) => {
  const t = e.target;
  const tk = t.closest("[data-ticket]");
  if (tk) { e.preventDefault(); return abrirTicket(); }
  if (S.ruta?.s !== "partido" || !A.m || !$(".ab-grilla")) return;
  const jb = t.closest("[data-abjug]");
  if (jb) {
    const pid = Number(jb.dataset.abjug);
    if (A.abiertos.has(pid)) A.abiertos.delete(pid); else A.abiertos.add(pid);
    const cont = jb.closest(".ab-jug"), j = jugadorA(pid);
    cont.outerHTML = filaJugadorA(j);
    return;
  }
  if (t.closest("[data-abcasa]")) {
    const gid = A.gid, caja = t.closest(".ab-casa")?.parentElement;
    await llamar("actualizar_lineas", gid).catch(() => null);
    if (A.casa) { A.casa.actualizando = true; A.casa.error = null; }
    if (caja) { pintarApostar(caja); esperarCasa(caja, gid); }
    return;
  }
  const pa = t.closest("[data-abpaso]");
  if (pa) {
    const [pid, s, d] = pa.dataset.abpaso.split("|");
    const mk = jugadorA(Number(pid)).mercados[s], clave = `${pid}|${s}`;
    A.lineas[clave] = Math.max(0.5, (A.lineas[clave] ?? casaDe(pid, s)?.principal ?? mk.casa) + Number(d));
    return redibujarMercado(Number(pid), s);
  }
  const el = t.closest("[data-abelegir]");
  if (el) {
    const [pid, s, lado] = el.dataset.abelegir.split("|");
    const j = jugadorA(Number(pid)), mk = j.mercados[s], L = A.lineas[`${pid}|${s}`] ?? casaDe(pid, s)?.principal ?? mk.casa;
    const cq = casaLinea(casaDe(j.player_id, s), L);
    const pm = mezclaMas(chanceMasA(mk, s, L), cq);
    const c = comboDe(A.gid);
    const i = c.patas.findIndex((x) => x.player_id === j.player_id && x.stat === s);
    const nueva = { player_id: j.player_id, jugador: j.nombre, stat: s, linea: L, lado, chance: lado === "mas" ? pm : 1 - pm, cuota_casa: cq && !cq.susp ? cq[lado] : null };
    if (i >= 0 && c.patas[i].lado === lado && c.patas[i].linea === L) c.patas.splice(i, 1);       // tocar de nuevo la saca
    else if (i >= 0) c.patas[i] = nueva; else c.patas.push(nueva);
    guardarPrefs(); redibujarMercado(j.player_id, s); return pintarCombo();
  }
  if (t.closest("[data-abauto]")) { e.preventDefault(); comboDe(A.gid).cuota = ""; guardarPrefs(); return pintarCombo(); }
  const q = t.closest("[data-abquitar]");
  if (q) { const c = comboDe(A.gid); const x = c.patas.splice(Number(q.dataset.abquitar), 1)[0]; guardarPrefs(); if (x) redibujarMercado(x.player_id, x.stat); return pintarCombo(); }
  if (t.closest("[data-abvaciar]")) { const c = comboDe(A.gid); const viejas = c.patas.splice(0); guardarPrefs(); viejas.forEach((x) => redibujarMercado(x.player_id, x.stat)); return pintarCombo(); }
  if (t.closest("[data-abticket]")) {
    const c = comboDe(A.gid);
    if (!c.patas.length) return;
    const tk = ticket();
    const ya = tk.bloques.findIndex((b) => b.game_id === A.gid);
    const bloque = { game_id: A.gid, partido: A.m.partido, cuota: c.cuota || "", patas: c.patas.slice() };
    if (ya >= 0) tk.bloques[ya] = bloque; else tk.bloques.push(bloque);
    S.prefs.combos[A.gid] = { patas: [], cuota: "" };
    guardarPrefs(); pintarBarraTicket();
    aviso(ya >= 0 ? "Combinada actualizada en el ticket." : `Combinada agregada al ticket (${tk.bloques.length}). Pasá a otro partido o abrí el ticket para guardarlo.`, 6000);
    pintarApostar($("#pt-panel"));
  }
});
document.addEventListener("input", (e) => {
  if (!e.target.matches("[data-abcuota]")) return;
  const c = comboDe(A.gid);
  const auto = cuotaAuto(c.patas);
  // escribir lo mismo que calculó Stake no la vuelve "a mano"
  c.cuota = auto && numero(e.target.value) === Number(auto.toFixed(2)) ? "" : e.target.value; guardarPrefs();
  const v = $("#ab-valor"); if (v) v.innerHTML = textoValor(chanceCombo(c.patas), numero(c.cuota) || auto);
  const o = $("#ab-origen"); if (o) o.innerHTML = origenCuota(numero(c.cuota), auto, c.patas, "data-abauto");
});

function jugadorA(pid) { for (const e of A.m.equipos) { const j = e.jugadores.find((x) => x.player_id === pid); if (j) return j; } return null; }
function redibujarMercado(pid, s) {
  const el = document.querySelector(`[data-abm="${pid}|${s}"]`);
  if (el) el.outerHTML = filaMercado(jugadorA(pid), s);
}
setTimeout(() => { try { pintarBarraTicket(); } catch (e) { /* sin prefs todavía */ } }, 1500);
