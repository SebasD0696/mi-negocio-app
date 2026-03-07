/* ============================================================
   KeepInventory PWA v3 — Lógica principal
   ============================================================ */
'use strict';

const STATE = { currentView:'home', listening:false, deferredInstallPrompt:null, periodoReporte:'mensual' };

const DB = {
  get:  (key)      => JSON.parse(localStorage.getItem(key)||'[]'),
  set:  (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  push: (key, item) => { const a=DB.get(key); a.unshift(item); DB.set(key,a); return a; },
};

const KEYS = {
  ingresos:'mn_ingresos', abonos:'mn_abonos',
  compras:'mn_compras',   pagosprov:'mn_pagosprov',
  gastos:'mn_gastos',     pagosgasto:'mn_pagosgasto',
  inventario:'mn_inventario',
};

// Estado de filtros por sección (independiente del reporte global)
const FILTROS = { ingresos:'mensual', compras:'mensual', gastos:'mensual' };

const SEED_DATA = {
  ingresos:[
    {id:1740100004,producto:'Café Colina en grano 454gr',            cantidad:250,precio:56650,pago:'credito',      cliente:'Tienda La Esquina',   fecha:'2026-03-06T08:30:00'},
    {id:1740100003,producto:'Café Origen Nariño en granos 454gr',    cantidad:200,precio:65780,pago:'transferencia',cliente:'Distribuidora Norte', fecha:'2026-03-05T10:15:00'},
    {id:1740100002,producto:'Café Mujeres Cafeteras en granos 454gr',cantidad:150,precio:65780,pago:'transferencia',cliente:'Cafetería Central',   fecha:'2026-03-04T09:00:00'},
    {id:1740100001,producto:'Café Finca en grano 454gr',             cantidad:100,precio:65780,pago:'transferencia',cliente:'Restaurante El Lago', fecha:'2026-03-03T11:45:00'},
    {id:1740100000,producto:'Café Volcán en granos 250gr',           cantidad: 50,precio:31460,pago:'efectivo',     cliente:'Cliente general',     fecha:'2026-03-01T14:20:00'},
  ],
  abonos:[
    {id:1740150000,clienteRef:'Tienda La Esquina',   monto:5000000,fecha:'2026-03-06T09:00:00',nota:'Abono parcial'},
    {id:1740150001,clienteRef:'Distribuidora Norte', monto:3000000,fecha:'2026-03-06T10:00:00',nota:'Abono cuota 1'},
  ],
  compras:[
    {id:1740000004,producto:'Café Colina en grano 454gr',            cantidad:300,precio:36650,pago:'credito',      proveedor:'Caficultor Nariño S.A.',fecha:'2026-03-05T07:00:00'},
    {id:1740000003,producto:'Café Origen Nariño en granos 454gr',    cantidad:250,precio:45780,pago:'credito',      proveedor:'Caficultor Nariño S.A.',fecha:'2026-03-04T07:30:00'},
    {id:1740000002,producto:'Café Mujeres Cafeteras en granos 454gr',cantidad:200,precio:45780,pago:'transferencia',proveedor:'Cooperativa Café Sur',  fecha:'2026-03-03T08:00:00'},
    {id:1740000001,producto:'Café Finca en grano 454gr',             cantidad:150,precio:45780,pago:'transferencia',proveedor:'Cooperativa Café Sur',  fecha:'2026-03-02T08:00:00'},
    {id:1740000000,producto:'Café Volcán en granos 250gr',           cantidad:100,precio:11460,pago:'efectivo',     proveedor:'Finca El Paraíso',      fecha:'2026-03-01T07:00:00'},
  ],
  pagosprov:[
    {id:1740050000,proveedorRef:'Caficultor Nariño S.A.',monto:10000000,fecha:'2026-03-06T11:00:00',nota:'Abono factura marzo'},
  ],
  gastos:[
    {id:1740200007,descripcion:'Vigilancia',      precio:  70000,pago:'transferencia',fecha:'2026-03-06T16:00:00'},
    {id:1740200006,descripcion:'Útiles de Aseo',  precio:  50000,pago:'transferencia',fecha:'2026-03-05T16:00:00'},
    {id:1740200005,descripcion:'Arriendo',         precio:2000000,pago:'credito',      fecha:'2026-03-04T16:00:00'},
    {id:1740200004,descripcion:'Seguridad Social', precio: 500000,pago:'transferencia',fecha:'2026-03-04T17:00:00'},
    {id:1740200003,descripcion:'Nómina',           precio:2000000,pago:'transferencia',fecha:'2026-03-03T17:00:00'},
    {id:1740200002,descripcion:'Internet',         precio: 150000,pago:'transferencia',fecha:'2026-03-03T16:00:00'},
    {id:1740200001,descripcion:'Luz',              precio:  70000,pago:'transferencia',fecha:'2026-03-02T16:00:00'},
    {id:1740200000,descripcion:'Agua',             precio: 100000,pago:'transferencia',fecha:'2026-03-01T16:00:00'},
  ],
  pagosgasto:[
    {id:1740250000,descripcionRef:'Arriendo',monto:1000000,fecha:'2026-03-06T15:00:00',nota:'Primera cuota arriendo'},
  ],
  inventario:[
    {producto:'Café Volcán en granos 250gr',            cantidad:50},
    {producto:'Café Finca en grano 454gr',              cantidad:50},
    {producto:'Café Mujeres Cafeteras en granos 454gr', cantidad:50},
    {producto:'Café Origen Nariño en granos 454gr',     cantidad:50},
    {producto:'Café Colina en grano 454gr',             cantidad:50},
  ],
};

function loadSeedData() {
  if (localStorage.getItem('mn_seeded')==='4') return;
  Object.entries(KEYS).forEach(([k,key]) => { if(SEED_DATA[k]) DB.set(key,SEED_DATA[k]); });
  localStorage.setItem('mn_seeded','4');
}

// ─── Utilidades ───────────────────────────────────────────────
const fmt = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n||0);
const fmtDate = iso => new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});

