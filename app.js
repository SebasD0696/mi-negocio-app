/* ============================================================
   MiNegocio PWA — Lógica principal
   ============================================================ */

'use strict';

// ─── Estado global ───────────────────────────────────────────
const STATE = {
  currentView: 'home',
  listening: false,
  deferredInstallPrompt: null,
};

// ─── Storage helpers ──────────────────────────────────────────
const DB = {
  get: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  push: (key, item) => {
    const arr = DB.get(key);
    arr.unshift(item); // más reciente primero
    DB.set(key, arr);
    return arr;
  },
};

const KEYS = {
  ingresos:   'mn_ingresos',
  compras:    'mn_compras',
  gastos:     'mn_gastos',
  inventario: 'mn_inventario',
};

// ─── Datos de prueba (extraídos del Excel) ────────────────────
const SEED_DATA = {
  ingresos: [
    { id: 1740100004, producto: 'Café Colina en grano 454gr',             cantidad: 250, precio: 56650, pago: 'credito',        fecha: '2025-03-10T00:00:00' },
    { id: 1740100003, producto: 'Café Origen Nariño en granos 454gr',     cantidad: 200, precio: 65780, pago: 'transferencia',   fecha: '2025-03-09T00:00:00' },
    { id: 1740100002, producto: 'Café Mujeres Cafeteras en granos 454gr', cantidad: 150, precio: 65780, pago: 'transferencia',   fecha: '2025-03-08T00:00:00' },
    { id: 1740100001, producto: 'Café Finca en grano 454gr',              cantidad: 100, precio: 65780, pago: 'transferencia',   fecha: '2025-03-07T00:00:00' },
    { id: 1740100000, producto: 'Café Volcán en granos 250gr',             cantidad:  50, precio: 31460, pago: 'efectivo',       fecha: '2025-03-06T00:00:00' },
  ],
  compras: [
    { id: 1740000004, producto: 'Café Colina en grano 454gr',             cantidad: 300, precio: 36650, pago: 'credito',        fecha: '2025-03-05T00:00:00' },
    { id: 1740000003, producto: 'Café Origen Nariño en granos 454gr',     cantidad: 250, precio: 45780, pago: 'credito',        fecha: '2025-03-04T00:00:00' },
    { id: 1740000002, producto: 'Café Mujeres Cafeteras en granos 454gr', cantidad: 200, precio: 45780, pago: 'transferencia',  fecha: '2025-03-03T00:00:00' },
    { id: 1740000001, producto: 'Café Finca en grano 454gr',              cantidad: 150, precio: 45780, pago: 'transferencia',  fecha: '2025-03-02T00:00:00' },
    { id: 1740000000, producto: 'Café Volcán en granos 250gr',             cantidad: 100, precio: 11460, pago: 'efectivo',      fecha: '2025-03-01T00:00:00' },
  ],
  gastos: [
    { id: 1740200007, descripcion: 'Vigilancia',        precio:   70000, pago: 'transferencia', fecha: '2025-03-15T00:00:00' },
    { id: 1740200006, descripcion: 'Útiles de Aseo',    precio:   50000, pago: 'transferencia', fecha: '2025-03-13T00:00:00' },
    { id: 1740200005, descripcion: 'Arriendo',          precio: 2000000, pago: 'transferencia', fecha: '2025-03-11T00:00:00' },
    { id: 1740200004, descripcion: 'Seguridad Social',  precio:  500000, pago: 'transferencia', fecha: '2025-03-09T00:00:00' },
    { id: 1740200003, descripcion: 'Nómina',            precio: 2000000, pago: 'transferencia', fecha: '2025-03-07T00:00:00' },
    { id: 1740200002, descripcion: 'Internet',          precio:  150000, pago: 'transferencia', fecha: '2025-03-05T00:00:00' },
    { id: 1740200001, descripcion: 'Luz',               precio:   70000, pago: 'transferencia', fecha: '2025-03-03T00:00:00' },
    { id: 1740200000, descripcion: 'Agua',              precio:  100000, pago: 'transferencia', fecha: '2025-03-01T00:00:00' },
  ],
  inventario: [
    { producto: 'Café Volcán en granos 250gr',             cantidad: 50 },
    { producto: 'Café Finca en grano 454gr',              cantidad: 50 },
    { producto: 'Café Mujeres Cafeteras en granos 454gr', cantidad: 50 },
    { producto: 'Café Origen Nariño en granos 454gr',     cantidad: 50 },
    { producto: 'Café Colina en grano 454gr',             cantidad: 50 },
  ],
};

