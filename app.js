/* =============================================
   LISTA DE COMPRAS — app.js
   ============================================= */

let items = [];
let hist = [];
let priceMap = {};

/* ── UTILITÁRIOS ── */

function fmt(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parsePrice(str) {
  if (!str && str !== 0) return null;
  const n = parseFloat(String(str).replace(/[^\d,]/g, '').replace(',', '.'));
  return isNaN(n) || n <= 0 ? null : n;
}

function formatDate(date) {
  return (
    date.toLocaleDateString('pt-BR') +
    ' ' +
    date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
}

/* ── HISTÓRICO ── */

function registrarHistorico(nome, preco, qtd, origem) {
  const key = nome.toLowerCase();
  const prev = priceMap[key];
  const variation = prev !== undefined ? preco - prev : null;
  priceMap[key] = preco;
  hist.unshift({ nome, preco, qtd, ts: new Date(), variation, origem });
}

/* ── ADICIONAR ITEM ── */

function addItem() {
  const nomeEl  = document.getElementById('inp-nome');
  const qtdEl   = document.getElementById('inp-qtd');
  const precoEl = document.getElementById('inp-preco');

  const nome  = nomeEl.value.trim();
  if (!nome) { nomeEl.focus(); return; }

  const qtd   = parseInt(qtdEl.value) || 1;
  const preco = parsePrice(precoEl.value);

  if (preco !== null) {
    registrarHistorico(nome, preco, qtd, 'formulário');
  }

  const existing = items.find(i => i.nome.toLowerCase() === nome.toLowerCase());
  if (existing) {
    existing.qtd += qtd;
    if (preco !== null) existing.preco = preco;
  } else {
    items.push({ id: Date.now(), nome, qtd, preco, done: false });
  }

  nomeEl.value  = '';
  qtdEl.value   = '1';
  precoEl.value = '';
  nomeEl.focus();
  render();
}

/* ── ATUALIZAR PREÇO NA TABELA ── */

function onPriceBlur(el, id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  const novoPreco = parsePrice(el.value);

  if (novoPreco !== null) {
    if (novoPreco !== item.preco) {
      registrarHistorico(item.nome, novoPreco, item.qtd, 'tabela');
    }
    item.preco = novoPreco;
    el.value = novoPreco.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    el.classList.add('filled');
  } else if (el.value === '' || el.value === '0,00') {
    item.preco = null;
    el.value = '';
    el.classList.remove('filled');
  }

  render();
}

/* ── MARCAR / DESMARCAR COLETADO ── */

function toggleItem(id) {
  const item = items.find(i => i.id === id);
  if (item) item.done = !item.done;
  render();
}

/* ── REMOVER ITEM ── */

function removeItem(id) {
  items = items.filter(i => i.id !== id);
  render();
}

/* ── VARIAÇÃO DO ITEM (para exibir na tabela) ── */

function getVariacaoItem(nome) {
  const registros = hist.filter(h => h.nome.toLowerCase() === nome.toLowerCase());
  if (registros.length < 2) return null;
  return registros[0].variation;
}

function buildVarBadge(varNum, preco) {
  if (varNum === null || !preco) {
    return '<span style="color:var(--text3);font-size:11px">—</span>';
  }
  const pct = ((varNum / preco) * 100).toFixed(1);
  if (varNum > 0) {
    return `<span class="var-badge var-up">▲ +${pct}%</span>`;
  }
  if (varNum < 0) {
    return `<span class="var-badge var-down">▼ ${pct}%</span>`;
  }
  return '<span style="color:var(--text3);font-size:11px">—</span>';
}

/* ── RENDERIZAÇÃO PRINCIPAL ── */

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
  renderHistorico();
}

function renderLista() {
  const tbody = document.getElementById('tbody-lista');
  const tfoot = document.getElementById('tfoot-lista');

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Adicione itens para começar sua lista.</td></tr>';
    tfoot.style.display = 'none';
    return;
  }

  tfoot.style.display = '';

  tbody.innerHTML = items.map(item => {
    const priceVal = item.preco
      ? item.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';
    const totalVal = item.preco ? fmt(item.qtd * item.preco) : null;
    const varNum   = getVariacaoItem(item.nome);
    const varBadge = buildVarBadge(varNum, item.preco);

    return `
      <tr>
        <td>
          <div class="td-inner">
            <span class="item-name${item.done ? ' done' : ''}">${item.nome}</span>
            <button class="del-btn" onclick="removeItem(${item.id})" aria-label="Remover ${item.nome}">✕</button>
          </div>
        </td>
        <td>
          <div class="td-inner td-center" style="font-size:13px;color:var(--text2)">
            x${item.qtd}
          </div>
        </td>
        <td>
          <div class="td-inner" style="padding:8px 10px">
            <input
              class="price-input${item.preco ? ' filled' : ''}"
              type="text"
              inputmode="decimal"
              value="${priceVal}"
              placeholder="0,00"
              onblur="onPriceBlur(this, ${item.id})"
              onkeydown="if(event.key==='Enter') this.blur()"
              aria-label="Preço unitário de ${item.nome}"
            />
          </div>
        </td>
        <td>
          <div class="td-inner td-right">
            ${totalVal
              ? `<span class="total-cell">${totalVal}</span>`
              : `<span class="total-cell zero">sem preço</span>`
            }
          </div>
        </td>
        <td>
          <div class="td-inner td-center">${varBadge}</div>
        </td>
        <td>
          <div class="td-inner td-center">
            <button
              class="btn-check${item.done ? ' checked' : ''}"
              onclick="toggleItem(${item.id})"
              aria-label="${item.done ? 'Desmarcar' : 'Marcar como coletado'}"
            >
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
    const origemClass = h.origem === 'tabela' ? 'inline' : '';

    return `
      <tr>
        <td><div class="td-inner" style="font-size:14px">${h.nome}</div></td>
        <td><div class="td-inner" style="font-size:12px;color:var(--text2)">${formatDate(h.ts)}</div></td>
        <td><div class="td-inner td-right" style="font-size:13px;font-weight:500">${fmt(h.preco)}</div></td>
        <td><div class="td-inner td-center" style="font-size:13px;color:var(--text2)">x${h.qtd}</div></td>
        <td><div class="td-inner td-center">${vb}</div></td>
        <td><div class="td-inner td-center">
          <span class="hist-source ${origemClass}">${h.origem}</span>
        </div></td>
      </tr>`;
  }).join('');
}

/* ── TROCA DE ABA ── */

function switchTab(tab) {
  document.getElementById('view-lista').style.display     = tab === 'lista'     ? 'block' : 'none';
  document.getElementById('view-historico').style.display = tab === 'historico' ? 'block' : 'none';
  document.getElementById('tab-lista').className     = 'tab-btn' + (tab === 'lista'     ? ' active' : '');
  document.getElementById('tab-historico').className = 'tab-btn' + (tab === 'historico' ? ' active' : '');
}

/* ── NAVEGAÇÃO COM ENTER NO FORMULÁRIO ── */

document.addEventListener('DOMContentLoaded', () => {
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