function filtrarPorPeriodo(lista, periodo) {
  const now = new Date();
  let desde;
  if (periodo==='diario') {
    desde = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
  if (periodo==='semanal') {
    const day = now.getDay(); // 0=dom, 1=lun ...
    const diff = now.getDate() - day + (day===0 ? -6 : 1); // lunes como inicio
    desde = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
  }
  if (periodo==='mensual') {
    desde = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
  if (!desde) return lista;
  return lista.filter(r => new Date(r.fecha) >= desde);
}

function toast(msg,type='success',icon='') {
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`${icon?`<span>${icon}</span>`:''}<span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(),3100);
}

// ─── Navegación ───────────────────────────────────────────────
function navigate(viewId) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const target=document.getElementById(`view-${viewId}`);
  if(!target) return;
  target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelector(`[data-nav="${viewId}"]`)?.classList.add('active');
  document.querySelector('.header-back').classList.toggle('visible',viewId!=='home');
  STATE.currentView=viewId;
  if(viewId==='home')       renderHome();
  if(viewId==='inventario') renderInventario();
  if(viewId==='reportes')   renderReportes();
  if(viewId==='ingresos')   { renderRecords('ingresos', FILTROS.ingresos); renderAbonos(); syncPeriodoBtns('ingresos'); }
  if(viewId==='compras')    { renderRecords('compras', FILTROS.compras);   renderPagosProveedores(); syncPeriodoBtns('compras'); }
  if(viewId==='gastos')     { renderRecords('gastos', FILTROS.gastos);     renderPagosGastos(); syncPeriodoBtns('gastos'); }
}

// Sincroniza los botones periodo-btn del historial al estado FILTROS
function syncPeriodoBtns(tipo) {
  const seccion = document.getElementById(`view-${tipo}`);
  if (!seccion) return;
  seccion.querySelectorAll('.historial-periodo-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.p === FILTROS[tipo]);
  });
}

// ─── Inventario ───────────────────────────────────────────────
function getInventario() { return DB.get(KEYS.inventario); }
function updateInventario(producto, delta) {
  let inv=getInventario();
  const nom=producto.trim().toLowerCase();
  const idx=inv.findIndex(i=>i.producto.toLowerCase()===nom);
  if(idx>=0) inv[idx].cantidad=Math.max(0,inv[idx].cantidad+delta);
  else if(delta>0) inv.push({producto:producto.trim(),cantidad:delta});
  DB.set(KEYS.inventario,inv);
}

// ─── HOME ─────────────────────────────────────────────────────
function renderHome() {
  const ing=DB.get(KEYS.ingresos).reduce((s,r)=>s+r.precio*r.cantidad,0);
  const com=DB.get(KEYS.compras).reduce((s,r)=>s+r.precio*r.cantidad,0);
  const gas=DB.get(KEYS.gastos).reduce((s,r)=>s+r.precio,0);
  const saldo=ing-com-gas;
  document.getElementById('home-ingresos').textContent=fmt(ing);
  document.getElementById('home-saldo').textContent=fmt(saldo);
  document.getElementById('home-saldo').className='hero-stat-value '+(saldo>=0?'positive':'negative');
  document.getElementById('cnt-ingresos').textContent=`${DB.get(KEYS.ingresos).length} ventas`;
  document.getElementById('cnt-compras').textContent=`${DB.get(KEYS.compras).length} registros`;
  document.getElementById('cnt-gastos').textContent=`${DB.get(KEYS.gastos).length} registros`;
  document.getElementById('cnt-inventario').textContent=`${getInventario().length} productos`;
  const recent=[
    ...DB.get(KEYS.ingresos).slice(0,3).map(r=>({tipo:'ingreso',label:r.producto,  monto: r.precio*r.cantidad,fecha:r.fecha})),
    ...DB.get(KEYS.compras).slice(0,2).map(r =>({tipo:'compra', label:r.producto,  monto:-(r.precio*r.cantidad),fecha:r.fecha})),
    ...DB.get(KEYS.gastos).slice(0,2).map(r  =>({tipo:'gasto',  label:r.descripcion,monto:-r.precio,fecha:r.fecha})),
  ].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).slice(0,5);
  const list=document.getElementById('activity-list');
  if(!recent.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Sin actividad aún</div></div>';return;}
  list.innerHTML=recent.map(r=>`<div class="activity-item"><div class="activity-dot ${r.tipo}"></div><div class="activity-text">${r.label}</div><div class="activity-amount ${r.monto>=0?'pos':'neg'}">${fmt(Math.abs(r.monto))}</div></div>`).join('');
}

// ─── INGRESOS ─────────────────────────────────────────────────
function registrarIngreso(e) {
  e.preventDefault();
  const producto=document.getElementById('ing-producto').value.trim();
  const cantidad=parseInt(document.getElementById('ing-cantidad').value);
  const precio  =parseFloat(document.getElementById('ing-precio').value);
  const pago    =document.querySelector('#form-ingresos .payment-btn.selected')?.dataset.val||'efectivo';
  const cliente =document.getElementById('ing-cliente').value.trim()||'Cliente general';
  if(!producto||!cantidad||!precio){toast('Completa todos los campos','error','⚠️');return;}

  // Validar stock disponible
  const inv = getInventario();
  const nom  = producto.trim().toLowerCase();
  const item = inv.find(i => i.producto.toLowerCase() === nom);
  if(!item){
    toast(`"${producto}" no existe en inventario. Agrégalo primero.`,'error','📦');return;
  }
  if(item.cantidad < cantidad){
    toast(`Stock insuficiente: solo hay ${item.cantidad} und de "${item.producto}"`,'error','📦');return;
  }

  DB.push(KEYS.ingresos,{id:Date.now(),producto,cantidad,precio,pago,cliente,fecha:new Date().toISOString()});
  updateInventario(producto,-cantidad);
  toast(`Venta registrada: ${producto}`,'success','✅');
  e.target.reset(); resetPaymentBtns('form-ingresos'); renderRecords('ingresos', FILTROS.ingresos); renderHome();
}

function registrarAbono(e) {
  e.preventDefault();
  const clienteRef=document.getElementById('abo-cliente').value.trim();
  const monto     =parseFloat(document.getElementById('abo-monto').value);
  const nota      =document.getElementById('abo-nota').value.trim();
  if(!clienteRef||!monto){toast('Completa cliente y monto','error','⚠️');return;}
  DB.push(KEYS.abonos,{id:Date.now(),clienteRef,monto,nota,fecha:new Date().toISOString()});
  toast(`Abono de ${clienteRef} registrado`,'success','💵');
  e.target.reset(); renderAbonos();
}

function renderAbonos() {
  const c=document.getElementById('records-abonos'); if(!c) return;
  const abonos=DB.get(KEYS.abonos);
  if(!abonos.length){c.innerHTML='<div class="empty-state"><div class="empty-icon">💵</div><div class="empty-title">Sin abonos registrados</div></div>';return;}
  c.innerHTML=abonos.map(a=>`<div class="record-item"><div class="record-left"><div class="record-product">👤 ${a.clienteRef}</div><div class="record-meta">${a.nota||'Abono'} · ${fmtDate(a.fecha)}</div></div><div class="record-right"><div class="record-amount pos">+${fmt(a.monto)}</div></div></div>`).join('');
}

// ─── COMPRAS ──────────────────────────────────────────────────
function registrarCompra(e) {
  e.preventDefault();
  const producto =document.getElementById('com-producto').value.trim();
  const cantidad =parseInt(document.getElementById('com-cantidad').value);
  const precio   =parseFloat(document.getElementById('com-precio').value);
  const pago     =document.querySelector('#form-compras .payment-btn.selected')?.dataset.val||'efectivo';
  const proveedor=document.getElementById('com-proveedor').value.trim()||'Proveedor general';
  if(!producto||!cantidad||!precio){toast('Completa todos los campos','error','⚠️');return;}
  DB.push(KEYS.compras,{id:Date.now(),producto,cantidad,precio,pago,proveedor,fecha:new Date().toISOString()});
  updateInventario(producto,+cantidad);
  toast(`Compra registrada: ${producto}`,'success','✅');
  e.target.reset(); resetPaymentBtns('form-compras'); renderRecords('compras', FILTROS.compras); renderHome();
}

function registrarPagoProveedor(e) {
  e.preventDefault();
  const proveedorRef=document.getElementById('pp-proveedor').value.trim();
  const monto       =parseFloat(document.getElementById('pp-monto').value);
  const nota        =document.getElementById('pp-nota').value.trim();
  if(!proveedorRef||!monto){toast('Completa proveedor y monto','error','⚠️');return;}
  DB.push(KEYS.pagosprov,{id:Date.now(),proveedorRef,monto,nota,fecha:new Date().toISOString()});
  toast(`Pago a ${proveedorRef} registrado`,'success','✅');
  e.target.reset(); renderPagosProveedores();
}

function renderPagosProveedores() {
  const c=document.getElementById('records-pagosprov'); if(!c) return;
  const pagos=DB.get(KEYS.pagosprov);
  if(!pagos.length){c.innerHTML='<div class="empty-state"><div class="empty-icon">🏭</div><div class="empty-title">Sin pagos a proveedores</div></div>';return;}
  c.innerHTML=pagos.map(p=>`<div class="record-item"><div class="record-left"><div class="record-product">🏭 ${p.proveedorRef}</div><div class="record-meta">${p.nota||'Pago'} · ${fmtDate(p.fecha)}</div></div><div class="record-right"><div class="record-amount neg">-${fmt(p.monto)}</div></div></div>`).join('');
}

// ─── GASTOS ───────────────────────────────────────────────────
function registrarGasto(e) {
  e.preventDefault();
  const descripcion=document.getElementById('gas-descripcion').value.trim();
  const precio     =parseFloat(document.getElementById('gas-precio').value);
  const pago       =document.querySelector('#form-gastos .payment-btn.selected')?.dataset.val||'efectivo';
  if(!descripcion||!precio){toast('Completa todos los campos','error','⚠️');return;}
  DB.push(KEYS.gastos,{id:Date.now(),descripcion,precio,pago,fecha:new Date().toISOString()});
  toast(`Gasto registrado: ${descripcion}`,'success','✅');
  e.target.reset(); resetPaymentBtns('form-gastos'); renderRecords('gastos', FILTROS.gastos); renderHome();
}

function registrarPagoGasto(e) {
  e.preventDefault();
  const descripcionRef=document.getElementById('pg-descripcion').value.trim();
  const monto         =parseFloat(document.getElementById('pg-monto').value);
  const nota          =document.getElementById('pg-nota').value.trim();
  if(!descripcionRef||!monto){toast('Completa descripción y monto','error','⚠️');return;}
  DB.push(KEYS.pagosgasto,{id:Date.now(),descripcionRef,monto,nota,fecha:new Date().toISOString()});
  toast(`Pago de gasto registrado`,'success','✅');
  e.target.reset(); renderPagosGastos();
}

function renderPagosGastos() {
  const c=document.getElementById('records-pagosgasto'); if(!c) return;
  const pagos=DB.get(KEYS.pagosgasto);
  if(!pagos.length){c.innerHTML='<div class="empty-state"><div class="empty-icon">💸</div><div class="empty-title">Sin pagos de gastos</div></div>';return;}
  c.innerHTML=pagos.map(p=>`<div class="record-item"><div class="record-left"><div class="record-product">💸 ${p.descripcionRef}</div><div class="record-meta">${p.nota||'Pago'} · ${fmtDate(p.fecha)}</div></div><div class="record-right"><div class="record-amount neg">-${fmt(p.monto)}</div></div></div>`).join('');
}

// ─── Historial genérico ───────────────────────────────────────
const TIPO_META={ingresos:{icon:'💰',label:'ventas'},compras:{icon:'🛒',label:'compras'},gastos:{icon:'💸',label:'gastos'}};
function renderRecords(tipo, periodo) {
  const c=document.getElementById(`records-${tipo}`); if(!c) return;
  let records=DB.get(KEYS[tipo]);
  if(periodo) records=filtrarPorPeriodo(records,periodo);
  if(!records.length){c.innerHTML=`<div class="empty-state"><div class="empty-icon">${TIPO_META[tipo].icon}</div><div class="empty-title">Sin ${TIPO_META[tipo].label} en este período</div></div>`;return;}
  c.innerHTML=records.map(r=>{
    const isG=tipo==='gastos';
    const label=isG?r.descripcion:r.producto;
    const monto=isG?r.precio:r.precio*r.cantidad;
    const sub=isG?r.pago:`${r.cantidad} und × ${fmt(r.precio)} · ${r.pago}${r.cliente?' · '+r.cliente:''}${r.proveedor?' · '+r.proveedor:''}`;
    return `<div class="record-item"><div class="record-left"><div class="record-product">${label}</div><div class="record-meta">${sub}</div></div><div class="record-right"><div class="record-amount ${tipo==='ingresos'?'pos':'neg'}">${tipo==='ingresos'?'+':'-'}${fmt(monto)}</div><div class="record-date">${fmtDate(r.fecha)}</div></div></div>`;
  }).join('');
}

// ─── INVENTARIO ───────────────────────────────────────────────
function registrarInventario(e) {
  e.preventDefault();
  const producto =document.getElementById('inv-producto').value.trim();
  const cantidad =parseInt(document.getElementById('inv-cantidad').value);
  if(!producto||!cantidad||cantidad<1){toast('Completa producto y cantidad','error','⚠️');return;}
  updateInventario(producto, cantidad);
  toast(`Inventario actualizado: ${producto}`,'success','✅');
  e.target.reset(); renderInventario(); renderHome();
}

function renderInventario(filter='') {
  const inv=getInventario();
  const alert=document.getElementById('inv-alert');
  const zeros=inv.filter(i=>i.cantidad===0), lows=inv.filter(i=>i.cantidad>0&&i.cantidad<10);
  if(zeros.length||lows.length){alert.textContent=zeros.length?`⚠️ ${zeros.length} producto(s) sin stock`:`⚠️ ${lows.length} producto(s) con stock bajo (<10)`;alert.style.display='flex';}
  else alert.style.display='none';
  const lista=filter?inv.filter(i=>i.producto.toLowerCase().includes(filter.toLowerCase())):inv;
  const tbody=document.getElementById('inv-tbody');
  if(!lista.length){tbody.innerHTML=`<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--gray-400)">${filter?'Sin resultados':'Sin productos'}</td></tr>`;return;}
  tbody.innerHTML=lista.map(item=>{
    const cls=item.cantidad===0?'zero':item.cantidad<10?'low':'ok';
    const icon=item.cantidad===0?'🔴':item.cantidad<10?'🟡':'🟢';
    return `<tr><td>${item.producto}</td><td><span class="stock-badge ${cls}">${icon} ${item.cantidad}</span></td><td><button onclick="editarStock('${item.producto.replace(/'/g,"\\'")}') " style="background:none;border:1px solid var(--gray-200);border-radius:6px;padding:4px 8px;font-size:.75rem;cursor:pointer">✏️</button></td></tr>`;
  }).join('');
}
function editarStock(producto) {
  const n=parseInt(prompt(`Nuevo stock para "${producto}":`,'')||'');
  if(isNaN(n)||n<0){toast('Cantidad inválida','error','⚠️');return;}
  let inv=getInventario(); const idx=inv.findIndex(i=>i.producto===producto);
  if(idx>=0){inv[idx].cantidad=n;DB.set(KEYS.inventario,inv);renderInventario();toast('Stock actualizado','success','✅');}
}

// ─── REPORTES ─────────────────────────────────────────────────
function renderReportes() {
  const p=STATE.periodoReporte;
  const ingresos=filtrarPorPeriodo(DB.get(KEYS.ingresos),p);
  const compras =filtrarPorPeriodo(DB.get(KEYS.compras),p);
  const gastos  =filtrarPorPeriodo(DB.get(KEYS.gastos),p);

  const totIng=ingresos.reduce((s,r)=>s+r.precio*r.cantidad,0);
  const totCom=compras.reduce((s,r) =>s+r.precio*r.cantidad,0);
  const totGas=gastos.reduce((s,r)  =>s+r.precio,0);

  const ingEfec=ingresos.filter(r=>r.pago==='efectivo'||r.pago==='transferencia').reduce((s,r)=>s+r.precio*r.cantidad,0);
  const comEfec=compras.filter(r =>r.pago==='efectivo'||r.pago==='transferencia').reduce((s,r)=>s+r.precio*r.cantidad,0);
  const gasEfec=gastos.filter(r  =>r.pago==='efectivo'||r.pago==='transferencia').reduce((s,r)=>s+r.precio,0);
  const caja=ingEfec-comEfec-gasEfec;

  document.getElementById('fc-ing').textContent  =fmt(ingEfec);
  document.getElementById('fc-com').textContent  =fmt(comEfec);
  document.getElementById('fc-gas').textContent  =fmt(gasEfec);
  document.getElementById('fc-total').textContent=fmt(caja);
  document.getElementById('fc-total').className  ='cashflow-value total '+(caja>=0?'pos':'neg');

  const util=totIng-totCom-totGas;
  document.getElementById('er-ing').textContent    =fmt(totIng);
  document.getElementById('er-costo').textContent  =fmt(totCom);
  document.getElementById('er-gastos').textContent =fmt(totGas);
  document.getElementById('er-utilidad').textContent=fmt(util);
  document.getElementById('er-utilidad').className ='cashflow-value total '+(util>=0?'pos':'neg');
  document.getElementById('er-label').textContent  =util>=0?'= Utilidad del período':'= Pérdida del período';

  const max=Math.max(totIng,totCom,totGas,1);
  document.getElementById('bar-ingresos').style.width=`${(totIng/max*100).toFixed(1)}%`;
  document.getElementById('bar-compras').style.width =`${(totCom/max*100).toFixed(1)}%`;
  document.getElementById('bar-gastos').style.width  =`${(totGas/max*100).toFixed(1)}%`;
  document.getElementById('bar-ing-label').textContent=fmt(totIng);
  document.getElementById('bar-com-label').textContent=fmt(totCom);
  document.getElementById('bar-gas-label').textContent=fmt(totGas);

  renderCuentasPorCobrar(ingresos);
  renderCuentasPorPagar(compras,gastos);
}

function renderCuentasPorCobrar(ingresos) {
  const creditos=ingresos.filter(r=>r.pago==='credito');
  const abonos=DB.get(KEYS.abonos);
  const mapa={};
  creditos.forEach(r=>{ const k=r.cliente||'Cliente general'; mapa[k]=(mapa[k]||0)+r.precio*r.cantidad; });
  abonos.forEach(a=>{ if(mapa[a.clienteRef]!==undefined) mapa[a.clienteRef]=Math.max(0,mapa[a.clienteRef]-a.monto); });
  const total=Object.values(mapa).reduce((s,v)=>s+v,0);
  document.getElementById('cxc-total').textContent=fmt(total);
  const c=document.getElementById('cxc-list');
  const entries=Object.entries(mapa).filter(([,v])=>v>0);
  if(!entries.length){c.innerHTML='<p style="color:var(--gray-400);font-size:.85rem;padding:8px 0">✅ Sin saldos pendientes por cobrar</p>';return;}
  c.innerHTML=entries.map(([k,v])=>`<div class="cashflow-row"><span class="cashflow-label">👤 ${k}</span><span class="cashflow-value pos">${fmt(v)}</span></div>`).join('');
}

function renderCuentasPorPagar(compras,gastos) {
  const pagosprov =DB.get(KEYS.pagosprov);
  const pagosgasto=DB.get(KEYS.pagosgasto);
  const mapaProv={};
  compras.filter(r=>r.pago==='credito').forEach(r=>{ const k=r.proveedor||'Proveedor'; mapaProv[k]=(mapaProv[k]||0)+r.precio*r.cantidad; });
  pagosprov.forEach(p=>{ if(mapaProv[p.proveedorRef]!==undefined) mapaProv[p.proveedorRef]=Math.max(0,mapaProv[p.proveedorRef]-p.monto); });
  const mapaGas={};
  gastos.filter(r=>r.pago==='credito').forEach(r=>{ mapaGas[r.descripcion]=(mapaGas[r.descripcion]||0)+r.precio; });
  pagosgasto.forEach(p=>{ if(mapaGas[p.descripcionRef]!==undefined) mapaGas[p.descripcionRef]=Math.max(0,mapaGas[p.descripcionRef]-p.monto); });
  const total=Object.values(mapaProv).reduce((s,v)=>s+v,0)+Object.values(mapaGas).reduce((s,v)=>s+v,0);
  document.getElementById('cxp-total').textContent=fmt(total);
  const c=document.getElementById('cxp-list');
  const pEntries=Object.entries(mapaProv).filter(([,v])=>v>0);
  const gEntries=Object.entries(mapaGas).filter(([,v])=>v>0);
  if(!pEntries.length&&!gEntries.length){c.innerHTML='<p style="color:var(--gray-400);font-size:.85rem;padding:8px 0">✅ Sin saldos pendientes por pagar</p>';return;}
  let html='';
  if(pEntries.length){html+='<p class="cxp-section-label">PROVEEDORES</p>'+pEntries.map(([k,v])=>`<div class="cashflow-row"><span class="cashflow-label">🏭 ${k}</span><span class="cashflow-value neg">${fmt(v)}</span></div>`).join('');}
  if(gEntries.length){html+='<p class="cxp-section-label" style="margin-top:10px">GASTOS PENDIENTES</p>'+gEntries.map(([k,v])=>`<div class="cashflow-row"><span class="cashflow-label">💸 ${k}</span><span class="cashflow-value neg">${fmt(v)}</span></div>`).join('');}
  c.innerHTML=html;
}

function setPeriodo(p) {
  STATE.periodoReporte=p;
  document.querySelectorAll('.periodo-btn').forEach(b=>b.classList.toggle('active',b.dataset.p===p));
  renderReportes();
}

// ─── Periodo historial por sección ───────────────────────────
function setHistorialPeriodo(tipo, p) {
  FILTROS[tipo] = p;
  const seccion = document.getElementById(`view-${tipo}`);
  if(seccion) {
    seccion.querySelectorAll('.historial-periodo-btn').forEach(b=>b.classList.toggle('active', b.dataset.p===p));
  }
  renderRecords(tipo, p);
}

// ─── Payment buttons ──────────────────────────────────────────
function initPaymentBtns() {
  document.querySelectorAll('.payment-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ btn.closest('form').querySelectorAll('.payment-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); });
  });
  document.querySelectorAll('.payment-options').forEach(g=>g.querySelector('.payment-btn')?.classList.add('selected'));
}
function resetPaymentBtns(formId) {
  const f=document.getElementById(formId);
  f.querySelectorAll('.payment-btn').forEach(b=>b.classList.remove('selected'));
  f.querySelector('.payment-btn')?.classList.add('selected');
}

