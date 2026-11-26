const COTACOES = {
  M: { nome: 'Milhar', codigo: 'M', qtd: 1, maxDigitos: 4, tipo: 'milhar', chance: '1 em 10.000' },
  C: { nome: 'Centena', codigo: 'C', qtd: 1, maxDigitos: 3, tipo: 'centena', chance: '1 em 1.000' },
  DZ: { nome: 'Dezena', codigo: 'DZ', qtd: 1, maxDigitos: 2, tipo: 'dezena', chance: '1 em 100' },
  U: { nome: 'Unidade', codigo: 'U', qtd: 1, maxDigitos: 1, tipo: 'unidade', chance: '1 em 10' },
  G: { nome: 'Grupo', codigo: 'G', qtd: 1, maxDigitos: 2, tipo: 'grupo', chance: '1 em 25' },
  DG: { nome: 'Dupla de Grupo', codigo: 'DG', qtd: 2, maxDigitos: 2, tipo: 'grupo', chance: '1 em 300' },
  TG: { nome: 'Terno de Grupo', codigo: 'TG', qtd: 3, maxDigitos: 2, tipo: 'grupo', chance: '1 em 2.300' },
  PAS: { nome: 'Passe', codigo: 'PAS', qtd: 2, maxDigitos: 2, tipo: 'grupo', chance: '1 em 300' },
  DDZ: { nome: 'Duque de Dezena', codigo: 'DDZ', qtd: 2, maxDigitos: 2, tipo: 'dezena', chance: '1 em 4.950' },
  TDZ: { nome: 'Terno de Dezena', codigo: 'TDZ', qtd: 3, maxDigitos: 2, tipo: 'dezena', chance: '1 em 161.700' }
};

const DEZENAS_100 = [
  ...Array.from({ length: 99 }, (_, i) => String(i + 1).padStart(2, '0')),
  '00'
];

const params = new URLSearchParams(window.location.search);

const PRODUTO_PADRAO = {
  nomeProduto: 'Gift Card Pix R$ 50,00',
  titulo: 'Transforme R$ 2,50 em R$ 50,00 no Pix!',
  subtitulo:
    'Escolha sua dezena da sorte (de 01 a 00), preencha seu WhatsApp e concorra ao Gift Card Pix de R$ 50,00 sem complicação.',
  premioValor: 'R$ 50,00',
  bannerUrl: '',
  copyPontos: [
    'Entrada super acessível: apenas R$ 2,50 por bilhete para concorrer a R$ 50,00 livres para usar como quiser.',
    'Chance direta de 1 em 100 por bilhete na modalidade Dezena (01 a 99 e 00) — muito mais simples que sorteios gigantes.',
    'Sem cadastro demorado: você escolhe seu número em segundos, informa seu WhatsApp e já fica identificado para receber.'
  ],
  regraConcorrer:
    'Cada bilhete equivale a 1 Dezena (01 a 99 ou 00), totalizando 100 combinações possíveis no sorteio único compartilhado do 99 da sorte. Se a dezena sorteada coincidir com o seu bilhete, entramos em contato pelo WhatsApp informado para entregar seu Gift Card Pix de R$ 50,00.',
  ctaBotao: 'Garantir Minha Dezena por R$ 2,50',
  modalidade: 'DZ',
  precoBilhete: 2.5
};

let configPagina = {
  nomeProduto: params.get('produto') || PRODUTO_PADRAO.nomeProduto,
  titulo: params.get('titulo') || PRODUTO_PADRAO.titulo,
  subtitulo: params.get('subtitulo') || PRODUTO_PADRAO.subtitulo,
  premioValor: params.get('premio') || PRODUTO_PADRAO.premioValor,
  bannerUrl: params.get('banner') || PRODUTO_PADRAO.bannerUrl,
  copyPontos: params.get('copy') ? [params.get('copy')] : PRODUTO_PADRAO.copyPontos,
  regraConcorrer: params.get('regra') || PRODUTO_PADRAO.regraConcorrer,
  ctaBotao: params.get('cta') || PRODUTO_PADRAO.ctaBotao,
  modalidade: COTACOES[params.get('mod')] ? params.get('mod') : PRODUTO_PADRAO.modalidade,
  precoBilhete:
    params.get('preco') && !Number.isNaN(Number(params.get('preco'))) && Number(params.get('preco')) > 0
      ? Number(params.get('preco'))
      : PRODUTO_PADRAO.precoBilhete
};

const lpTituloEl = document.getElementById('lp-titulo');
const lpSubtituloEl = document.getElementById('lp-subtitulo');
const lpBadgeModEl = document.getElementById('lp-badge-mod');
const lpPlacarCustoEl = document.getElementById('lp-placar-custo');
const lpPlacarPremioEl = document.getElementById('lp-placar-premio');
const lpCriativoBoxEl = document.getElementById('lp-criativo-box');
const lpCriativoImgEl = document.getElementById('lp-criativo-img');
const lpCopyBlocosEl = document.getElementById('lp-copy-blocos');
const lpRegraEl = document.getElementById('lp-regra');
const lpModalidadeLabelEl = document.getElementById('lp-modalidade-label');
const lpChanceLabelEl = document.getElementById('lp-chance-label');
const lpPrecoEl = document.getElementById('lp-preco');
const lpVisoresEl = document.getElementById('lp-visores-selecao');
const lpGradeDezenasEl = document.getElementById('lp-grade-dezenas');
const lpCtaTituloEl = document.getElementById('lp-cta-titulo');
const btnSurpresinhaEl = document.getElementById('btn-surpresinha');
const btnLpSubmitEl = document.getElementById('btn-lp-submit');
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

function normalizarDezena(valor) {
  const limpo = String(valor || '').replace(/\D/g, '').slice(0, 2);
  if (!limpo) return '';
  const pad = limpo.padStart(2, '0');
  return DEZENAS_100.includes(pad) ? pad : '';
}

