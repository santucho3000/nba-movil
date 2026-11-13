"use strict";
/* Stats NBA - glosario de abreviaturas (N-07).
   Pie de la ventana con el glosario completo (con buscador) y el significado de cada
   abreviatura al pasar el mouse por encabezados de tablas, tarjetas y botones. */

// [abreviaturas que aparecen en pantalla, significado, grupo]
const GLOSARIO = [
  [["PJ"], "Partidos jugados.", "Básicas"],
  [["MIN"], "Minutos jugados. En el gráfico, en ámbar cuando jugó menos del 75% de su promedio.", "Básicas"],
  [["PTS"], "Puntos.", "Básicas"],
  [["REB"], "Rebotes totales.", "Básicas"],
  [["REB OF"], "Rebotes ofensivos (en el aro rival).", "Básicas"],
  [["REB DEF"], "Rebotes defensivos (en el aro propio).", "Básicas"],
  [["AST"], "Asistencias: pases que terminan en un doble o triple convertido.", "Básicas"],
  [["ROB"], "Robos.", "Básicas"],
  [["TAP"], "Tapas (tapones).", "Básicas"],
  [["PÉR"], "Pérdidas de pelota.", "Básicas"],
  [["FAL"], "Faltas personales cometidas.", "Básicas"],
  [["+/-"], "Diferencia de puntos del equipo mientras el jugador estuvo en cancha.", "Básicas"],
  [["PRA", "PTS+REB+AST"], "Puntos + rebotes + asistencias.", "Combos"],
  [["P+R"], "Puntos + rebotes.", "Combos"],
  [["P+A"], "Puntos + asistencias.", "Combos"],
  [["R+A"], "Rebotes + asistencias.", "Combos"],
  [["ROB+TAP"], "Robos + tapas.", "Combos"],
  [["TC"], "Tiros de campo (dobles y triples): convertidos-intentados.", "Tiro"],
  [["TCI"], "Tiros de campo intentados.", "Tiro"],
  [["TC%"], "Porcentaje de tiros de campo convertidos.", "Tiro"],
  [["3P", "3PM"], "Triples: 3P = convertidos-intentados; 3PM = convertidos.", "Tiro"],
  [["3PA"], "Triples intentados.", "Tiro"],
  [["3P%"], "Porcentaje de triples.", "Tiro"],
  [["TL"], "Tiros libres: convertidos-intentados.", "Tiro"],
  [["TL%"], "Porcentaje de tiros libres.", "Tiro"],
  [["TS%"], "True shooting: eficiencia de tiro que cuenta dobles, triples y libres. PTS / (2 × (TCI + 0,44 × TL intentados)).", "Avanzadas"],
  [["eFG%"], "Porcentaje de campo efectivo: el triple vale 1,5 tiros convertidos.", "Avanzadas"],
  [["USG%"], "Uso: porcentaje de las jugadas del equipo que termina el jugador (tiro, libres o pérdida) mientras está en cancha.", "Avanzadas"],
  [["ORtg"], "Rating ofensivo: puntos que anota el equipo cada 100 posesiones con el jugador en cancha.", "Avanzadas"],
  [["DRtg"], "Rating defensivo: puntos que recibe el equipo cada 100 posesiones con el jugador en cancha.", "Avanzadas"],
  [["PIE"], "Impacto del jugador: porcentaje de los eventos del partido (puntos, rebotes, asistencias…) que le corresponden.", "Avanzadas"],
  [["Ch. REB", "Chances de REB"], "Chances de rebote: veces que estuvo cerca (a 3,5 pies o menos) de un rebote. Es el valor potencial de REB.", "Tracking"],
  [["Ch. REB OF", "Ch. REB DEF"], "Chances de rebote ofensivas / defensivas.", "Tracking"],
  [["% conv. REB"], "Rebotes conseguidos sobre chances de rebote.", "Tracking"],
  [["% REB contestados"], "Parte de sus rebotes que tomó con un rival cerca.", "Tracking"],
  [["AST pot.", "AST potenciales"], "Asistencias potenciales: pases a un compañero que tira; si el tiro entraba, era asistencia. Es el valor potencial de AST.", "Tracking"],
  [["% conv. AST"], "Asistencias sobre asistencias potenciales (con tope en 100%).", "Tracking"],
  [["AST sec."], "Asistencias secundarias: el pase previo a la asistencia.", "Tracking"],
  [["AST TL"], "Asistencias de tiro libre: pases que terminan en falta y libres convertidos.", "Tracking"],
  [["Pases"], "Pases realizados.", "Tracking"],
  [["Toques"], "Veces que tocó la pelota en ataque.", "Tracking"],
  [["Drives"], "Avances con pique hacia el aro que terminan cerca de la canasta.", "Tracking"],
  [["Catch & shoot"], "Tiros recibiendo y tirando sin picar la pelota.", "Tracking"],
  [["Pull-up"], "Tiros después de picar la pelota.", "Tracking"],
  [["Conv."], "Conversión: logrado / potencial (por ejemplo 8/11 = 73%).", "Gráficos"],
  [["Potencial"], "Contorno blanco del gráfico: chances de rebote, asistencias potenciales o intentos.", "Gráficos"],
  [["Línea"], "Línea de referencia: mediana llevada a .5, promedio o un valor propio. Verde si la superó, rojo si no.", "Gráficos"],
  [["Mediana"], "Valor del medio de la serie. Como línea se lleva a .5 hacia el lado que deja cerca de la mitad de los partidos por encima.", "Gráficos"],
  [["Últ. 5", "Últ. 10", "Últ. 20"], "Últimos 5, 10 o 20 partidos dentro de los filtros.", "Filtros"],
  [["Tit."], "Titular (salió en el quinteto inicial).", "Partido"],
  [["Desc.", "Descanso"], "Días sin jugar del equipo antes del partido.", "Partido"],
  [["B2B"], "Back-to-back: jugó el día anterior (0 días de descanso).", "Partido"],
  [["Res."], "Resultado: G ganó, P perdió, con el marcador.", "Partido"],
  [["Margen"], "Diferencia final de puntos a favor (+) o en contra (−).", "Partido"],
  [["vs", "@"], "vs = de local · @ = de visitante.", "Partido"],
  [["Palizas"], "Partidos con margen final igual o mayor al elegido (20 por defecto).", "Filtros"],
  [["Clutch"], "Últimos 5 minutos del partido (o la prórroga) con diferencia de 5 puntos o menos.", "Situaciones"],
  [["Pos."], "Play types: posesiones por partido terminadas con ese tipo de jugada.", "Play types"],
  [["Frec."], "Play types: frecuencia, parte de sus posesiones que son de ese tipo.", "Play types"],
  [["Pts/pos."], "Play types: puntos por posesión.", "Play types"],
  [["Percentil"], "Play types: porcentaje de jugadores de la liga a los que supera en puntos por posesión.", "Play types"],
  [["Desvíos"], "Hustle: pases o piques rivales tocados.", "Hustle"],
  [["Tiros contestados"], "Hustle: tiros rivales que defendió de cerca.", "Hustle"],
  [["Box outs"], "Hustle: veces que bloqueó a un rival para el rebote.", "Hustle"],
  [["Pelotas sueltas"], "Hustle: pelotas sueltas recuperadas.", "Hustle"],
  [["Bloqueos con gol"], "Hustle: cortinas que liberaron a un compañero que convirtió (screen assists).", "Hustle"],
  [["Cargas recibidas"], "Hustle: faltas en ataque provocadas.", "Hustle"],
  [["Eq."], "Equipo.", "Básicas"],
  [["G", "P"], "En posiciones y récords: partidos ganados y perdidos. Como posición: G = base o escolta.", "Equipos"],
  [["%"], "Porcentaje de partidos ganados.", "Equipos"],
  [["Dif."], "Partidos de diferencia con el primero de la conferencia (o la división).", "Equipos"],
  [["Racha"], "Racha actual: G3 = tres victorias seguidas, P2 = dos derrotas seguidas.", "Equipos"],
  [["Conf."], "Récord contra equipos de la misma conferencia.", "Equipos"],
  [["Local", "Visit."], "Récord de local y de visitante.", "Equipos"],
  [["PF", "PC"], "Puntos a favor y en contra por partido.", "Equipos"],
  [["Neto"], "Rating neto: puntos a favor menos puntos en contra cada 100 posesiones.", "Equipos"],
  [["Pace"], "Ritmo: posesiones por partido (48 minutos).", "Equipos"],
  [["PTS perm.", "PERM.", "Permitido"], "Lo que hizo el rival contra este equipo (puntos, rebotes… permitidos).", "Equipos"],
  [["Total", "Total partido"], "Puntos de los dos equipos sumados.", "Equipos"],
  [["Puesto"], "Lugar entre los 30 equipos. En lo propio, 1º = el mejor; en lo permitido, 1º = el que más permite (verde).", "Equipos"],
  [["Récord"], "Partidos ganados y perdidos con los filtros elegidos.", "Equipos"],
  [["En alza", "En baja"], "Rachas: stats en las que el jugador superó su línea en el 75% o más de los últimos 5 o de los últimos 10 (en baja: 25% o menos). Se ordenan por cuánto suben contra su base: 0,4 × (últ. 5 − base) + 0,6 × (últ. 10 − base).", "Rachas"],
  [["Señal"], "Señales: la chance de que un jugador pase (o no) una línea en su próximo partido, por minutos recientes, compañeros que faltan, el rival, el ritmo y el contexto. Se muestran desde 55%; fuertes, 65% o más.", "Señales"],
  [["Chance"], "Señales: qué tan seguido debería cumplirse, calibrado con temporadas que el modelo no vio (si dice 70%, en la prueba se cumplió cerca del 70%). Tiene en cuenta cuánto varía el jugador de un partido a otro.", "Señales"],
  [["Cuota justa"], "Señales: 1 dividido la chance. Si la casa paga más que esto, la apuesta tiene valor; si paga menos, no conviene.", "Señales"],
  [["Línea de referencia"], "Señales: la línea que elige la app para cada jugador, donde uno así queda arriba y abajo parecido. La de tu casa puede ser otra: probala en Línea y cuota.", "Señales"],
  [["3PM"], "Triples metidos.", "Señales"],
  [["TCI"], "Tiros de campo intentados.", "Señales"],
  [["TCM"], "Tiros de campo metidos.", "Señales"],
  [["3PA"], "Triples intentados.", "Señales"],
  [["Unidad", "u"], "Unidades: la medida fija de lo que apostás. El valor en plata se configura arriba a la derecha (1 u = $…).", "Unidades"],
  [["Yield"], "Unidades: resultado dividido lo apostado en las apuestas resueltas. +10% = ganaste 0,10 u por cada unidad apostada.", "Unidades"],
  [["Parlay", "Pierna"], "Unidades: combinada de varias piernas. Se pierde apenas falla una y se gana cuando aciertan todas; las nulas se sacan y la cuota se recalcula si se conoce la suya.", "Unidades"],
  [["Nula"], "Unidades: apuesta o pierna que se devuelve: el jugador no jugó o el valor dio justo la línea. Resultado 0.", "Unidades"],
  [["Peor caída"], "Unidades: la bajada más grande desde un máximo hasta el punto más bajo que le siguió.", "Unidades"],
  [["Base"], "Rachas: de dónde sale la línea. Su temporada actual o, si todavía tiene menos de 10 partidos, la pasada (fase regular).", "Rachas"],
  [["Sostenible"], "Rachas: subió el promedio y también su potencial (chances de rebote, asistencias potenciales, triples o tiros intentados). Tiene base.", "Rachas"],
  [["Posible suerte"], "Rachas: subió el promedio pero no su potencial: está convirtiendo más de lo habitual y puede volver a su nivel.", "Rachas"],
  [["Baja real"], "Rachas: bajó el promedio y también su potencial: tiene menos oportunidades.", "Rachas"],
  [["Posible mala suerte"], "Rachas: bajó el promedio pero no su potencial: le está entrando menos de lo habitual.", "Rachas"],
  [["Últimos 10"], "Rachas: cuadraditos de los últimos 10 partidos, del más viejo al más reciente. Verde si superó la línea, rojo si no.", "Rachas"],
  [["Prom. últ. 5"], "Promedio de los últimos 5 partidos y, al lado, el de su base (la temporada, o la pasada si todavía tiene menos de 10 partidos).", "Rachas"],
  [["Tus líneas"], "Las líneas que pusiste a mano en los gráficos (modo Manual). Se evalúan siempre, aunque no estén en racha.", "Rachas"],
  [["Temp."], "Favoritos: promedio de la temporada; la columna de al lado es el de los últimos 5. La flecha marca si subió o bajó 5% o más (en pérdidas, bajar es bueno).", "Favoritos"],
  [["Con", "Sin", "Contra"], "Versus: con X = partidos en los que X jugó en su mismo equipo; sin X = partidos de ese equipo en los que X no jugó; contra X = X jugó para el rival.", "Versus"],
  [["Juntos en cancha", "En cancha"], "Versus: solo los minutos en que los dos estaban en cancha a la vez, sacado del jugada por jugada. \"Sin\" o \"en el banco\" son el resto de sus minutos en esos partidos.", "Versus"],
  [["Cada 36 min"], "Lo que haría en 36 minutos a ese ritmo: total dividido por los minutos y multiplicado por 36. Sirve para comparar tramos de distinta duración.", "Versus"],
  [["Min de marca"], "Matchups: tiempo que un jugador marcó a otro, sumando cada jugada en la que la NBA lo asignó como su defensor.", "Versus"],
  [["Posesiones"], "Matchups: posesiones en las que se marcaron. En play types: posesiones por partido terminadas con ese tipo de jugada.", "Versus"],
  [["Parte"], "Matchups: qué parte de todo su tiempo marcado (o marcando) fue contra ese jugador.", "Versus"],
  [["Mejor"], "Comparar: en verde, el mejor valor de cada fila; en pérdidas y faltas, el menor. Minutos y uso no se resaltan.", "Versus"],
];