// ─── Voice (ingresos, compras, gastos, inventario, abonos, pagosprov, pagosgasto) ──
const VOICE_CONFIG={
  ingresos:{btnId:'voice-btn-ingresos',transcriptId:'voice-transcript-ingresos',formId:'form-ingresos',campoProducto:'ing-producto',campoCantidad:'ing-cantidad',campoPrecio:'ing-precio',ejemplos:['\"Vendí 3 café volcán a 31460 en efectivo\"']},
  compras: {btnId:'voice-btn-compras', transcriptId:'voice-transcript-compras', formId:'form-compras', campoProducto:'com-producto',campoCantidad:'com-cantidad',campoPrecio:'com-precio', ejemplos:['\"Compré 100 café volcán a 11460 en efectivo\"']},
  gastos:  {btnId:'voice-btn-gastos',  transcriptId:'voice-transcript-gastos',  formId:'form-gastos',  campoProducto:'gas-descripcion',campoCantidad:null,        campoPrecio:'gas-precio', ejemplos:['\"Pagué arriendo por 2000000 en transferencia\"']},
  inventario:{btnId:'voice-btn-inventario',transcriptId:'voice-transcript-inventario',formId:'form-inventario',campoProducto:'inv-producto',campoCantidad:'inv-cantidad',campoPrecio:null,ejemplos:['"Agregué 50 café volcán al inventario"']},
  abono:   {btnId:'voice-btn-abono',   transcriptId:'voice-transcript-abono',   formId:'form-abono',   campoProducto:'abo-cliente',    campoCantidad:null,        campoPrecio:'abo-monto',  ejemplos:['\"Abono de Tienda La Esquina por 500000\"'], esAbono:true},
  pagoprov:{btnId:'voice-btn-pagoprov',transcriptId:'voice-transcript-pagoprov',formId:'form-pagoprov',campoProducto:'pp-proveedor',   campoCantidad:null,        campoPrecio:'pp-monto',   ejemplos:['\"Pago a Caficultor Nariño por 2000000\"'], esPago:true},
  pagogasto:{btnId:'voice-btn-pagogasto',transcriptId:'voice-transcript-pagogasto',formId:'form-pagogasto',campoProducto:'pg-descripcion',campoCantidad:null,      campoPrecio:'pg-monto',   ejemplos:['\"Pago de arriendo por 1000000\"'], esPago:true},
};

