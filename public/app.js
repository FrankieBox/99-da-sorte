const COTACOES = {
  M: { nome: 'Milhar', codigo: 'M', multiplicador: 6000, qtd: 1, maxDigitos: 4, tipo: 'milhar' },
  C: { nome: 'Centena', codigo: 'C', multiplicador: 600, qtd: 1, maxDigitos: 3, tipo: 'centena' },
  DZ: { nome: 'Dezena', codigo: 'DZ', multiplicador: 50, qtd: 1, maxDigitos: 2, tipo: 'dezena' },
  U: { nome: 'Unidade', codigo: 'U', multiplicador: 5, qtd: 1, maxDigitos: 1, tipo: 'unidade' },
  G: { nome: 'Grupo', codigo: 'G', multiplicador: 15, qtd: 1, maxDigitos: 2, tipo: 'grupo' },
  DG: { nome: 'Dupla de Grupo', codigo: 'DG', multiplicador: 16, qtd: 2, maxDigitos: 2, tipo: 'grupo' },
  TG: { nome: 'Terno de Grupo', codigo: 'TG', multiplicador: 100, qtd: 3, maxDigitos: 2, tipo: 'grupo' },
  PAS: { nome: 'Passe', codigo: 'PAS', multiplicador: 75, qtd: 2, maxDigitos: 2, tipo: 'grupo' },
  DDZ: { nome: 'Duque de Dezena', codigo: 'DDZ', multiplicador: 200, qtd: 2, maxDigitos: 2, tipo: 'dezena' },
  TDZ: { nome: 'Terno de Dezena', codigo: 'TDZ', multiplicador: 6000, qtd: 3, maxDigitos: 2, tipo: 'dezena' }
};

const abaBtns = document.querySelectorAll('.wa-tab');
const abaVendasEl = document.getElementById('aba-vendas');
const abaSimuladorEl = document.getElementById('aba-simulador');

const modalidadeEl = document.getElementById('modalidade');
const origemEl = document.getElementById('origem');
const visoresSelecaoEl = document.getElementById('visores-selecao');
const dispValorEl = document.getElementById('disp-valor');
const vendaMultEl = document.getElementById('venda-mult');
const vendaRetornoEl = document.getElementById('venda-retorno');
const formVendaEl = document.getElementById('form-venda');
const feedbackEl = document.getElementById('feedback-msg');
const listaVendasEl = document.getElementById('lista-vendas');
const filtroVendasEl = document.getElementById('filtro-vendas');
const totalVendasEl = document.getElementById('total-vendas');
const totalValorEl = document.getElementById('total-valor');

const simModalidadeEl = document.getElementById('sim-modalidade');
const simDispValorEl = document.getElementById('sim-disp-valor');
const simCodigoEl = document.getElementById('sim-codigo');
const simMultEl = document.getElementById('sim-mult');
const simRetornoEl = document.getElementById('sim-retorno');
const btnUsarSimulacaoEl = document.getElementById('btn-usar-simulacao');

let vendasCache = [];
let alvoVendas = 'item-0';

const estadoVendas = {
  itens: [''],
  centavos: 0
};

let simCentavos = 0;

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mostrarFeedback(texto, tipo = 'sucesso') {
  feedbackEl.textContent = texto;
  feedbackEl.className = `feedback ${tipo}`;
}

abaBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const aba = btn.dataset.aba;
    abaBtns.forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
    abaVendasEl.classList.toggle('oculto', aba !== 'vendas');
    abaSimuladorEl.classList.toggle('oculto', aba !== 'simulador');
  });
});

function construirVisoresSelecao() {
  const cfg = COTACOES[modalidadeEl.value];
  estadoVendas.itens = Array.from({ length: cfg.qtd }, () => '');
  alvoVendas = 'item-0';

  const colClass = cfg.qtd === 3 ? 'cols-3' : cfg.qtd === 2 ? 'cols-2' : 'cols-1';
  let html = `<div class="visores-grid ${colClass}">`;

  for (let i = 0; i < cfg.qtd; i++) {
    const rotulo = cfg.qtd > 1 ? `${i + 1}º ${cfg.tipo}` : `${cfg.nome} (${cfg.codigo})`;
    html += `
      <div class="visor-box ${i === 0 ? 'ativo' : ''}" data-alvo="item-${i}">
        <span class="visor-label">${rotulo}</span>
        <span class="visor-valor" id="disp-item-${i}">--</span>
      </div>
    `;
  }
  html += '</div>';
  visoresSelecaoEl.innerHTML = html;

  visoresSelecaoEl.querySelectorAll('.visor-box').forEach(box => {
    box.addEventListener('click', () => definirAlvoVendas(box.dataset.alvo));
  });

  atualizarVisoresVendas();
}

