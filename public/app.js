const modalidadeEl = document.getElementById('modalidade');
const boxGrupoEl = document.getElementById('box-grupo');
const boxDezenaEl = document.getElementById('box-dezena');
const boxTernoEl = document.getElementById('box-terno');

const dispGrupoEl = document.getElementById('disp-grupo');
const dispDezenaEl = document.getElementById('disp-dezena');
const dispTernoEls = [
  document.getElementById('disp-terno-0'),
  document.getElementById('disp-terno-1'),
  document.getElementById('disp-terno-2')
];
const dispValorEl = document.getElementById('disp-valor');

const formVendaEl = document.getElementById('form-venda');
const feedbackEl = document.getElementById('feedback-msg');
const listaVendasEl = document.getElementById('lista-vendas');
const filtroVendasEl = document.getElementById('filtro-vendas');
const totalVendasEl = document.getElementById('total-vendas');
const totalValorEl = document.getElementById('total-valor');
const numpadEl = document.getElementById('numpad');

let vendasCache = [];
let alvoAtivo = 'grupo';

const estado = {
  grupo: '',
  dezena: '',
  terno: ['', '', ''],
  centavos: 0
};

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mostrarFeedback(texto, tipo = 'sucesso') {
  feedbackEl.textContent = texto;
  feedbackEl.className = `feedback ${tipo}`;
}

function definirAlvo(novoAlvo) {
  alvoAtivo = novoAlvo;
  document.querySelectorAll('.visor-box').forEach(box => {
    box.classList.toggle('ativo', box.dataset.alvo === novoAlvo);
  });
}

document.querySelectorAll('.visor-box').forEach(box => {
  box.addEventListener('click', () => {
    definirAlvo(box.dataset.alvo);
  });
});

function atualizarVisores() {
  dispGrupoEl.textContent = estado.grupo ? estado.grupo.padStart(2, '0') : '--';
  dispDezenaEl.textContent = estado.dezena ? estado.dezena.padStart(2, '0') : '--';
  dispTernoEls.forEach((el, idx) => {
    const val = estado.terno[idx];
    el.textContent = val ? val.padStart(2, '0') : '--';
  });
  dispValorEl.textContent = formatarMoeda(estado.centavos / 100);
}

modalidadeEl.addEventListener('change', () => {
  const mod = modalidadeEl.value;
  boxGrupoEl.classList.toggle('oculto', mod !== 'grupo');
  boxDezenaEl.classList.toggle('oculto', mod !== 'dezena');
  boxTernoEl.classList.toggle('oculto', mod !== 'terno_dezena');
  feedbackEl.textContent = '';

  if (mod === 'grupo') definirAlvo('grupo');
  else if (mod === 'dezena') definirAlvo('dezena');
  else definirAlvo('terno-0');
});

function adicionarDigito(digito) {
  if (alvoAtivo === 'valor') {
    if (estado.centavos <= 99999999) {
      estado.centavos = estado.centavos * 10 + Number(digito);
    }
  } else if (alvoAtivo === 'grupo') {
    if (estado.grupo.length >= 2) estado.grupo = digito;
    else estado.grupo += digito;
  } else if (alvoAtivo === 'dezena') {
    if (estado.dezena.length >= 2) estado.dezena = digito;
    else estado.dezena += digito;
  } else if (alvoAtivo.startsWith('terno-')) {
    const idx = Number(alvoAtivo.split('-')[1]);
    const atual = estado.terno[idx] || '';
    if (atual.length >= 2) {
      estado.terno[idx] = digito;
    } else {
      estado.terno[idx] = atual + digito;
      if (estado.terno[idx].length === 2 && idx < 2) {
        definirAlvo(`terno-${idx + 1}`);
      }
    }
  }
  atualizarVisores();
}