function initVoice() {
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){document.querySelectorAll('.btn-voice').forEach(b=>{b.style.opacity='.4';b.disabled=true;});return;}
  Object.entries(VOICE_CONFIG).forEach(([,cfg])=>{
    const btn=document.getElementById(cfg.btnId), tra=document.getElementById(cfg.transcriptId);
    if(!btn||!tra) return;
    const rec=new SR(); rec.lang='es-CO'; rec.continuous=false; rec.interimResults=false;
    let on=false;
    btn.addEventListener('click',()=>{
      if(on){rec.stop();return;}
      document.querySelectorAll('.btn-voice.listening').forEach(b=>b.click());
      on=true; btn.classList.add('listening'); btn.innerHTML='🔴 Escuchando...';
      tra.classList.add('visible'); tra.innerHTML=`<div class="mic-dot"></div><span>Habla... Ej: ${cfg.ejemplos[0]}</span>`;
      rec.start();
    });
    rec.onresult=e=>{ const t=e.results[0][0].transcript.toLowerCase().trim(); tra.innerHTML=`<span>🎤 "${t}"</span>`; parseVoiceCommand(t,cfg); };
    rec.onerror=()=>{toast('No se pudo escuchar','error','🎤');stop();};
    rec.onend=stop;
    function stop(){on=false;btn.classList.remove('listening');btn.innerHTML='🎤 Registrar por voz';setTimeout(()=>tra.classList.remove('visible'),4000);}
  });
}