function montarGradeDezenas() {
  lpGradeDezenasEl.innerHTML = DEZENAS_100
    .map(dz => `<button type="button" class="dz-chip" data-dz="${dz}">${dz}</button>`)
    .join('');

  lpGradeDezenasEl.addEventListener('click', e => {
    const btn = e.target.closest('.dz-chip');
    if (!btn) return;
    const cfg = COTACOES[configPagina.modalidade] || COTACOES.DZ;
    const idx = Number(alvoAtivo.split('-')[1] || 0);
    itensSelecionados[idx] = btn.dataset.dz;
    if (idx < cfg.qtd - 1) {
      definirAlvo(`item-${idx + 1}`);
    }
    atualizarVisores();
  });
}

function destacarDezenaAtiva() {
  const idx = Number(alvoAtivo.split('-')[1] || 0);
  const atual = normalizarDezena(itensSelecionados[idx]);
  lpGradeDezenasEl.querySelectorAll('.dz-chip').forEach(btn => {
    btn.classList.toggle('ativa', btn.dataset.dz === atual);
  });
}

function renderizarCopy() {
  lpCopyBlocosEl.innerHTML = configPagina.copyPontos
    .map(
      texto => `
        <div class="lp-copy-item">
          <span class="lp-copy-check">✓</span>
          <span>${texto}</span>
        </div>
      `
    )
    .join('');
}

function aplicarDadosPagina() {
  const cfg = COTACOES[configPagina.modalidade] || COTACOES.DZ;
  const precoFmt = formatarMoeda(configPagina.precoBilhete);

  document.title = `99 da sorte — ${configPagina.nomeProduto}`;
  lpTituloEl.textContent = configPagina.titulo;
  lpSubtituloEl.textContent = configPagina.subtitulo;
  lpBadgeModEl.textContent = `${cfg.codigo} • ${cfg.nome}`;
  lpPlacarCustoEl.textContent = precoFmt;
  lpPlacarPremioEl.textContent = configPagina.premioValor;

  if (configPagina.bannerUrl) {
    lpCriativoImgEl.src = configPagina.bannerUrl;
    lpCriativoBoxEl.classList.remove('oculto');
  } else {
    lpCriativoBoxEl.classList.add('oculto');
  }

  renderizarCopy();
  lpRegraEl.textContent = configPagina.regraConcorrer;
  lpModalidadeLabelEl.textContent = `${cfg.codigo} (${cfg.nome})`;
  lpChanceLabelEl.textContent = cfg.chance;
  lpPrecoEl.textContent = precoFmt;
  lpCtaTituloEl.textContent = `Garanta sua ${cfg.nome} por ${precoFmt}`;
  btnLpSubmitEl.textContent = configPagina.ctaBotao;

  itensSelecionados = Array.from({ length: cfg.qtd }, () => '');
  alvoAtivo = 'item-0';

  const colClass = cfg.qtd === 3 ? 'cols-3' : cfg.qtd === 2 ? 'cols-2' : 'cols-1';
  let html = `<div class="visores-grid ${colClass}">`;
  for (let i = 0; i < cfg.qtd; i++) {
    const rotulo = cfg.qtd > 1 ? `${i + 1}º ${cfg.tipo}` : `Seu Bilhete ${cfg.nome} (${cfg.codigo})`;
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

  lpGradeDezenasEl.classList.toggle('oculto', cfg.tipo !== 'dezena');
  atualizarVisores();
}

function definirAlvo(novoAlvo) {
  alvoAtivo = novoAlvo;
  lpVisoresEl.querySelectorAll('.visor-box').forEach(box => {
    box.classList.toggle('ativo', box.dataset.alvo === novoAlvo);
  });
  destacarDezenaAtiva();
}

function atualizarVisores() {
  const cfg = COTACOES[configPagina.modalidade] || COTACOES.DZ;
  for (let i = 0; i < cfg.qtd; i++) {
    const el = document.getElementById(`lp-disp-${i}`);
    if (!el) continue;
    const val = itensSelecionados[i] || '';
    el.textContent = val ? val.padStart(cfg.maxDigitos, '0') : '--';
  }
  destacarDezenaAtiva();
}

btnSurpresinhaEl.addEventListener('click', () => {
  const cfg = COTACOES[configPagina.modalidade] || COTACOES.DZ;
  itensSelecionados = Array.from({ length: cfg.qtd }, () => {
    if (cfg.tipo === 'dezena') {
      return DEZENAS_100[Math.floor(Math.random() * DEZENAS_100.length)];
    }
    if (cfg.tipo === 'grupo') {
      return String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
    }
    if (cfg.tipo === 'centena') {
      return String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    }
    if (cfg.tipo === 'milhar') {
      return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    }
    return String(Math.floor(Math.random() * 10));
  });
  atualizarVisores();
  mostrarFeedback(`Dezena da sorte sugerida: ${itensSelecionados.join(' • ')}`, 'sucesso');
});

document.querySelector('[data-teclado="landing"]').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const cfg = COTACOES[configPagina.modalidade] || COTACOES.DZ;
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
  const cfg = COTACOES[configPagina.modalidade] || COTACOES.DZ;
  const selecao = cfg.qtd === 1 ? itensSelecionados[0] : [...itensSelecionados];

  mostrarFeedback('Verificando checkout...', 'sucesso');

  const res = await fetch('/api/checkout/criar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      produto: configPagina.nomeProduto,
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
    mostrarFeedback(
      data.erro || 'Checkout em pausa/configuração com o banco. Tente novamente em breve.',
      'erro'
    );
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

montarGradeDezenas();
aplicarDadosPagina();
verificarRetornoPedido();