function loadSeedData() {
  // Solo carga si la app está completamente vacía (primera vez)
  const alreadySeeded = localStorage.getItem('mn_seeded');
  if (alreadySeeded) return;

  DB.set(KEYS.ingresos,   SEED_DATA.ingresos);
  DB.set(KEYS.compras,    SEED_DATA.compras);
  DB.set(KEYS.gastos,     SEED_DATA.gastos);
  DB.set(KEYS.inventario, SEED_DATA.inventario);
  localStorage.setItem('mn_seeded', '1');

  console.log('✅ Datos de prueba cargados desde Excel');
}

// ─── Formato moneda ───────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);

const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Toast ────────────────────────────────────────────────────
function toast(msg, type = 'success', icon = '') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon ? `<span>${icon}</span>` : ''}<span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

// ─── Navegación ───────────────────────────────────────────────
function navigate(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${viewId}`).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`[data-nav="${viewId}"]`);
  if (navItem) navItem.classList.add('active');

  const backBtn = document.querySelector('.header-back');
  backBtn.classList.toggle('visible', viewId !== 'home');

  STATE.currentView = viewId;

  // Refrescar vistas dinámicas
  if (viewId === 'home')       renderHome();
  if (viewId === 'inventario') renderInventario();
  if (viewId === 'reportes')   renderReportes();
  if (viewId === 'ingresos')   renderRecords('ingresos');
  if (viewId === 'compras')    renderRecords('compras');
  if (viewId === 'gastos')     renderRecords('gastos');
}

// ─── Inventario helpers ───────────────────────────────────────
function getInventario() {
  return DB.get(KEYS.inventario); // [{producto, cantidad}]
}

function updateInventario(producto, delta) {
  let inv = getInventario();
  const nombre = producto.trim().toLowerCase();
  const idx = inv.findIndex(i => i.producto.toLowerCase() === nombre);
  if (idx >= 0) {
    inv[idx].cantidad = Math.max(0, inv[idx].cantidad + delta);
  } else {
    if (delta > 0) inv.push({ producto: producto.trim(), cantidad: delta });
  }
  DB.set(KEYS.inventario, inv);
}

// ─── HOME ─────────────────────────────────────────────────────
function renderHome() {
  // Calcular resumen
  const ingresos = DB.get(KEYS.ingresos).reduce((s, r) => s + r.precio * r.cantidad, 0);
  const compras  = DB.get(KEYS.compras).reduce((s, r)  => s + r.precio * r.cantidad, 0);
  const gastos   = DB.get(KEYS.gastos).reduce((s, r)   => s + r.precio, 0);
  const saldo    = ingresos - compras - gastos;

  document.getElementById('home-ingresos').textContent = fmt(ingresos);
  document.getElementById('home-saldo').textContent    = fmt(saldo);
  document.getElementById('home-saldo').className =
    'hero-stat-value ' + (saldo >= 0 ? 'positive' : 'negative');

  // Contadores en tarjetas
  document.getElementById('cnt-ingresos').textContent   = `${DB.get(KEYS.ingresos).length} registros`;
  document.getElementById('cnt-compras').textContent    = `${DB.get(KEYS.compras).length} registros`;
  document.getElementById('cnt-gastos').textContent     = `${DB.get(KEYS.gastos).length} registros`;
  document.getElementById('cnt-inventario').textContent = `${getInventario().length} productos`;

  // Actividad reciente
  const recent = [
    ...DB.get(KEYS.ingresos).slice(0,3).map(r  => ({ ...r, tipo: 'ingreso',  label: r.producto, monto: r.precio * r.cantidad })),
    ...DB.get(KEYS.compras).slice(0,2).map(r   => ({ ...r, tipo: 'compra',   label: r.producto, monto: -(r.precio * r.cantidad) })),
    ...DB.get(KEYS.gastos).slice(0,2).map(r    => ({ ...r, tipo: 'gasto',    label: r.descripcion, monto: -r.precio })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);

  const list = document.getElementById('activity-list');
  if (recent.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Sin actividad aún</div><div class="empty-sub">Registra tu primera operación</div></div>';
    return;
  }
  list.innerHTML = recent.map(r => `
    <div class="activity-item">
      <div class="activity-dot ${r.tipo}"></div>
      <div class="activity-text">${r.label}</div>
      <div class="activity-amount ${r.monto >= 0 ? 'pos' : 'neg'}">${fmt(Math.abs(r.monto))}</div>
    </div>
  `).join('');
}

// ─── REGISTRAR INGRESO ────────────────────────────────────────
function registrarIngreso(e) {
  e.preventDefault();
  const producto = document.getElementById('ing-producto').value.trim();
  const cantidad = parseInt(document.getElementById('ing-cantidad').value);
  const precio   = parseFloat(document.getElementById('ing-precio').value);
  const pago     = document.querySelector('#form-ingresos .payment-btn.selected')?.dataset.val || 'efectivo';

  if (!producto || !cantidad || !precio) { toast('Completa todos los campos', 'error', '⚠️'); return; }

  const record = { id: Date.now(), producto, cantidad, precio, pago, fecha: new Date().toISOString() };
  DB.push(KEYS.ingresos, record);
  updateInventario(producto, -cantidad);

  toast(`Venta registrada: ${producto}`, 'success', '✅');
  e.target.reset();
  resetPaymentBtns('form-ingresos');
  renderRecords('ingresos');
}

// ─── REGISTRAR COMPRA ─────────────────────────────────────────
function registrarCompra(e) {
  e.preventDefault();
  const producto = document.getElementById('com-producto').value.trim();
  const cantidad = parseInt(document.getElementById('com-cantidad').value);
  const precio   = parseFloat(document.getElementById('com-precio').value);
  const pago     = document.querySelector('#form-compras .payment-btn.selected')?.dataset.val || 'efectivo';

  if (!producto || !cantidad || !precio) { toast('Completa todos los campos', 'error', '⚠️'); return; }

  const record = { id: Date.now(), producto, cantidad, precio, pago, fecha: new Date().toISOString() };
  DB.push(KEYS.compras, record);
  updateInventario(producto, cantidad);

  toast(`Compra registrada: ${producto}`, 'success', '✅');
  e.target.reset();
  resetPaymentBtns('form-compras');
  renderRecords('compras');
}

// ─── REGISTRAR GASTO ──────────────────────────────────────────
function registrarGasto(e) {
  e.preventDefault();
  const descripcion = document.getElementById('gas-descripcion').value.trim();
  const precio      = parseFloat(document.getElementById('gas-precio').value);
  const pago        = document.querySelector('#form-gastos .payment-btn.selected')?.dataset.val || 'efectivo';

  if (!descripcion || !precio) { toast('Completa todos los campos', 'error', '⚠️'); return; }

  const record = { id: Date.now(), descripcion, precio, pago, fecha: new Date().toISOString() };
  DB.push(KEYS.gastos, record);

  toast(`Gasto registrado: ${descripcion}`, 'success', '✅');
  e.target.reset();
  resetPaymentBtns('form-gastos');
  renderRecords('gastos');
}

// ─── Render records list ──────────────────────────────────────
function renderRecords(tipo) {
  const containerId = `records-${tipo}`;
  const container   = document.getElementById(containerId);
  if (!container) return;

  const records = DB.get(KEYS[tipo]);

  if (records.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">${TIPO_META[tipo].icon}</div><div class="empty-title">Sin ${TIPO_META[tipo].label} aún</div></div>`;
    return;
  }

  container.innerHTML = records.map(r => {
    const isGasto = tipo === 'gastos';
    const label   = isGasto ? r.descripcion : r.producto;
    const monto   = isGasto ? r.precio : r.precio * r.cantidad;
    const meta    = isGasto ? `Forma de pago: ${r.pago}` : `Cant: ${r.cantidad} × ${fmt(r.precio)} | ${r.pago}`;
    const cls     = tipo === 'ingresos' ? 'pos' : 'neg';

    return `
      <div class="record-item">
        <div class="record-left">
          <div class="record-product">${label}</div>
          <div class="record-meta">${meta}</div>
        </div>
        <div class="record-right">
          <div class="record-amount ${cls}">${tipo !== 'ingresos' ? '-' : '+'}${fmt(monto)}</div>
          <div class="record-date">${fmtDate(r.fecha)}</div>
        </div>
      </div>
    `;
  }).join('');
}