const AYUDA = {};
for (const [claves, texto] of GLOSARIO) for (const k of claves) AYUDA[k.toUpperCase()] = texto;
const claveAyuda = (t) => t.replace(/[↓↑]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

// significado al pasar el mouse por encabezados, tarjetas y botones de stats
function ponerAyudas(raiz) {
  raiz.querySelectorAll("th, .kpi .k, .graf-stats button, .segmentado button").forEach((el) => {
    if (el.title || el.children.length > 1) return;
    const t = AYUDA[claveAyuda(el.childNodes[0]?.textContent || el.textContent)];
    if (t) { el.title = t; el.classList.add("con-ayuda"); }
  });
}

function pintarGlosario(filtro = "") {
  const q = normalizar(filtro);
  const grupos = {};
  for (const [claves, texto, grupo] of GLOSARIO) {
    if (q && !normalizar(claves.join(" ") + " " + texto).includes(q)) continue;
    (grupos[grupo] = grupos[grupo] || []).push([claves, texto]);
  }
  const caja = $("#glosario-lista");
  const html = Object.entries(grupos).map(([g, items]) => `<div class="glosario-grupo"><h4>${esc(g)}</h4>
    ${items.map(([c, t]) => `<div class="glosario-item"><b>${c.map(esc).join(" · ")}</b><span>${esc(t)}</span></div>`).join("")}</div>`).join("");
  caja.innerHTML = html || '<div class="apagado" style="padding:10px">Sin resultados.</div>';
}

function alternarGlosario(abrir) {
  const p = $("#glosario");
  const abierto = abrir ?? p.hidden;
  p.hidden = !abierto;
  $("#pie-glosario").classList.toggle("activo", abierto);
  if (abierto) { pintarGlosario($("#glosario-buscar").value); $("#glosario-buscar").focus(); }
}

document.addEventListener("DOMContentLoaded", () => {
  $("#pie-glosario").addEventListener("click", () => alternarGlosario());
  $("#glosario-cerrar").addEventListener("click", () => alternarGlosario(false));
  $("#glosario-buscar").addEventListener("input", (e) => pintarGlosario(e.target.value));
  $("#glosario-buscar").addEventListener("keydown", (e) => { if (e.key === "Escape") alternarGlosario(false); });
  new MutationObserver(() => ponerAyudas($("#contenido"))).observe($("#contenido"), { childList: true, subtree: true });
});
