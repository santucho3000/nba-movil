"use strict";
/* Stats NBA - X-04: colores de cada equipo. En su perfil y en la ficha del equipo, el acento de la app
   pasa a ser el color del equipo, y la cabecera usa sus dos colores. */

const COLORES_EQUIPO = {
  1610612737: ["#E03A3E", "#C1D32F"], // ATL
  1610612738: ["#007A33", "#BA9653"], // BOS
  1610612739: ["#860038", "#FDBB30"], // CLE
  1610612740: ["#0C2340", "#C8102E"], // NOP
  1610612741: ["#CE1141", "#000000"], // CHI
  1610612742: ["#00538C", "#B8C4CA"], // DAL
  1610612743: ["#0E2240", "#FEC524"], // DEN
  1610612744: ["#1D428A", "#FFC72C"], // GSW
  1610612745: ["#CE1141", "#C4CED4"], // HOU
  1610612746: ["#C8102E", "#1D428A"], // LAC
  1610612747: ["#552583", "#FDB927"], // LAL
  1610612748: ["#98002E", "#F9A01B"], // MIA
  1610612749: ["#00471B", "#EEE1C6"], // MIL
  1610612750: ["#0C2340", "#78BE20"], // MIN
  1610612751: ["#000000", "#FFFFFF"], // BKN
  1610612752: ["#006BB6", "#F58426"], // NYK
  1610612753: ["#0077C0", "#C4CED4"], // ORL
  1610612754: ["#002D62", "#FDBB30"], // IND
  1610612755: ["#006BB6", "#ED174C"], // PHI
  1610612756: ["#1D1160", "#E56020"], // PHX
  1610612757: ["#E03A3E", "#000000"], // POR
  1610612758: ["#5A2D81", "#63727A"], // SAC
  1610612759: ["#C4CED4", "#000000"], // SAS
  1610612760: ["#007AC1", "#EF3B24"], // OKC
  1610612761: ["#CE1141", "#000000"], // TOR
  1610612762: ["#002B5C", "#F9A01B"], // UTA
  1610612763: ["#5D76A9", "#12173F"], // MEM
  1610612764: ["#002B5C", "#E31837"], // WAS
  1610612765: ["#C8102E", "#1D42BA"], // DET
  1610612766: ["#1D1160", "#00788C"], // CHA
};

function _rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function _hex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
function luminancia(hex) {
  const [r, g, b] = _rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function mezclar(a, b, t) {
  const x = _rgb(a), y = _rgb(b);
  return _hex(x.map((v, i) => v + (y[i] - v) * t));
}
/* Para un equipo: fondo de la cabecera (oscuro, para texto blanco), franja (el otro color) y
   acento (el color que se lee bien sobre el fondo oscuro de la app). */
function paletaEquipo(tid) {
  const par = COLORES_EQUIPO[tid];
  if (!par) return null;
  let [c1, c2] = par;
  if (luminancia(c1) > 0.35) [c1, c2] = [c2, c1];            // San Antonio: base negra, franja plateada
  const fondo = luminancia(c1) < 0.012 ? mezclar(c1, "#2a3547", 0.35) : c1;   // negro puro: un poco más vivo
  // acento: el color principal si se lee sobre el fondo oscuro; si no, el secundario; si ninguno, el más vivo aclarado
  let acento = [par[0], par[1]].find((c) => luminancia(c) >= 0.13 && luminancia(c) <= 0.8);
  if (!acento) {
    const vivo = [par[0], par[1]].find((c) => { const [r, g, b] = _rgb(c); return Math.max(r, g, b) - Math.min(r, g, b) > 60; });
    acento = vivo || "#cfd5dd";
    for (let i = 0; i < 8 && luminancia(acento) < 0.16; i++) acento = mezclar(acento, "#ffffff", 0.15);
  }
  const [r, g, b] = _rgb(acento);
  return { fondo, franja: c2, acento, suave: `rgba(${r}, ${g}, ${b}, .15)`, oscuro: mezclar(fondo, "#0c0b10", 0.55) };
}
/* Aplica (o saca, con null) el color del equipo a toda la app. */
function aplicarEquipo(tid) {
  const raiz = document.documentElement.style;
  const p = tid ? paletaEquipo(tid) : null;
  if (!p) { raiz.removeProperty("--acento"); raiz.removeProperty("--acento-suave"); raiz.removeProperty("--sobre-acento"); return; }
  raiz.setProperty("--acento", p.acento);
  raiz.setProperty("--acento-suave", p.suave);
  raiz.setProperty("--sobre-acento", luminancia(p.acento) > 0.35 ? "#10151c" : "#ffffff");
}