function parseVoiceCommand(text,cfg) {
  const nw={'cero':0,'un':1,'uno':1,'una':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,'siete':7,'ocho':8,'nueve':9,'diez':10,'veinte':20,'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,'setenta':70,'ochenta':80,'noventa':90,'cien':100,'ciento':100,'mil':1000,'millón':1000000,'millon':1000000};
  let norm=text; Object.entries(nw).forEach(([w,n])=>{norm=norm.replace(new RegExp(`\\b${w}\\b`,'gi'),n);});
  const pm={'efectivo':'efectivo','contado':'efectivo','crédito':'credito','credito':'credito','fiado':'credito','transferencia':'transferencia','nequi':'transferencia','daviplata':'transferencia','bancolombia':'transferencia','tarjeta':'tarjeta'};
  const pk=Object.keys(pm).find(k=>norm.includes(k)); const pago=pm[pk]||'efectivo';
  const nums=[...norm.matchAll(/\b(\d+(?:[.,]\d+)?)\b/g)].map(m=>parseFloat(m[1].replace(',','.'))).filter(n=>!isNaN(n));
  let cantidad=1,precio=0;
  if(!nums.length){toast('No detecté números','warning','⚠️');return;}
  else if(nums.length===1){nums[0]>500?precio=nums[0]:cantidad=nums[0];}
  else{const s=[...nums].sort((a,b)=>a-b);cantidad=s[0];precio=s[s.length-1];}
  let nombre=norm
    .replace(/\b(vend[ií]|vendimos|compr[eé]|compramos|pagu[eé]|gast[eé]|abono de|abono|pago a|pago de)\b/gi,'')
    .replace(new RegExp(`\\b${pk||'XXXXX'}\\b`,'gi'),'')
    .replace(/\b(efectivo|contado|crédito|credito|fiado|transferencia|nequi|daviplata|bancolombia|tarjeta)\b/gi,'')
    .replace(/\b\d+(?:[.,]\d+)?\b/g,'')
    .replace(/\b(a|por|valor|precio|cada|en|con|de|al|el|la|los|las|un|una|pesos)\b/gi,' ')
    .replace(/\s+/g,' ').trim();
  if(!nombre||nombre.length<2){toast('No entendí el nombre','warning','⚠️');return;}
  document.getElementById(cfg.campoProducto).value=capitalize(nombre);
  if(cfg.campoCantidad) document.getElementById(cfg.campoCantidad).value=cantidad;
  if(cfg.campoPrecio&&precio>0) document.getElementById(cfg.campoPrecio).value=precio;
  if(!cfg.esAbono&&!cfg.esPago) {
    document.querySelectorAll(`#${cfg.formId} .payment-btn`).forEach(b=>b.classList.toggle('selected',b.dataset.val===pago));
  }
  const res=cfg.campoCantidad?`${capitalize(nombre)} · ${cantidad} und · $${precio.toLocaleString('es-CO')} · ${pago}`:`${capitalize(nombre)} · $${precio.toLocaleString('es-CO')}`;
  toast(res,'success','🎤');
}
function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1);}

