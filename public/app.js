const modalidadeEl = document.getElementById('modalidade');
const boxGrupoEl = document.getElementById('box-grupo');
const boxDezenaEl = document.getElementById('box-dezena');
const boxTernoEl = document.getElementById('box-terno');
const inputGrupoEl = document.getElementById('input-grupo');
const inputDezenaEl = document.getElementById('input-dezena');
const terno1El = document.getElementById('terno-1');
const terno2El = document.getElementById('terno-2');
const terno3El = document.getElementById('terno-3');
const valorEl = document.getElementById('valor');
const formVendaEl = document.getElementById('form-venda');
const feedbackEl = document.getElementById('feedback-msg');
const gridCatalogoEl = document.getElementById('grid-catalogo');
const listaVendasEl = document.getElementById('lista-vendas');
const filtroVendasEl = document.getElementById('filtro-vendas');
const totalVendasEl = document.getElementById('total-vendas');
const totalValorEl = document.getElementById('total-valor');

let vendasCache = [];

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mostrarFeedback(texto, tipo = 'sucesso') {
  feedbackEl.textContent = texto;
  feedbackEl.className = `feedback ${tipo}`;
}

// Alterna os campos conforme a modalidade
modalidadeEl.addEventListener('change', () => {
  const mod = modalidadeEl.value;
  boxGrupoEl.classList.toggle('oculto', mod !== 'grupo');
  boxDezenaEl.classList.toggle('oculto', mod !== 'dezena');
  boxTernoEl.classList.toggle('oculto', mod !== 'terno_dezena');
  feedbackEl.textContent = '';
});

// Carrega catálogo dos 25 grupos e 100 dezenas
async function carregarCatalogo() {
  const res = await fetch('/api/catalogo');
  const data = await res.json();

  inputGrupoEl.innerHTML = '';
  gridCatalogoEl.innerHTML = '';

  data.produtos.forEach(prod => {
    // Preenche o select de grupo
    const opt = document.createElement('option');
    opt.value = prod.id;
    opt.textContent = `${prod.id} - ${prod.nome} (${prod.dezenas.join(', ')})`;
    inputGrupoEl.appendChild(opt);

    // Monta o card no catálogo
    const box = document.createElement('div');
    box.className = 'produto-box';

    const dezenasHTML = prod.dezenas
      .map(d => `<div class="dezena-chip" title="Selecionar dezena ${d}" onclick="selecionarDezenaRapida('${d}')">${d}</div>`)
      .join('');

    box.innerHTML = `
      <div class="produto-topo">
        <span class="produto-id">Grupo ${prod.id}</span>
        <span class="produto-nome" title="Clique para renomear" onclick="renomearProduto('${prod.id}', '${prod.nome}')">${prod.nome}</span>
      </div>
      <div class="dezenas-row">${dezenasHTML}</div>
    `;
    gridCatalogoEl.appendChild(box);
  });
}

// Clique rápido na dezena do catálogo preenche o formulário
window.selecionarDezenaRapida = function (dezena) {
  const mod = modalidadeEl.value;
  if (mod === 'terno_dezena') {
    if (!terno1El.value) terno1El.value = dezena;
    else if (!terno2El.value) terno2El.value = dezena;
    else if (!terno3El.value) terno3El.value = dezena;
    else {
      terno1El.value = dezena;
      terno2El.value = '';
      terno3El.value = '';
    }
  } else {
    modalidadeEl.value = 'dezena';
    modalidadeEl.dispatchEvent(new Event('change'));
    inputDezenaEl.value = dezena;
  }
  valorEl.focus();
};

// Permite renomear qualquer um dos 25 produtos
window.renomearProduto = async function (id, nomeAtual) {
  const novoNome = prompt(`Novo nome para o Produto ${id}:`, nomeAtual);
  if (!novoNome || novoNome.trim() === nomeAtual) return;

  const res = await fetch(`/api/catalogo/produto/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: novoNome.trim() })
  });

  if (res.ok) {
    await carregarCatalogo();
  }
};

// Carrega o histórico de vendas
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

// Envia nova venda
formVendaEl.addEventListener('submit', async e => {
  e.preventDefault();
  const modalidade = modalidadeEl.value;
  const valor = parseFloat(valorEl.value);

  let selecao;
  if (modalidade === 'grupo') {
    selecao = inputGrupoEl.value;
  } else if (modalidade === 'dezena') {
    selecao = inputDezenaEl.value;
  } else if (modalidade === 'terno_dezena') {
    selecao = [terno1El.value, terno2El.value, terno3El.value];
  }

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

  mostrarFeedback(`Venda registrada com sucesso (${data.chaveNormalizada})!`, 'sucesso');
  inputDezenaEl.value = '';
  terno1El.value = '';
  terno2El.value = '';
  terno3El.value = '';
  valorEl.value = '';

  await carregarVendas();
});

window.excluirVenda = async function (id) {
  const res = await fetch(`/api/vendas/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await carregarVendas();
  }
};

// Inicialização
carregarCatalogo();
carregarVendas();