function definirAlvoVendas(novoAlvo) {
  alvoVendas = novoAlvo;
  document.querySelectorAll('#aba-vendas .visor-box').forEach(box => {
    box.classList.toggle('ativo', box.dataset.alvo === novoAlvo);
  });
}

document.querySelector('#aba-vendas .visor-box[data-alvo="valor"]').addEventListener('click', () => {
  definirAlvoVendas('valor');
});

function atualizarVisoresVendas() {
  const cfg = COTACOES[modalidadeEl.value];
  for (let i = 0; i < cfg.qtd; i++) {
    const el = document.getElementById(`disp-item-${i}`);
    if (!el) continue;
    const val = estadoVendas.itens[i] || '';
    el.textContent = val ? val.padStart(cfg.maxDigitos, '0') : '--';
  }

  const valorReais = estadoVendas.centavos / 100;
  dispValorEl.textContent = formatarMoeda(valorReais);
  vendaMultEl.textContent = `${cfg.multiplicador}x`;
  vendaRetornoEl.textContent = formatarMoeda(valorReais * cfg.multiplicador);
}

modalidadeEl.addEventListener('change', construirVisoresSelecao);

function aplicarDigitoVendas(digito) {
  const cfg = COTACOES[modalidadeEl.value];
  if (alvoVendas === 'valor') {
    if (estadoVendas.centavos <= 99999999) {
      estadoVendas.centavos = estadoVendas.centavos * 10 + Number(digito);
    }
  } else if (alvoVendas.startsWith('item-')) {
    const idx = Number(alvoVendas.split('-')[1]);
    const atual = estadoVendas.itens[idx] || '';
    if (atual.length >= cfg.maxDigitos) {
      estadoVendas.itens[idx] = digito;
    } else {
      estadoVendas.itens[idx] = atual + digito;
      if (estadoVendas.itens[idx].length === cfg.maxDigitos && idx < cfg.qtd - 1) {
        definirAlvoVendas(`item-${idx + 1}`);
      }
    }
  }
  atualizarVisoresVendas();
}

function apagarDigitoVendas() {
  if (alvoVendas === 'valor') {
    estadoVendas.centavos = Math.floor(estadoVendas.centavos / 10);
  } else if (alvoVendas.startsWith('item-')) {
    const idx = Number(alvoVendas.split('-')[1]);
    estadoVendas.itens[idx] = (estadoVendas.itens[idx] || '').slice(0, -1);
  }
  atualizarVisoresVendas();
}

function limparAlvoVendas() {
  if (alvoVendas === 'valor') {
    estadoVendas.centavos = 0;
  } else if (alvoVendas.startsWith('item-')) {
    const idx = Number(alvoVendas.split('-')[1]);
    estadoVendas.itens[idx] = '';
  }
  atualizarVisoresVendas();
}

document.querySelector('[data-teclado="vendas"]').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.digito !== undefined) aplicarDigitoVendas(btn.dataset.digito);
  else if (btn.dataset.acao === 'apagar') apagarDigitoVendas();
  else if (btn.dataset.acao === 'limpar') limparAlvoVendas();
});

function atualizarSimulador() {
  const cfg = COTACOES[simModalidadeEl.value];
  const valorBase = simCentavos / 100;
  const retorno = valorBase * cfg.multiplicador;

  simDispValorEl.textContent = formatarMoeda(valorBase);
  simCodigoEl.textContent = `${cfg.codigo} (${cfg.nome})`;
  simMultEl.textContent = `${cfg.multiplicador}x`;
  simRetornoEl.textContent = formatarMoeda(retorno);
}

simModalidadeEl.addEventListener('change', atualizarSimulador);