function apagarDigito() {
  if (alvoAtivo === 'valor') {
    estado.centavos = Math.floor(estado.centavos / 10);
  } else if (alvoAtivo === 'grupo') {
    estado.grupo = estado.grupo.slice(0, -1);
  } else if (alvoAtivo === 'dezena') {
    estado.dezena = estado.dezena.slice(0, -1);
  } else if (alvoAtivo.startsWith('terno-')) {
    const idx = Number(alvoAtivo.split('-')[1]);
    estado.terno[idx] = (estado.terno[idx] || '').slice(0, -1);
  }
  atualizarVisores();
}

function limparAlvo() {
  if (alvoAtivo === 'valor') estado.centavos = 0;
  else if (alvoAtivo === 'grupo') estado.grupo = '';
  else if (alvoAtivo === 'dezena') estado.dezena = '';
  else if (alvoAtivo.startsWith('terno-')) {
    const idx = Number(alvoAtivo.split('-')[1]);
    estado.terno[idx] = '';
  }
  atualizarVisores();
}

numpadEl.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.digito !== undefined) adicionarDigito(btn.dataset.digito);
  else if (btn.dataset.acao === 'apagar') apagarDigito();
  else if (btn.dataset.acao === 'limpar') limparAlvo();
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
    const textoSelecao = Array.isArray(v.selecao) ? v.selecao.join(' ') : v.selecao;
    return (
      v.modalidade.toLowerCase().includes(termo) ||
      textoSelecao.toLowerCase().includes(termo) ||
      v.chaveNormalizada.toLowerCase().includes(termo)
    );
  });

  if (filtradas.length === 0) {
    listaVendasEl.innerHTML = '<p style="color:#6b7280;font-size:0.9rem;">Nenhuma venda registrada.</p>';
    return;
  }

  const nomesModalidade = {
    grupo: 'Unidade de Grupo',
    dezena: 'Unidade de Dezena',
    terno_dezena: 'Terno de Dezena'
  };

  listaVendasEl.innerHTML = filtradas
    .map(v => {
      const exibicao = Array.isArray(v.selecao) ? v.selecao.join(' - ') : v.selecao;
      const dataFormatada = new Date(v.dataHora).toLocaleString('pt-BR');
      return `
        <div class="venda-item">
          <div class="venda-info">
            <span class="tag-mod">${nomesModalidade[v.modalidade] || v.modalidade}</span>
            <span class="venda-selecao">${exibicao}</span>
            <span class="venda-chave">(${v.chaveNormalizada}) • ${dataFormatada}</span>
          </div>
          <div class="venda-acoes">
            <span class="venda-valor">${formatarMoeda(v.valor)}</span>
            <button class="btn-del" onclick="excluirVenda('${v.id}')">Excluir</button>
          </div>
        </div>
      `;
    })
    .join('');
}

filtroVendasEl.addEventListener('input', renderizarVendas);

formVendaEl.addEventListener('submit', async e => {
  e.preventDefault();
  const modalidade = modalidadeEl.value;
  const valor = estado.centavos / 100;

  let selecao;
  if (modalidade === 'grupo') selecao = estado.grupo;
  else if (modalidade === 'dezena') selecao = estado.dezena;
  else if (modalidade === 'terno_dezena') selecao = [...estado.terno];

  const res = await fetch('/api/vendas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modalidade, selecao, valor })
  });

  const data = await res.json();
  if (!res.ok) {
    mostrarFeedback(data.erro || 'Erro ao registrar venda.', 'erro');
    return;
  }

  mostrarFeedback(`Venda registrada (${data.chaveNormalizada})!`, 'sucesso');
  estado.grupo = '';
  estado.dezena = '';
  estado.terno = ['', '', ''];
  estado.centavos = 0;
  atualizarVisores();

  if (modalidade === 'grupo') definirAlvo('grupo');
  else if (modalidade === 'dezena') definirAlvo('dezena');
  else definirAlvo('terno-0');

  await carregarVendas();
});

window.excluirVenda = async function (id) {
  const res = await fetch(`/api/vendas/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await carregarVendas();
  }
};

atualizarVisores();
carregarVendas();