// ─── PWA ──────────────────────────────────────────────────────
function initPWA() {
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); STATE.deferredInstallPrompt=e;
    document.getElementById('install-banner').classList.add('visible');
    document.getElementById('install-accept').addEventListener('click',async()=>{
      document.getElementById('install-banner').classList.remove('visible');
      const r=await STATE.deferredInstallPrompt.prompt();
      if(r.outcome==='accepted') toast('¡App instalada!','success','📱');
    });
    document.getElementById('install-dismiss').addEventListener('click',()=>document.getElementById('install-banner').classList.remove('visible'));
  });
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

function resetSeedData() {
  if(!confirm('¿Restablecer datos de prueba? Esto borrará todos los registros.')) return;
  Object.values(KEYS).forEach(k=>localStorage.removeItem(k));
  localStorage.removeItem('mn_seeded');
  loadSeedData(); renderHome(); renderReportes();
  toast('Datos de prueba restablecidos','success','🔄');
}

// ─── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('form-ingresos').addEventListener('submit',registrarIngreso);
  document.getElementById('form-abono').addEventListener('submit',registrarAbono);
  document.getElementById('form-compras').addEventListener('submit',registrarCompra);
  document.getElementById('form-pagoprov').addEventListener('submit',registrarPagoProveedor);
  document.getElementById('form-gastos').addEventListener('submit',registrarGasto);
  document.getElementById('form-pagogasto').addEventListener('submit',registrarPagoGasto);
  document.getElementById('form-inventario').addEventListener('submit',registrarInventario);

  document.querySelectorAll('.nav-item').forEach(i=>i.addEventListener('click',()=>navigate(i.dataset.nav)));
  document.querySelectorAll('.module-card').forEach(c=>c.addEventListener('click',()=>navigate(c.dataset.view)));
  document.querySelector('.header-back').addEventListener('click',()=>navigate('home'));

  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const g=btn.dataset.group;
      document.querySelectorAll(`.tab-btn[data-group="${g}"]`).forEach(b=>b.classList.remove('active'));
      document.querySelectorAll(`.tab-panel[data-group="${g}"]`).forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // Botones periodo del reporte global
  document.querySelectorAll('.periodo-btn').forEach(b=>b.addEventListener('click',()=>setPeriodo(b.dataset.p)));

  // Botones periodo del historial por sección (clase historial-periodo-btn)
  document.querySelectorAll('.historial-periodo-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      const tipo = b.dataset.tipo;
      const p    = b.dataset.p;
      setHistorialPeriodo(tipo, p);
    });
  });

  document.getElementById('inv-search').addEventListener('input',e=>renderInventario(e.target.value));

  initPaymentBtns(); initVoice(); initPWA(); loadSeedData(); renderHome();
  const hash=location.hash.replace('#','');
  if(['ingresos','compras','gastos','inventario','reportes'].includes(hash)) navigate(hash);
});
