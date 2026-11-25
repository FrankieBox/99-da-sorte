const COTACOES = {
  M: { nome: 'Milhar', codigo: 'M', qtd: 1, maxDigitos: 4, tipo: 'milhar' },
  C: { nome: 'Centena', codigo: 'C', qtd: 1, maxDigitos: 3, tipo: 'centena' },
  DZ: { nome: 'Dezena', codigo: 'DZ', qtd: 1, maxDigitos: 2, tipo: 'dezena' },
  U: { nome: 'Unidade', codigo: 'U', qtd: 1, maxDigitos: 1, tipo: 'unidade' },
  G: { nome: 'Grupo', codigo: 'G', qtd: 1, maxDigitos: 2, tipo: 'grupo' },
  DG: { nome: 'Dupla de Grupo', codigo: 'DG', qtd: 2, maxDigitos: 2, tipo: 'grupo' },
  TG: { nome: 'Terno de Grupo', codigo: 'TG', qtd: 3, maxDigitos: 2, tipo: 'grupo' },
  PAS: { nome: 'Passe', codigo: 'PAS', qtd: 2, maxDigitos: 2, tipo: 'grupo' },
  DDZ: { nome: 'Duque de Dezena', codigo: 'DDZ', qtd: 2, maxDigitos: 2, tipo: 'dezena' },
  TDZ: { nome: 'Terno de Dezena', codigo: 'TDZ', qtd: 3, maxDigitos: 2, tipo: 'dezena' }
};

const params = new URLSearchParams(window.location.search);

let configPagina = {
  titulo: params.get('titulo') || 'Produto / Concurso em Breve',
  subtitulo: params.get('subtitulo') || 'Base modelo pronta para receber produto e criativo.',
  copy:
    params.get('copy') ||
    'Espaço reservado para a copy de venda do produto. O sorteio é único e compartilhado entre todos os produtos, variando apenas a modalidade utilizada.',
  regraConcorrer:
    params.get('regra') ||
    'Escolha o número de acordo com a modalidade definida para este produto e preencha seus dados de contato para falarmos com você caso seja sorteado.',
  modalidade: COTACOES[params.get('mod')] ? params.get('mod') : 'M',
  precoBilhete: Number(params.get('preco')) >= 1 ? Number(params.get('preco')) : 1.0
};

const lpTituloEl = document.getElementById('lp-titulo');
const lpSubtituloEl = document.getElementById('lp-subtitulo');
const lpCopyEl = document.getElementById('lp-copy');
const lpRegraEl = document.getElementById('lp-regra');
const lpModalidadeLabelEl = document.getElementById('lp-modalidade-label');
const lpPrecoEl = document.getElementById('lp-preco');
const lpVisoresEl = document.getElementById('lp-visores-selecao');
const formLandingEl = document.getElementById('form-landing');
const leadNomeEl = document.getElementById('lead-nome');
const leadContatoEl = document.getElementById('lead-contato');
const feedbackEl = document.getElementById('lp-feedback');
const statusRetornoEl = document.getElementById('status-retorno');

let alvoAtivo = 'item-0';
let itensSelecionados = [''];

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mostrarFeedback(texto, tipo = 'sucesso') {
  feedbackEl.textContent = texto;
  feedbackEl.className = `feedback ${tipo}`;
}

function aplicarDadosPagina() {
  const cfg = COTACOES[configPagina.modalidade] || COTACOES.M;
  document.title = `99 da sorte — ${configPagina.titulo}`;
  lpTituloEl.textContent = configPagina.titulo;
  lpSubtituloEl.textContent = configPagina.subtitulo;
  lpCopyEl.textContent = configPagina.copy;
  lpRegraEl.textContent = configPagina.regraConcorrer;
  lpModalidadeLabelEl.textContent = `${cfg.codigo} (${cfg.nome})`;
  lpPrecoEl.textContent = formatarMoeda(configPagina.precoBilhete);

  itensSelecionados = Array.from({ length: cfg.qtd }, () => '');
  alvoAtivo = 'item-0';

  const colClass = cfg.qtd === 3 ? 'cols-3' : cfg.qtd === 2 ? 'cols-2' : 'cols-1';
  let html = `<div class="visores-grid ${colClass}">`;
  for (let i = 0; i < cfg.qtd; i++) {
    const rotulo = cfg.qtd > 1 ? `${i + 1}º ${cfg.tipo}` : `${cfg.nome} (${cfg.codigo})`;
    html += `
      <div class="visor-box ${i === 0 ? 'ativo' : ''}" data-alvo="item-${i}">
        <span class="visor-label">${rotulo}</span>
        <span class="visor-valor" id="lp-disp-${i}">--</span>
      </div>
    `;
  }
  html += '</div>';
  lpVisoresEl.innerHTML = html;

  lpVisoresEl.querySelectorAll('.visor-box').forEach(box => {
    box.addEventListener('click', () => definirAlvo(box.dataset.alvo));
  });

  atualizarVisores();
}