document.querySelector('[data-teclado="simulador"]').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.digito !== undefined) {
    if (simCentavos <= 99999999) {
      simCentavos = simCentavos * 10 + Number(btn.dataset.digito);
    }
  } else if (btn.dataset.acao === 'apagar') {
    simCentavos = Math.floor(simCentavos / 10);
  } else if (btn.dataset.acao === 'limpar') {
    simCentavos = 0;
  }
  atualizarSimulador();
});

btnUsarSimulacaoEl.addEventListener('click', () => {
  modalidadeEl.value = simModalidadeEl.value;
  construirVisoresSelecao();
  estadoVendas.centavos = simCentavos;
  atualizarVisoresVendas();
  definirAlvoVendas('item-0');

  abaBtns.forEach(b => b.classList.toggle('ativa', b.dataset.aba === 'vendas'));
  abaVendasEl.classList.remove('oculto');
  abaSimuladorEl.classList.add('oculto');
});

async function carregarVendas() {
  const res = await fetch('/api/vendas');
  const data = await res.json();

  vendasCache = data.vendas;
  totalVendasEl.textContent = data.totalRegistros;
  totalValorEl.textContent = formatarMoeda(data.totalArrecadado);

  renderizarVendas();
}

function renderizarVendas() {
  const termo = filtroVendasEl.value.trim().toLowerCase();
  const filtradas = vendasCache.filter(v => {
    const textoSelecao = Array.isArray(v.selecao) ? v.selecao.join(' ') : String(v.selecao);
    return (
      String(v.modalidade).toLowerCase().includes(termo) ||
      String(v.nomeModalidade || '').toLowerCase().includes(termo) ||
      textoSelecao.toLowerCase().includes(termo) ||
      String(v.chaveNormalizada).toLowerCase().includes(termo) ||
      String(v.origem || '').toLowerCase().includes(termo)
    );
  });

  if (filtradas.length === 0) {
    listaVendasEl.innerHTML = '<p style="color:#667781;font-size:0.88rem;">Nenhuma venda registrada.</p>';
    return;
  }

  listaVendasEl.innerHTML = filtradas
    .map(v => {
      const exibicao = Array.isArray(v.selecao) ? v.selecao.join(' • ') : v.selecao;
      const horaFormatada = new Date(v.dataHora).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const canalLabel = v.origem === 'landing' ? 'Landing Page' : 'Presencial';
      return `
        <div class="wa-bolha">
          <div class="wa-bolha-topo">
            <div class="wa-badges">
              <span class="tag-mod">${v.modalidade}</span>
              <span class="tag-origem">${canalLabel}</span>
              <span class="venda-selecao">${exibicao}</span>
            </div>
            <span class="venda-valor">${formatarMoeda(v.valor)}</span>
          </div>
          <div class="wa-bolha-rodape">
            <span>${v.chaveNormalizada} • Ret.: ${formatarMoeda(v.retornoPotencial || 0)}</span>
            <div class="wa-meta-dir">
              <span>${horaFormatada}</span>
              <span class="wa-check">✓✓</span>
              <button class="btn-del" onclick="excluirVenda('${v.id}')">Apagar</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

filtroVendasEl.addEventListener('input', renderizarVendas);

formVendaEl.addEventListener('submit', async e => {
  e.preventDefault();
  const cfg = COTACOES[modalidadeEl.value];
  const selecao = cfg.qtd === 1 ? estadoVendas.itens[0] : [...estadoVendas.itens];
  const valor = estadoVendas.centavos / 100;
  const origem = origemEl.value;

  const res = await fetch('/api/vendas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modalidade: cfg.codigo, selecao, valor, origem })
  });

  const data = await res.json();
  if (!res.ok) {
    mostrarFeedback(data.erro || 'Erro ao registrar venda.', 'erro');
    return;
  }

  mostrarFeedback(`Enviado (${data.chaveNormalizada})!`, 'sucesso');
  estadoVendas.itens = Array.from({ length: cfg.qtd }, () => '');
  estadoVendas.centavos = 0;
  atualizarVisoresVendas();
  definirAlvoVendas('item-0');

  await carregarVendas();
});

window.excluirVenda = async function (id) {
  const res = await fetch(`/api/vendas/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await carregarVendas();
  }
};

construirVisoresSelecao();
atualizarSimulador();
carregarVendas();
