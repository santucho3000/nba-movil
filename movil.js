"use strict";
/* Stats NBA en el celular (0.24). La interfaz es la misma de la PC; acá se reemplaza a Python (pywebview) por un
   lector de los paquetes cifrados que sube la PC a la rama "datos" del repositorio:
     base  jugadores, equipos, perfiles de los que juegan hoy, rachas…   (cambia una vez por día)
     dia   partidos, cuotas de Stake, señales, pisos, Unidades           (cada 2 minutos)
     vivo  partidos en juego, box score, cancha, tus apuestas, alertas   (cada vez que cambia en la PC)
   Desde el celular se mira: lo que guarda o cambia cosas se hace en la PC. */
(function () {
  const [USUARIO, REPO] = [location.hostname.split(".")[0], location.pathname.split("/").filter(Boolean)[0] || ""];
  const API = `https://api.github.com/repos/${USUARIO}/${REPO}`;
  const M = { paq: { base: null, dia: null, vivo: null, jugadores: null, yo: null }, shas: {}, token: null, claves: {}, listo: false,
    sb: null, dueno: false, clave: {}, res: null, filas: [] };
  const SB = "https://oibjogtgszmyrywysgil.supabase.co";
  const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pYmpvZ3Rnc3pteXJ5d3lzZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1OTk0NDYsImV4cCI6MjExMDE3NTQ0Nn0.QGXV36bj6-xDnwRkA_WNKziAQrQeMwnLCD2VpUeGUtM";
  const DOMINIO = "statsnba.app";
  const guardarLocal = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const leerLocal = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  async function sbAuth(cuerpo, tipo) {
    const r = await fetch(`${SB}/auth/v1/token?grant_type=${tipo}`, { method: "POST", headers: { apikey: SB_ANON, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (!r.ok) throw new Error(tipo === "password" ? "usuario" : "sesion");
    const d = await r.json();
    M.sb = { token: d.access_token, refresh: d.refresh_token, vence: Date.now() + (d.expires_in || 3600) * 1000 - 120000, uid: d.user?.id,
      email: (d.user?.email || "").replace("@" + DOMINIO, "") };
    guardarLocal("sb", M.sb);
    return M.sb;
  }
  async function sbToken() {
    if (!M.sb) M.sb = leerLocal("sb");
    if (!M.sb) throw new Error("sesion");
    if (Date.now() > M.sb.vence) await sbAuth({ refresh_token: M.sb.refresh }, "refresh_token");
    return M.sb.token;
  }
  async function sb(metodo, ruta, cuerpo, extra) {
    const tok = await sbToken();
    const r = await fetch(SB + ruta, { method: metodo, headers: { apikey: SB_ANON, Authorization: "Bearer " + tok, "Content-Type": "application/json", ...(extra || {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    if (!r.ok) throw new Error("Supabase respondió " + r.status);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  window.__movil = M;

  // ---------------------------------------------------------------- SHA-256 (sincrónico, para el flujo)
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const W = new Uint32Array(64);
  // un solo bloque de 64 bytes (los mensajes del flujo son de 56 bytes: clave 32 + nonce 16 + contador 8)
  function sha256Bloque(msg56, out, off) {
    const bits = 56 * 8;      // 56 bytes + 0x80 + longitud no entran en 64: van dos bloques
    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const b1 = new Uint8Array(64); b1.set(msg56); b1[56] = 0x80;
    const b2 = new Uint8Array(64); b2[62] = (bits >>> 8) & 255; b2[63] = bits & 255;
    for (const blk of [b1, b2]) {
      for (let i = 0; i < 16; i++) W[i] = (blk[i * 4] << 24) | (blk[i * 4 + 1] << 16) | (blk[i * 4 + 2] << 8) | blk[i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const x = W[i - 15], y = W[i - 2];
        const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let [a, bb, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const t2 = (S0 + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h = [h[0] + a | 0, h[1] + bb | 0, h[2] + c | 0, h[3] + d | 0, h[4] + e | 0, h[5] + f | 0, h[6] + g | 0, h[7] + hh | 0];
    }
    for (let i = 0; i < 8; i++) { out[off + i * 4] = h[i] >>> 24; out[off + i * 4 + 1] = (h[i] >>> 16) & 255; out[off + i * 4 + 2] = (h[i] >>> 8) & 255; out[off + i * 4 + 3] = h[i] & 255; }
  }

  // ---------------------------------------------------------------- cifrado
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function claves(clave, sal, it) {
    const kk = clave + "|" + sal;
    if (M.claves[kk]) return M.claves[kk];
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: b64(sal), iterations: it }, base, 512));
    const km = await crypto.subtle.importKey("raw", bits.slice(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    M.claves[kk] = { ke: bits.slice(0, 32), km };
    return M.claves[kk];
  }
  async function descifrar(caja, clave) {
    const { ke, km } = await claves(clave, caja.sal, caja.it);
    const nonce = b64(caja.nonce), ct = b64(caja.ct);
    const junto = new Uint8Array(16 + ct.length); junto.set(nonce); junto.set(ct, 16);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", km, junto)), esp = b64(caja.mac);
    if (mac.length !== esp.length || mac.some((x, i) => x !== esp[i])) throw new Error("clave");
    const msg = new Uint8Array(56); msg.set(ke); msg.set(nonce, 32);
    const flujo = new Uint8Array(32 * Math.ceil(ct.length / 32));
    for (let i = 0, n = flujo.length / 32; i < n; i++) {
      for (let j = 0, c = i; j < 8; j++) { msg[55 - j] = c % 256; c = Math.floor(c / 256); }
      sha256Bloque(msg, flujo, i * 32);
    }
    for (let i = 0; i < ct.length; i++) ct[i] ^= flujo[i];
    const txt = await new Response(new Blob([ct]).stream().pipeThrough(new DecompressionStream("deflate"))).text();
    return JSON.parse(txt);
  }

  // ---------------------------------------------------------------- GitHub
  async function gh(url, raw) {
    const h = { Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json" };
    if (M.token) h.Authorization = "Bearer " + M.token;
    const r = await fetch(url, { headers: h, cache: "no-store" });
    if (r.status === 401 && M.token) { M.token = null; return gh(url, raw); }
    if (r.status === 403 && /rate limit/i.test(await r.clone().text())) throw new Error("GitHub limitó las consultas; probá en un rato.");
    if (!r.ok) throw new Error(r.status === 403 ? "GitHub limitó las consultas; probá en un rato." : r.status === 404 ? "Todavía no hay datos de la PC." : "GitHub respondió " + r.status);
    return raw ? r.text() : r.json();
  }
  async function traer(cuales) {
    const arbol = await gh(`${API}/git/trees/datos`);
    const cambiaron = [];
    for (const n of cuales) {
      const it = arbol.tree.find((x) => x.path === n + ".json");
      if (!it || M.shas[n] === it.sha) continue;
      if (n === "yo" && !M.clave.yo) continue;
      const d = await descifrar(JSON.parse(await gh(`${API}/git/blobs/${it.sha}`, true)), n === "yo" ? M.clave.yo : M.clave.comun);
      M.paq[n] = d; M.shas[n] = it.sha; cambiaron.push(n);
    }
    return cambiaron;
  }

  // ---------------------------------------------------------------- el reemplazo de Python
  const SOLO_PC = new Set(["guardar_nota", "guardar_linea", "alternar_favorito", "cambiar_favorito", "grupo", "guardar_apuesta", "guardar_anotacion",
    "borrar_anotacion", "borrar_apuesta", "marcar_apuesta", "config_unidades", "actualizar_lineas", "actualizar_lesiones", "recalcular_senales",
    "sumar_temporada", "preparar_copia_claude", "cancelar_actualizacion", "telegram_configurar", "telegram_desvincular", "telegram_borrar",
    "telegram_probar", "alertas_probar", "movil_configurar", "movil_borrar", "movil_subir", "comparar", "buscar_stat", "chance_linea", "partidos_apuesta"]);
  const k = (m, a) => `${m}|${JSON.stringify(a === undefined ? null : a)}`;
  function buscar(clave) {
    for (const n of ["vivo", "dia", "base", "jugadores"]) { const p = M.paq[n]; if (p && clave in p) return p[clave]; }
    return undefined;
  }
  const PREFS = "prefs_movil";
  function prefs() { try { return JSON.parse(localStorage.getItem(PREFS) || "null"); } catch (e) { return null; } }
  const FALTA = { error: "Esto todavía no está en el celular: la PC lo sube la próxima vez que esté abierta." };

  // los perfiles de todos los jugadores van en un paquete aparte que se baja la primera vez que hace falta
  async function responderAsync(m, a) {
    if (!M.dueno && ["guardar_apuesta", "borrar_apuesta", "marcar_apuesta", "config_unidades"].includes(m)) {
      try { const w = await escribirAmigo(m, a); if (w) return w; } catch (e) { return { error: "No se pudo guardar: " + e.message }; }
    }
    let r = responder(m, a);
    if (r === FALTA && ["perfil", "versus"].includes(m) && !M.paq.jugadores) {
      try { await traer(["jugadores"]); } catch (e) {}
      r = responder(m, a);
    }
    if (r === FALTA && m === "tiros") return { error: "El mapa de tiros de este jugador solo está en la PC (el celular tiene los de hoy, favoritos y apuestas)." };
    return r;
  }
  // ---------------------------------------------------------------- las apuestas de un amigo (Supabase)
  async function cargarAmigo() {
    if (M.dueno || !M.sb) return;
    try {
      const [res, filas] = await Promise.all([sb("GET", "/rest/v1/resultados?select=unidades,vivo,actualizado"), sb("GET", "/rest/v1/apuestas?select=id,datos,creada&order=id")]);
      M.res = (res && res[0]) || null; M.filas = filas || [];
    } catch (e) {}
  }
  function unidadesAmigo() {
    const base = (M.res && M.res.unidades) || { apuestas: [], resumen: { n: 0, ganadas: 0, perdidas: 0, nulas: 0, pendientes: 0, acierto: null, apostado: 0, resultado: 0, yield: null, cuota_promedio: null, racha: { estado: null, n: 0 }, en_juego: 0, a_ganar: 0 },
      curva: { puntos: [], maximo: 0, peor_caida: { caida: 0 } }, desgloses: {}, por_pierna: {}, anotador: [], deportes: ["NBA"] };
    const vistas = new Set((base.apuestas || []).map((x) => x.id));
    const nuevas = M.filas.filter((f) => !vistas.has(f.id)).map((f) => {
      const d = f.datos || {}, ps = (d.piernas || []).map((p, i) => ({ ...p, id: f.id * 100 + i, orden: i, estado: "pendiente", deporte: p.deporte || "NBA" }));
      return { id: f.id, creada: f.creada, fecha: d.fecha || (f.creada || "").slice(0, 10), cuota: +d.cuota || (ps[0] && +ps[0].cuota) || 0, unidades: +d.unidades || 1,
        casa: d.casa || null, nota: d.nota || null, estado: "pendiente", manual: 0, cuota_final: +d.cuota || 0, aviso: "Se procesa cuando la PC esté abierta.",
        grupos: d.grupos || null, piernas: ps, tipo: ps.length > 1 ? "parlay" : "simple", deporte: "NBA", resultado: 0 };
    });
    const conf = leerLocal("config_unidades") || {};
    return { ...base, apuestas: [...nuevas, ...(base.apuestas || []).filter((x) => M.filas.some((f) => f.id === x.id))], total: (base.total || 0) + nuevas.length,
      config: { valor_unidad: conf.valor_unidad ?? null, moneda: conf.moneda || "$" } };
  }
  async function escribirAmigo(m, a) {
    if (m === "guardar_apuesta") {
      const d = { ...(a[0] || {}) };
      if (!d.piernas || !d.piernas.length) return { error: "La apuesta no tiene piernas" };
      if (d.id) { const id = d.id; delete d.id; await sb("PATCH", `/rest/v1/apuestas?id=eq.${id}`, { datos: d }); await cargarAmigo(); return { id }; }
      const r = await sb("POST", "/rest/v1/apuestas", { datos: d }, { Prefer: "return=representation" });
      await cargarAmigo();
      return { id: r && r[0] && r[0].id };
    }
    if (m === "borrar_apuesta") { await sb("DELETE", `/rest/v1/apuestas?id=eq.${a[0]}`); await cargarAmigo(); return {}; }
    if (m === "marcar_apuesta") {
      const [tipo, id, estado] = a;
      if (tipo !== "apuesta") return { error: "Desde la web se marca la apuesta entera, no cada pata." };
      const f = M.filas.find((x) => x.id === id); if (!f) return {};
      await sb("PATCH", `/rest/v1/apuestas?id=eq.${id}`, { datos: { ...f.datos, _estado: estado || undefined } }); await cargarAmigo(); return {};
    }
    if (m === "config_unidades") { const c = leerLocal("config_unidades") || {}; if (a[0] !== undefined) c.valor_unidad = a[0]; if (a[1]) c.moneda = a[1]; guardarLocal("config_unidades", c); return {}; }
    return null;
  }
  const PERSONAL = new Set(["unidades", "favoritos", "vivo_apuestas", "alertas_bandeja"]);
  function responderPersonal(m, a) {
    if (M.dueno) {
      const y = M.paq.yo || {};
      if (m === "unidades" || m === "favoritos" || m === "vivo_apuestas" || m === "alertas_bandeja") return y[k(m)] ?? (m === "alertas_bandeja" ? { alertas: [], sin_leer: 0 } : FALTA);
      return undefined;
    }
    if (m === "unidades") return unidadesAmigo();
    if (m === "vivo_apuestas") return { apuestas: (M.res && M.res.vivo && M.res.vivo.apuestas) || [], version: 0 };
    if (m === "favoritos") return { jugadores: [], hoy: [] };
    if (m === "alertas_bandeja") return { alertas: [], sin_leer: 0 };
    return undefined;
  }
  function responder(m, a) {
    if (PERSONAL.has(m)) { const r = responderPersonal(m, a); if (r !== undefined) return r; }
    if (m === "guardar_prefs") { try { localStorage.setItem(PREFS, JSON.stringify(a[0])); } catch (e) {} return {}; }
    if (SOLO_PC.has(m)) return { error: "Desde el celular solo se mira: esto se hace en la app de la PC." };
    if (m === "actualizar" || m === "alertas_leidas" || m === "alertas_silenciar") return {};
    if (m === "estado_actualizacion") return { corriendo: false, cambios: 0, resumen: null };
    if (m === "telegram_estado") return { configurado: false };
    if (m === "movil_estado") return { celular: true, usuario: M.sb && M.sb.email };
    if (m === "copia_claude") return {};
    if (m === "vivo_medicion") return {};
    if (m === "inicio") {
      const d = { ...(buscar(k("inicio")) || {}) };
      d.imagenes = "cdn";
      return d;
    }
    if (m === "vivo_resumen") {
      const r = buscar(k("vivo_resumen", -1));
      if (!r) return { version: 0, en_juego: 0, alertas_nuevas: [], sin_leer: 0, ultimo_alerta: 0 };
      const out = { ...r, alertas_nuevas: [], ultimo_alerta: r.ultimo_alerta };
      if (M.dueno && M.paq.yo) out.favoritos = M.paq.yo._favoritos_vivo || out.favoritos;
      if (a[0] === r.version) { delete out.marcador; delete out.favoritos; }
      return out;
    }
    if (m === "vivo_partido") {
      const r = buscar(k("vivo_partido", String(a[0])));
      const res = buscar(k("vivo_resumen", -1)) || {};
      if (!r) return { version: res.version || 0, hay: false, marcador: (res.marcador || []).find((x) => x.game_id === String(a[0])) || null };
      if (a[1] === r.version) return { version: r.version, igual: true };
      if (M.dueno && M.paq.yo) return { ...r, ...(M.paq.yo[k("vivo_partido_yo", String(a[0]))] || {}) };
      if (!M.dueno && M.res && M.res.vivo) {
        const gid = String(a[0]);
        return { ...r, apuestas: (M.res.vivo.apuestas || []).filter((x) => x.patas.some((p) => (p.vivo || {}).game_id === gid || p.game_id === gid)) };
      }
      return r;
    }
    if (m === "pisos") {
      const op = a[0] || {};
      return buscar(k("pisos", String(op.objetivo || ""))) || buscar(k("pisos", "")) || FALTA;
    }
    if (m === "partidos_dia") {
      let r = buscar(k(m, a[0] ?? null));
      const hoy = buscar(k("partidos_dia"));
      if (r === undefined && hoy && (a[0] === hoy.hoy || a[0] === hoy.fecha)) r = hoy;
      return r || { ...(hoy || {}), fecha: a[0], partidos: [], error: undefined, aviso: "El celular tiene la última semana, hoy y mañana." };
    }
    let r = buscar(k(m, a[0] ?? null));
    if (r === undefined && a.length) r = buscar(k(m, typeof a[0] === "object" ? null : String(a[0])));
    if (r === undefined && typeof a[0] === "string" && /^\d+$/.test(a[0])) r = buscar(k(m, +a[0]));
    if (r === undefined && window.__faltas) window.__faltas.push(m + " " + JSON.stringify(a).slice(0, 80));
    return r === undefined ? FALTA : r;
  }

  function instalar() {
    window.pywebview = { api: new Proxy({}, { get: (_, m) => (...a) => responderAsync(String(m), a) }) };
  }

  // ---------------------------------------------------------------- pantalla de entrada y ciclo
  function pantalla(html) {
    let el = document.getElementById("movil-entrada");
    if (!el) { el = document.createElement("div"); el.id = "movil-entrada"; document.body.appendChild(el); }
    el.innerHTML = html;
    return el;
  }
  function pedirClave(error) {
    const el = pantalla(`<form id="movil-form"><div class="me-logo"></div><h1>Stats NBA</h1>
      <p>Entrá con tu usuario y contraseña.</p>${error ? `<div class="me-error">${error}</div>` : ""}
      <input id="movil-usuario" placeholder="Usuario" autocapitalize="none" autocorrect="off" autocomplete="username" spellcheck="false">
      <input type="password" id="movil-clave" placeholder="Contraseña" autocomplete="current-password"><button>Entrar</button></form>`);
    el.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const u = el.querySelector("#movil-usuario").value.trim().toLowerCase(), c = el.querySelector("#movil-clave").value;
      try { await sbAuth({ email: u.includes("@") ? u : `${u}@${DOMINIO}`, password: c }, "password"); }
      catch (err) { return pedirClave("Usuario o contraseña incorrectos."); }
      arrancar();
    };
  }
  async function claves_de_la_cuenta() {
    const [conf, propias] = await Promise.all([sb("GET", "/rest/v1/config?select=clave,valor"), sb("GET", "/rest/v1/config_dueno?select=clave,valor")]);
    const c = Object.fromEntries((conf || []).map((x) => [x.clave, x.valor])), p = Object.fromEntries((propias || []).map((x) => [x.clave, x.valor]));
    if (!c.clave_comun) throw new Error("La PC todavía no publicó los datos para las cuentas. Abrí la app en la PC y esperá un par de minutos.");
    M.clave = { comun: c.clave_comun, yo: p.clave_yo || null };
    M.dueno = !!p.clave_yo;
    M.token = c.token_lectura || null;
  }
  async function arrancar() {
    if (!leerLocal("sb")) return pedirClave();
    pantalla('<div class="me-cargando"><div class="me-logo"></div><p>Abriendo…</p></div>');
    try {
      await claves_de_la_cuenta();
      await traer(["dia"]);
      await traer(M.dueno ? ["base", "vivo", "yo"] : ["base", "vivo"]);
      await cargarAmigo();
    } catch (e) {
      if (e.message === "sesion") { guardarLocal("sb", null); M.sb = null; return pedirClave("Volvé a entrar."); }
      if (e.message === "clave") return pantalla('<div class="me-cargando"><p>Los datos están cifrados con otra clave: abrí la app en la PC para que los vuelva a subir.</p><button onclick="location.reload()">Reintentar</button></div>');
      return pantalla(`<div class="me-cargando"><p>${e.message || "No se pudieron leer los datos."}</p><button onclick="location.reload()">Reintentar</button></div>`);
    }
    document.getElementById("movil-entrada")?.remove();
    document.body.classList.toggle("movil-amigo", !M.dueno);
    M.listo = true;
    instalar();
    window.dispatchEvent(new Event("pywebviewready"));
    ciclo();
  }
  let timer;
  async function ciclo() {
    clearTimeout(timer);
    let cambiaron = [];
    try {
      const l = ["vivo", "dia", "base"]; if (M.dueno) l.push("yo"); if (M.paq.jugadores) l.push("jugadores");
      cambiaron = await traer(l); M.error = null;
      if (!M.dueno) { const antes = JSON.stringify([M.res && M.res.actualizado, M.filas.length]); await cargarAmigo(); if (antes !== JSON.stringify([M.res && M.res.actualizado, M.filas.length])) cambiaron.push("yo"); }
    } catch (e) { M.error = e.message; }
    if (cambiaron.length) alCambiar(cambiaron);
    pintarFrescura();
    const enJuego = (M.paq.vivo && M.paq.vivo._en_juego) || 0;
    timer = setTimeout(ciclo, document.hidden ? 60000 : enJuego || (window.S && S.ruta && S.ruta.s === "partido") ? 4000 : 45000);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && M.listo) ciclo(); });
  function alCambiar(cambiaron) {
    if (typeof S === "undefined" || !S.ruta) return;
    if (cambiaron.includes("base") && typeof cargarDatos === "function") { cargarDatos().then(() => typeof pintar === "function" && pintar()); return; }
    if (cambiaron.includes("dia") || cambiaron.includes("yo")) {
      const r = S.ruta.s, enEdicion = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (!enEdicion && ["inicio", "senales", "unidades", "vivo", "favoritos"].includes(r) && typeof pintar === "function") pintar();
    }
  }
  function pintarFrescura() {
    const g = M.paq.dia && M.paq.dia._generado;
    const el = document.getElementById("estado-texto");
    if (!g || !el) return;
    const min = Math.round((Date.now() - new Date(g)) / 60000);
    const hace = min < 2 ? "recién" : min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : new Date(g).toLocaleDateString("es-AR");
    el.innerHTML = `Datos de la PC<br><span class="apagado">${hace}</span>`;
    document.body.classList.toggle("movil-viejo", min > 180);
  }
  setInterval(pintarFrescura, 30000);
  document.addEventListener("DOMContentLoaded", arrancar);
})();
