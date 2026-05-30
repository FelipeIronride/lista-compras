/* =============================================
   LISTA DE COMPRAS — app.js v4
   ============================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore, collection, doc, onSnapshot,
  setDoc, deleteDoc, updateDoc, serverTimestamp,
  query, orderBy
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

/* ── FIREBASE ── */
const firebaseConfig = {
  apiKey: "AIzaSyAX2Q4WROUX3JbJq9EJHDBwBoAUhPSAX2U",
  authDomain: "lista-compras-4fff2.firebaseapp.com",
  projectId: "lista-compras-4fff2",
  storageBucket: "lista-compras-4fff2.firebasestorage.app",
  messagingSenderId: "341817759359",
  appId: "1:341817759359:web:1389580f9d244fbb75914a",
  measurementId: "G-PTTVVMJK4P"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* ── ESTADO ── */
let items    = [];
let hist     = [];
let priceMap = {};
let filtro   = '';

/* ── UTILS ── */
function fmt(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function parsePrice(s) {
  if (!s && s !== 0) return null;
  const n = parseFloat(String(s).replace(/[^\d,]/g, '').replace(',', '.'));
  return isNaN(n) || n <= 0 ? null : n;
}
function formatDate(d) {
  return d.toLocaleDateString('pt-BR') + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* ── ORDENAÇÃO: alfabético, coletados no final ── */
function ordenarItems(lista) {
  return [...lista].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

/* ── LISTENERS FIREBASE ── */
function iniciarListeners() {
  const itemsQuery = query(collection(db, 'items'), orderBy('criadoEm', 'asc'));
  onSnapshot(itemsQuery, (snapshot) => {
    items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });

  const histQuery = query(collection(db, 'historico'), orderBy('ts', 'desc'));
  onSnapshot(histQuery, (snapshot) => {
    hist = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    priceMap = {};
    [...hist].reverse().forEach(h => { priceMap[h.nome.toLowerCase()] = h.preco; });
    renderHistorico();
  });
}

/* ── AUTOSUGESTÃO ── */
function atualizarSugestoes(valor) {
  const datalist = document.getElementById('sugestoes-produtos');
  if (!datalist) return;
  const termo = valor.toLowerCase().trim();
  if (!termo) { datalist.innerHTML = ''; return; }
  const sugestoes = items
    .filter(i => i.nome.toLowerCase().includes(termo))
    .slice(0, 6);
  datalist.innerHTML = sugestoes.map(i => `<option value="${i.nome}"></option>`).join('');
}

/* ── ADICIONAR ITEM ── */
async function addItem() {
  const nomeEl  = document.getElementById('inp-nome');
  const qtdEl   = document.getElementById('inp-qtd');
  const precoEl = document.getElementById('inp-preco');

  const nome  = nomeEl.value.trim();
  if (!nome) { nomeEl.focus(); return; }

  const qtd   = parseInt(qtdEl.value) || 1;
  const preco = parsePrice(precoEl.value);

  const existing = items.find(i => i.nome.toLowerCase() === nome.toLowerCase());
  if (existing) {
    await updateDoc(doc(db, 'items', existing.id), {
      qtd: existing.qtd + qtd,
      ...(preco !== null ? { preco } : {})
    });
  } else {
    const id = gerarId();
    await setDoc(doc(db, 'items', id), {
      nome, qtd, preco: preco ?? null, done: false, criadoEm: serverTimestamp()
    });
  }

  if (preco !== null) await registrarHistorico(nome, preco, qtd, 'formulário');

  nomeEl.value  = '';
  qtdEl.value   = '1';
  precoEl.value = '';
  document.getElementById('sugestoes-produtos').innerHTML = '';
  nomeEl.focus();
}

/* ── HISTÓRICO ── */
async function registrarHistorico(nome, preco, qtd, origem) {
  const key = nome.toLowerCase();
  const prev = priceMap[key];
  const variation = prev !== undefined ? preco - prev : null;
  await setDoc(doc(db, 'historico', gerarId()), {
    nome, preco, qtd, origem, variation: variation ?? null, ts: serverTimestamp()
  });
}

/* ── PREÇO NA TABELA ── */
async function onPriceBlur(el, id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  const novoPreco = parsePrice(el.value);
  if (novoPreco !== null) {
    if (novoPreco !== item.preco) await registrarHistorico(item.nome, novoPreco, item.qtd, 'tabela');
    await updateDoc(doc(db, 'items', id), { preco: novoPreco });
    el.value = novoPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    el.classList.add('filled');
  } else if (el.value === '' || el.value === '0,00') {
    await updateDoc(doc(db, 'items', id), { preco: null });
    el.value = '';
    el.classList.remove('filled');
  }
}

/* ── EDITAR QUANTIDADE ── */
function editarQtd(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  const cell = document.getElementById(`qtd-cell-${id}`);
  if (!cell) return;
  cell.innerHTML = `
    <input
      id="qtd-input-${id}"
      class="qtd-input"
      type="number"
      inputmode="numeric"
      min="1"
      value="${item.qtd}"
      onblur="salvarQtd('${id}')"
      onkeydown="if(event.key==='Enter') this.blur()"
      style="width:54px;height:32px;text-align:center;background:var(--bg3);
             border:1px solid var(--blue);border-radius:6px;color:var(--text);
             font-size:14px;font-family:inherit;outline:none;"
    />`;
  document.getElementById(`qtd-input-${id}`)?.focus();
}

async function salvarQtd(id) {
  const input = document.getElementById(`qtd-input-${id}`);
  if (!input) return;
  const novaQtd = parseInt(input.value) || 1;
  await updateDoc(doc(db, 'items', id), { qtd: novaQtd });
}

/* ── TOGGLE COLETADO ── */
async function toggleItem(id) {
  const item = items.find(i => i.id === id);
  if (item) await updateDoc(doc(db, 'items', id), { done: !item.done });
}

/* ── REMOVER ── */
async function removeItem(id) {
  await deleteDoc(doc(db, 'items', id));
}

/* ── PESQUISA ── */
function atualizarFiltro(valor) {
  filtro = valor.toLowerCase().trim();
  renderLista();
}

/* ── VARIAÇÃO ── */
function getVariacaoItem(nome) {
  const regs = hist.filter(h => h.nome.toLowerCase() === nome.toLowerCase());
  if (regs.length < 2) return null;
  return regs[0].variation;
}
function buildVarBadge(varNum, preco) {
  if (varNum === null || !preco) return '<span style="color:var(--text3);font-size:11px">—</span>';
  const pct = ((varNum / preco) * 100).toFixed(1);
  if (varNum > 0) return `<span class="var-badge var-up">▲ +${pct}%</span>`;
  if (varNum < 0) return `<span class="var-badge var-down">▼ ${pct}%</span>`;
  return '<span style="color:var(--text3);font-size:11px">—</span>';
}

/* ── RENDER PRINCIPAL ── */
function render() {
  const comprados = items.filter(i => i.done).length;
  const pendentes  = items.filter(i => !i.done).length;
  const total      = items.reduce((s, i) => s + (i.preco ? i.qtd * i.preco : 0), 0);
  const estimado   = items.filter(i => i.done).reduce((s, i) => s + (i.preco ? i.qtd * i.preco : 0), 0);

  document.getElementById('c-itens').textContent     = items.length;
  document.getElementById('c-comprados').textContent = comprados;
  document.getElementById('c-pendentes').textContent = pendentes;
  document.getElementById('c-estimado').textContent  = fmt(estimado);
  document.getElementById('total-valor').textContent = fmt(total);

  renderLista();
}

function renderLista() {
  const tbody = document.getElementById('tbody-lista');
  const tfoot = document.getElementById('tfoot-lista');

  const ordenados = ordenarItems(items);
  const filtrados = filtro
    ? ordenados.filter(i => i.nome.toLowerCase().includes(filtro))
    : ordenados;

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">${
      filtro ? 'Nenhum item encontrado.' : 'Adicione itens para começar sua lista.'
    }</td></tr>`;
    tfoot.style.display = 'none';
    return;
  }

  tfoot.style.display = '';

  tbody.innerHTML = filtrados.map(item => {
    const priceVal = item.preco
      ? item.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';
    const totalVal = item.preco ? fmt(item.qtd * item.preco) : null;
    const varBadge = buildVarBadge(getVariacaoItem(item.nome), item.preco);

    return `
      <tr>
        <td>
          <div class="td-inner">
            <span class="item-name${item.done ? ' done' : ''}">${item.nome}</span>
            <button class="del-btn" onclick="removeItem('${item.id}')" aria-label="Remover ${item.nome}">✕</button>
          </div>
        </td>
        <td>
          <div class="td-inner td-center" id="qtd-cell-${item.id}">
            <span class="qtd-label" onclick="editarQtd('${item.id}')" title="Clique para editar">
              x${item.qtd}
            </span>
          </div>
        </td>
        <td>
          <div class="td-inner" style="padding:8px 10px">
            <input
              class="price-input${item.preco ? ' filled' : ''}"
              type="text" inputmode="decimal"
              value="${priceVal}" placeholder="0,00"
              onblur="onPriceBlur(this, '${item.id}')"
              onkeydown="if(event.key==='Enter') this.blur()"
              aria-label="Preço unitário de ${item.nome}"
            />
          </div>
        </td>
        <td>
          <div class="td-inner td-right">
            ${totalVal
              ? `<span class="total-cell">${totalVal}</span>`
              : `<span class="total-cell zero">sem preço</span>`}
          </div>
        </td>
        <td><div class="td-inner td-center">${varBadge}</div></td>
        <td>
          <div class="td-inner td-center">
            <button class="btn-check${item.done ? ' checked' : ''}"
              onclick="toggleItem('${item.id}')"
              aria-label="${item.done ? 'Desmarcar' : 'Marcar como coletado'}">
              ${item.done ? '✓' : '○'}
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function renderHistorico() {
  const tbody = document.getElementById('tbody-hist');
  if (hist.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Nenhum histórico ainda.</td></tr>';
    return;
  }
  tbody.innerHTML = hist.map(h => {
    let vb = '<span style="color:var(--text3);font-size:11px">1º reg.</span>';
    if (h.variation !== null && h.variation !== 0) {
      const pct = h.preco ? ((h.variation / h.preco) * 100).toFixed(1) : '0';
      vb = h.variation > 0
        ? `<span class="var-badge var-up">▲ +${pct}%</span>`
        : `<span class="var-badge var-down">▼ ${pct}%</span>`;
    }
    const ts = h.ts?.toDate ? h.ts.toDate() : new Date();
    return `
      <tr>
        <td><div class="td-inner" style="font-size:14px">${h.nome}</div></td>
        <td><div class="td-inner" style="font-size:12px;color:var(--text2)">${formatDate(ts)}</div></td>
        <td><div class="td-inner td-right" style="font-size:13px;font-weight:500">${fmt(h.preco)}</div></td>
        <td><div class="td-inner td-center" style="font-size:13px;color:var(--text2)">x${h.qtd}</div></td>
        <td><div class="td-inner td-center">${vb}</div></td>
        <td><div class="td-inner td-center">
          <span class="hist-source ${h.origem === 'tabela' ? 'inline' : ''}">${h.origem}</span>
        </div></td>
      </tr>`;
  }).join('');
}

/* ── ABAS ── */
function switchTab(tab) {
  document.getElementById('view-lista').style.display     = tab === 'lista'     ? 'block' : 'none';
  document.getElementById('view-historico').style.display = tab === 'historico' ? 'block' : 'none';
  document.getElementById('tab-lista').className     = 'tab-btn' + (tab === 'lista'     ? ' active' : '');
  document.getElementById('tab-historico').className = 'tab-btn' + (tab === 'historico' ? ' active' : '');
}

/* ── GLOBAIS ── */
window.addItem         = addItem;
window.toggleItem      = toggleItem;
window.removeItem      = removeItem;
window.onPriceBlur     = onPriceBlur;
window.editarQtd       = editarQtd;
window.salvarQtd       = salvarQtd;
window.switchTab       = switchTab;
window.atualizarFiltro = atualizarFiltro;
window.atualizarSugestoes = atualizarSugestoes;

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  iniciarListeners();
  document.getElementById('inp-nome').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('inp-qtd').focus();
  });
  document.getElementById('inp-qtd').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('inp-preco').focus();
  });
  document.getElementById('inp-preco').addEventListener('keydown', e => {
    if (e.key === 'Enter') addItem();
  });
});