const TIPO_META = {
  ingresos:  { icon: '💰', label: 'ingresos' },
  compras:   { icon: '🛒', label: 'compras' },
  gastos:    { icon: '💸', label: 'gastos' },
  inventario:{ icon: '📦', label: 'inventario' },
};

// ─── INVENTARIO ───────────────────────────────────────────────
function renderInventario(filter = '') {
  const inv = getInventario();
  const lowAlerts = inv.filter(i => i.cantidad > 0 && i.cantidad < 10);
  const zeroAlerts = inv.filter(i => i.cantidad === 0);

  // Banner de alerta
  const alertContainer = document.getElementById('inv-alert');
  if (lowAlerts.length > 0 || zeroAlerts.length > 0) {
    const msg = zeroAlerts.length > 0
      ? `⚠️ ${zeroAlerts.length} producto(s) sin stock`
      : `⚠️ ${lowAlerts.length} producto(s) con stock bajo (<10 unidades)`;
    alertContainer.textContent = msg;
    alertContainer.style.display = 'flex';
  } else {
    alertContainer.style.display = 'none';
  }

  const tbody = document.getElementById('inv-tbody');
  const filtered = filter
    ? inv.filter(i => i.producto.toLowerCase().includes(filter.toLowerCase()))
    : inv;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--gray-400)">
      ${filter ? 'Sin resultados' : 'No hay productos en inventario'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const cls  = item.cantidad === 0 ? 'zero' : item.cantidad < 10 ? 'low' : 'ok';
    const icon = item.cantidad === 0 ? '🔴' : item.cantidad < 10 ? '🟡' : '🟢';
    return `
      <tr>
        <td>${item.producto}</td>
        <td><span class="stock-badge ${cls}">${icon} ${item.cantidad}</span></td>
        <td>
          <button onclick="editarStock('${item.producto.replace(/'/g, "\\'")}')" 
            style="background:none;border:1px solid var(--gray-200);border-radius:6px;padding:4px 8px;font-size:.75rem;cursor:pointer;color:var(--gray-600)">
            ✏️ Editar
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function editarStock(producto) {
  const nueva = prompt(`Nuevo stock para "${producto}":`, '');
  if (nueva === null) return;
  const n = parseInt(nueva);
  if (isNaN(n) || n < 0) { toast('Cantidad inválida', 'error', '⚠️'); return; }

  let inv = getInventario();
  const idx = inv.findIndex(i => i.producto === producto);
  if (idx >= 0) {
    inv[idx].cantidad = n;
    DB.set(KEYS.inventario, inv);
    renderInventario();
    toast(`Stock de "${producto}" actualizado`, 'success', '✅');
  }
}

// ─── REPORTES ─────────────────────────────────────────────────
function renderReportes() {
  const ingresos = DB.get(KEYS.ingresos);
  const compras  = DB.get(KEYS.compras);
  const gastos   = DB.get(KEYS.gastos);

  const totIng = ingresos.reduce((s, r) => s + r.precio * r.cantidad, 0);
  const totCom = compras.reduce((s, r)  => s + r.precio * r.cantidad, 0);
  const totGas = gastos.reduce((s, r)   => s + r.precio, 0);
  const saldo  = totIng - totCom - totGas;

  // Cash flow
  document.getElementById('rep-ingresos').textContent = fmt(totIng);
  document.getElementById('rep-compras').textContent  = fmt(totCom);
  document.getElementById('rep-gastos').textContent   = fmt(totGas);
  document.getElementById('rep-saldo').textContent    = fmt(saldo);
  document.getElementById('rep-saldo').className =
    'cashflow-value total ' + (saldo >= 0 ? 'pos' : 'neg');

  // Métricas
  document.getElementById('rep-nventas').textContent  = ingresos.length;
  document.getElementById('rep-ncompras').textContent = compras.length;
  document.getElementById('rep-ngastos').textContent  = gastos.length;
  document.getElementById('rep-ninv').textContent     = getInventario().length;

  // Gráfico de barras proporcional
  const max = Math.max(totIng, totCom, totGas, 1);
  document.getElementById('bar-ingresos').style.width = `${(totIng / max * 100).toFixed(1)}%`;
  document.getElementById('bar-compras').style.width  = `${(totCom / max * 100).toFixed(1)}%`;
  document.getElementById('bar-gastos').style.width   = `${(totGas / max * 100).toFixed(1)}%`;
  document.getElementById('bar-ing-label').textContent = fmt(totIng);
  document.getElementById('bar-com-label').textContent = fmt(totCom);
  document.getElementById('bar-gas-label').textContent = fmt(totGas);

  // Forma de pago breakdown
  const pagoTotals = {};
  [...ingresos, ...compras, ...gastos].forEach(r => {
    pagoTotals[r.pago] = (pagoTotals[r.pago] || 0) + (r.precio * (r.cantidad || 1));
  });
  const pagoContainer = document.getElementById('rep-pagos');
  const pagoIcons = { efectivo: '💵', credito: '📋', transferencia: '🏦', tarjeta: '💳' };
  pagoContainer.innerHTML = Object.entries(pagoTotals).length === 0
    ? '<p style="color:var(--gray-400);font-size:.85rem">Sin datos</p>'
    : Object.entries(pagoTotals).map(([k, v]) => `
      <div class="cashflow-row">
        <span class="cashflow-label">${pagoIcons[k] || '💰'} ${k.charAt(0).toUpperCase() + k.slice(1)}</span>
        <span class="cashflow-value">${fmt(v)}</span>
      </div>
    `).join('');
}

// ─── Payment buttons ──────────────────────────────────────────
function initPaymentBtns() {
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = btn.closest('form');
      form.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  // Default selection
  document.querySelectorAll('.payment-options').forEach(group => {
    group.querySelector('.payment-btn')?.classList.add('selected');
  });
}

function resetPaymentBtns(formId) {
  const form = document.getElementById(formId);
  form.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('selected'));
  form.querySelector('.payment-btn')?.classList.add('selected');
}

// ─── WEB SPEECH API ───────────────────────────────────────────
// Config por módulo: qué botón, qué transcript, qué campos llenar
const VOICE_CONFIG = {
  ingresos: {
    btnId:        'voice-btn-ingresos',
    transcriptId: 'voice-transcript-ingresos',
    formId:       'form-ingresos',
    campoProducto:'ing-producto',
    campoCantidad:'ing-cantidad',
    campoPrecio:  'ing-precio',
    ejemplos: [
      '"Vendí 3 café volcán a 31000 en efectivo"',
      '"Vendí 5 café finca a 65000 por nequi"',
    ],
  },
  compras: {
    btnId:        'voice-btn-compras',
    transcriptId: 'voice-transcript-compras',
    formId:       'form-compras',
    campoProducto:'com-producto',
    campoCantidad:'com-cantidad',
    campoPrecio:  'com-precio',
    ejemplos: [
      '"Compré 100 café volcán a 11460 en efectivo"',
      '"Compré 50 café colina a 36650 por transferencia"',
    ],
  },
  gastos: {
    btnId:        'voice-btn-gastos',
    transcriptId: 'voice-transcript-gastos',
    formId:       'form-gastos',
    campoProducto:'gas-descripcion',
    campoCantidad: null,          // gastos no tiene cantidad
    campoPrecio:  'gas-precio',
    ejemplos: [
      '"Pagué arriendo por 2000000 en transferencia"',
      '"Gasté 150000 en internet por nequi"',
    ],
  },
};

function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.querySelectorAll('.btn-voice').forEach(b => {
      b.style.opacity = '.4';
      b.title = 'Tu navegador no soporta reconocimiento de voz';
      b.disabled = true;
    });
    return;
  }

  // Inicializar un listener de voz por módulo
  Object.entries(VOICE_CONFIG).forEach(([modulo, cfg]) => {
    const btn         = document.getElementById(cfg.btnId);
    const transcriptEl= document.getElementById(cfg.transcriptId);
    if (!btn || !transcriptEl) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.continuous = false;
    recognition.interimResults = false;

    let listening = false;

    btn.addEventListener('click', () => {
      if (listening) { recognition.stop(); return; }

      // Detener cualquier otro micrófono activo
      document.querySelectorAll('.btn-voice.listening').forEach(b => b.click());

      listening = true;
      btn.classList.add('listening');
      btn.innerHTML = '🔴 Escuchando...';
      transcriptEl.classList.add('visible');
      transcriptEl.innerHTML = `<div class="mic-dot"></div><span>Habla ahora... Ej: ${cfg.ejemplos[0]}</span>`;
      recognition.start();
    });

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript.toLowerCase().trim();
      transcriptEl.innerHTML = `<span>🎤 "${transcript}"</span>`;
      parseVoiceCommand(transcript, modulo, cfg);
    };

    recognition.onerror = () => {
      toast('No se pudo escuchar. Intenta de nuevo.', 'error', '🎤');
      stopListening();
    };

    recognition.onend = stopListening;

    function stopListening() {
      listening = false;
      btn.classList.remove('listening');
      btn.innerHTML = '🎤 Registrar por voz';
      setTimeout(() => transcriptEl.classList.remove('visible'), 4000);
    }
  });
}

// ─── Parser de comando de voz (universal) ────────────────────
function parseVoiceCommand(text, modulo, cfg) {
  // ── Normalizar números escritos en palabras (español colombiano) ──
  const numWords = {
    'cero':0,'un':1,'uno':1,'una':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,
    'seis':6,'siete':7,'ocho':8,'nueve':9,'diez':10,'once':11,'doce':12,
    'trece':13,'catorce':14,'quince':15,'veinte':20,'treinta':30,
    'cuarenta':40,'cincuenta':50,'sesenta':60,'setenta':70,'ochenta':80,
    'noventa':90,'cien':100,'ciento':100,'doscientos':200,'trescientos':300,
    'cuatrocientos':400,'quinientos':500,'seiscientos':600,'setecientos':700,
    'ochocientos':800,'novecientos':900,'mil':1000,'millon':1000000,'millón':1000000,
  };
  let normalizado = text;
  Object.entries(numWords).forEach(([w, n]) => {
    normalizado = normalizado.replace(new RegExp(`\\b${w}\\b`, 'gi'), n);
  });

  // ── Mapa de formas de pago ──
  const pagoMap = {
    efectivo:'efectivo', contado:'efectivo',
    'crédito':'credito', credito:'credito', fiado:'credito',
    transferencia:'transferencia', nequi:'transferencia',
    daviplata:'transferencia', bancolombia:'transferencia',
    tarjeta:'tarjeta',
  };
  const pagoMatch = Object.keys(pagoMap).find(k => normalizado.includes(k));
  const pago = pagoMap[pagoMatch] || 'efectivo';

  // ── Extraer TODOS los números del texto ──
  const todosNums = [...normalizado.matchAll(/\b(\d+(?:[.,]\d+)?)\b/g)]
    .map(m => parseFloat(m[1].replace(',', '.')))
    .filter(n => !isNaN(n));

  // Lógica: el número más grande es el precio, el más pequeño es la cantidad
  // Salvo que haya solo uno → es el precio
  let cantidad = 1;
  let precio   = 0;

  if (todosNums.length === 0) {
    toast('No detecté cantidad ni precio. Intenta de nuevo.', 'warning', '⚠️');
    return;
  } else if (todosNums.length === 1) {
    // Solo un número: si es grande (>500) lo tomamos como precio, si es pequeño como cantidad
    if (todosNums[0] > 500) {
      precio = todosNums[0];
    } else {
      cantidad = todosNums[0];
      toast('Falta el precio. Puedes completarlo manualmente.', 'warning', '💡');
    }
  } else {
    // Varios números: el mayor es precio, el menor es cantidad
    const sorted = [...todosNums].sort((a, b) => a - b);
    cantidad = sorted[0];
    precio   = sorted[sorted.length - 1];
  }

  // ── Palabras clave de acción a eliminar ──
  const accionesIngreso = /\b(vend[ií]|vendimos|venta|ventas|cobré|cobr[eé])\b/gi;
  const accionesCompra  = /\b(compr[eé]|compramos|compra|compras|adquir[ií])\b/gi;
  const accionesGasto   = /\b(pagu[eé]|pagué|pagamos|gast[eé]|gasté|gastamos|gasto|abonamos)\b/gi;
  const accionPrecios   = /\b(a|por|valor|precio|cada|unitario|cuesta|vale|en|con|de|al|el|la|los|las|un|una|pesos)\b/gi;

  // ── Extraer nombre del producto / descripción ──
  let nombre = normalizado
    .replace(accionesIngreso, '')
    .replace(accionesCompra, '')
    .replace(accionesGasto, '')
    .replace(new RegExp(`\\b${pagoMatch || ''}\\b`, 'gi'), '')
    .replace(/\b(efectivo|contado|crédito|credito|fiado|transferencia|nequi|daviplata|bancolombia|tarjeta)\b/gi, '')
    .replace(/\b\d+(?:[.,]\d+)?\b/g, '')  // quitar todos los números
    .replace(accionPrecios, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!nombre || nombre.length < 2) {
    toast('No entendí el producto. Intenta incluir el nombre.', 'warning', '⚠️');
    return;
  }

  // ── Rellenar formulario ──
  document.getElementById(cfg.campoProducto).value = capitalize(nombre);
  if (cfg.campoCantidad) document.getElementById(cfg.campoCantidad).value = cantidad;
  if (cfg.campoPrecio && precio > 0) document.getElementById(cfg.campoPrecio).value = precio;

  // ── Seleccionar forma de pago ──
  document.querySelectorAll(`#${cfg.formId} .payment-btn`).forEach(b => {
    b.classList.toggle('selected', b.dataset.val === pago);
  });

  // ── Feedback ──
  const resumen = cfg.campoCantidad
    ? `${capitalize(nombre)} · ${cantidad} und · $${precio.toLocaleString('es-CO')} · ${pago}`
    : `${capitalize(nombre)} · $${precio.toLocaleString('es-CO')} · ${pago}`;
  toast(resumen, 'success', '🎤');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── PWA Install ──────────────────────────────────────────────
function initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    STATE.deferredInstallPrompt = e;
    const banner = document.getElementById('install-banner');
    banner.classList.add('visible');

    document.getElementById('install-accept').addEventListener('click', async () => {
      banner.classList.remove('visible');
      const result = await STATE.deferredInstallPrompt.prompt();
      if (result.outcome === 'accepted') toast('¡App instalada exitosamente! 🎉', 'success', '📱');
    });

    document.getElementById('install-dismiss').addEventListener('click', () => {
      banner.classList.remove('visible');
    });
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

// ─── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Forms
  document.getElementById('form-ingresos').addEventListener('submit', registrarIngreso);
  document.getElementById('form-compras').addEventListener('submit',  registrarCompra);
  document.getElementById('form-gastos').addEventListener('submit',   registrarGasto);

  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.nav));
  });

  // Module cards
  document.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.view));
  });

  // Back button
  document.querySelector('.header-back').addEventListener('click', () => navigate('home'));

  // Payment buttons
  initPaymentBtns();

  // Voice
  initVoice();

  // PWA
  initPWA();

  // Inventory search
  document.getElementById('inv-search').addEventListener('input', (e) => {
    renderInventario(e.target.value);
  });

  // Cargar datos de prueba si es la primera vez
  loadSeedData();

  // Initial render
  renderHome();

  // Check hash
  const hash = location.hash.replace('#', '');
  if (hash && ['ingresos','compras','gastos','inventario','reportes'].includes(hash)) {
    navigate(hash);
  }
});

// ─── Reset datos de prueba ────────────────────────────────────
function resetSeedData() {
  if (!confirm('¿Restablecer los datos de prueba del Excel? Esto borrará los registros actuales.')) return;
  localStorage.removeItem('mn_seeded');
  localStorage.removeItem('mn_ingresos');
  localStorage.removeItem('mn_compras');
  localStorage.removeItem('mn_gastos');
  localStorage.removeItem('mn_inventario');
  loadSeedData();
  renderHome();
  renderReportes();
  toast('Datos de prueba restablecidos ✅', 'success', '🔄');
}