function definirAlvo(novoAlvo) {
  alvoAtivo = novoAlvo;
  lpVisoresEl.querySelectorAll('.visor-box').forEach(box => {
    box.classList.toggle('ativo', box.dataset.alvo === novoAlvo);
  });
}

function atualizarVisores() {
  const cfg = COTACOES[configPagina.modalidade] || COTACOES.M;
  for (let i = 0; i < cfg.qtd; i++) {
    const el = document.getElementById(`lp-disp-${i}`);
    if (!el) continue;
    const val = itensSelecionados[i] || '';
    el.textContent = val ? val.padStart(cfg.maxDigitos, '0') : '--';
  }
}

document.querySelector('[data-teclado="landing"]').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const cfg = COTACOES[configPagina.modalidade] || COTACOES.M;
  const idx = Number(alvoAtivo.split('-')[1] || 0);

  if (btn.dataset.digito !== undefined) {
    const atual = itensSelecionados[idx] || '';
    if (atual.length >= cfg.maxDigitos) {
      itensSelecionados[idx] = btn.dataset.digito;
    } else {
      itensSelecionados[idx] = atual + btn.dataset.digito;
      if (itensSelecionados[idx].length === cfg.maxDigitos && idx < cfg.qtd - 1) {
        definirAlvo(`item-${idx + 1}`);
      }
    }
  } else if (btn.dataset.acao === 'apagar') {
    itensSelecionados[idx] = (itensSelecionados[idx] || '').slice(0, -1);
  } else if (btn.dataset.acao === 'limpar') {
    itensSelecionados[idx] = '';
  }

  atualizarVisores();
});

formLandingEl.addEventListener('submit', async e => {
  e.preventDefault();
  const cfg = COTACOES[configPagina.modalidade] || COTACOES.M;
  const selecao = cfg.qtd === 1 ? itensSelecionados[0] : [...itensSelecionados];

  mostrarFeedback('Gerando checkout InfinitePay...', 'sucesso');

  const res = await fetch('/api/checkout/criar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      produto: configPagina.titulo,
      modalidade: cfg.codigo,
      selecao,
      valor: configPagina.precoBilhete,
      lead: {
        nome: leadNomeEl.value.trim(),
        contato: leadContatoEl.value.trim()
      }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    mostrarFeedback(data.erro || 'Não foi possível iniciar o checkout.', 'erro');
    return;
  }

  window.location.href = data.checkout_url;
});

async function verificarRetornoPedido() {
  const orderNsu = params.get('order_nsu');
  if (!orderNsu) return;

  statusRetornoEl.classList.remove('oculto');
  statusRetornoEl.innerHTML = `<div class="wa-card-titulo">Verificando Pagamento...</div><p class="lp-texto">Pedido ${orderNsu}</p>`;

  const res = await fetch(`/api/checkout/status/${encodeURIComponent(orderNsu)}`);
  const data = await res.json();

  if (!res.ok) {
    statusRetornoEl.innerHTML = `<div class="wa-card-titulo">Aviso</div><p class="feedback erro">${data.erro || 'Pedido não localizado.'}</p>`;
    return;
  }

  if (data.status === 'pago') {
    statusRetornoEl.innerHTML = `
      <div class="wa-card-titulo">Pagamento Confirmado!</div>
      <p class="lp-texto">Sua participação (${data.chaveNormalizada}) no valor de ${formatarMoeda(data.valor)} foi confirmada.</p>
    `;
  } else {
    statusRetornoEl.innerHTML = `
      <div class="wa-card-titulo">Aguardando Confirmação</div>
      <p class="lp-texto">Pedido ${data.order_nsu} está com status: <strong>${data.status}</strong>.</p>
    `;
  }
}

async function iniciar() {
  try {
    const res = await fetch('/api/catalogo');
    const data = await res.json();
    if (data.landingBase && !params.get('titulo')) {
      configPagina = { ...configPagina, ...data.landingBase };
    }
  } catch (e) {
    // mantém configuração padrão local
  }

  aplicarDadosPagina();
  verificarRetornoPedido();
}

iniciar();
