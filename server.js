const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const CATALOGO_PATH = path.join(DATA_DIR, 'catalogo.json');
const VENDAS_PATH = path.join(DATA_DIR, 'vendas.json');
const PEDIDOS_PATH = path.join(DATA_DIR, 'pedidos_online.json');
const RESULTADOS_PATH = path.join(DATA_DIR, 'resultados.json');
const AGENTES_PATH = path.join(DATA_DIR, 'agentes.json');

const INFINITEPAY_HANDLE = (process.env.INFINITEPAY_HANDLE || '').replace(/^\$/, '').trim();
const INFINITEPAY_API_KEY = (process.env.INFINITEPAY_API_KEY || '').trim();
const INFINITEPAY_LINKS_URL = 'https://api.checkout.infinitepay.io/links';
const INFINITEPAY_CHECK_URL = 'https://api.checkout.infinitepay.io/payment_check';
const ADMIN_CHAVE = (process.env.ADMIN_KEY || '99dasorte-adm').trim();
const VALOR_MINIMO_CHECKOUT = 1.0;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const COTACOES = {
  M: { nome: 'Milhar', codigo: 'M', multiplicador: 6000, qtd: 1, tipo: 'milhar' },
  C: { nome: 'Centena', codigo: 'C', multiplicador: 600, qtd: 1, tipo: 'centena' },
  DZ: { nome: 'Dezena', codigo: 'DZ', multiplicador: 50, qtd: 1, tipo: 'dezena' },
  U: { nome: 'Unidade', codigo: 'U', multiplicador: 5, qtd: 1, tipo: 'unidade' },
  G: { nome: 'Grupo', codigo: 'G', multiplicador: 15, qtd: 1, tipo: 'grupo' },
  DG: { nome: 'Dupla de Grupo', codigo: 'DG', multiplicador: 16, qtd: 2, tipo: 'grupo' },
  TG: { nome: 'Terno de Grupo', codigo: 'TG', multiplicador: 100, qtd: 3, tipo: 'grupo' },
  PAS: { nome: 'Passe', codigo: 'PAS', multiplicador: 75, qtd: 2, tipo: 'grupo' },
  DDZ: { nome: 'Duque de Dezena', codigo: 'DDZ', multiplicador: 200, qtd: 2, tipo: 'dezena' },
  TDZ: { nome: 'Terno de Dezena', codigo: 'TDZ', multiplicador: 6000, qtd: 3, tipo: 'dezena' }
};

function gerarTodasDezenas() {
  const lista = [];
  for (let i = 1; i <= 99; i++) {
    lista.push(String(i).padStart(2, '0'));
  }
  lista.push('00');
  return lista;
}

function gerarCatalogoPadrao() {
  const todasDezenas = gerarTodasDezenas();
  const produtos = [];

  for (let g = 1; g <= 25; g++) {
    const idGrupo = String(g).padStart(2, '0');
    const inicio = (g - 1) * 4;
    const dezenasDoGrupo = todasDezenas.slice(inicio, inicio + 4);

    produtos.push({
      id: idGrupo,
      nome: `Produto ${idGrupo}`,
      dezenas: dezenasDoGrupo
    });
  }

  return {
    app: '99 da sorte',
    regras: {
      estoqueIlimitado: true,
      valorMinimoTerminal: 0.01,
      valorMinimoCheckout: VALOR_MINIMO_CHECKOUT,
      cotacoes: COTACOES
    },
    landingBase: {
      slug: 'modelo-produto',
      titulo: 'Produto / Concurso em Breve',
      subtitulo: 'Base modelo pronta para receber produto, copy e regras oficiais.',
      copy: 'Espaço reservado para a copy de venda do produto. O sorteio é único e compartilhado entre todos os produtos, variando apenas a modalidade utilizada.',
      regraConcorrer: 'Escolha o número de acordo com a modalidade definida para este produto e preencha seus dados de contato para falarmos com você caso seja sorteado.',
      modalidade: 'M',
      precoBilhete: 1.0
    },
    produtos
  };
}

function gerarAgentesPadrao() {
  return {
    ativoGlobal: true,
    intervaloMinSegundos: 8,
    intervaloMaxSegundos: 16,
    agentes: [
      { id: 'AGT-01', nome: 'Lucas M.', regiao: 'Zona Sul', dezenasPreferidas: ['27', '07', '77'], ativo: true },
      { id: 'AGT-02', nome: 'Camila R.', regiao: 'Centro', dezenasPreferidas: ['14', '24', '88'], ativo: true },
      { id: 'AGT-03', nome: 'Rafael S.', regiao: 'Zona Leste', dezenasPreferidas: ['03', '33', '69'], ativo: true },
      { id: 'AGT-04', nome: 'Beatriz F.', regiao: 'Zona Norte', dezenasPreferidas: ['19', '45', '00'], ativo: true },
      { id: 'AGT-05', nome: 'Diego T.', regiao: 'Zona Oeste', dezenasPreferidas: ['11', '52', '91'], ativo: true },
      { id: 'AGT-06', nome: 'Aline C.', regiao: 'Centro', dezenasPreferidas: ['08', '22', '64'], ativo: true }
    ]
  };
}

function inicializarBancoJSON() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CATALOGO_PATH)) {
    fs.writeFileSync(CATALOGO_PATH, JSON.stringify(gerarCatalogoPadrao(), null, 2), 'utf8');
  }
  if (!fs.existsSync(VENDAS_PATH)) {
    fs.writeFileSync(VENDAS_PATH, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(PEDIDOS_PATH)) {
    fs.writeFileSync(PEDIDOS_PATH, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(RESULTADOS_PATH)) {
    fs.writeFileSync(RESULTADOS_PATH, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(AGENTES_PATH)) {
    fs.writeFileSync(AGENTES_PATH, JSON.stringify(gerarAgentesPadrao(), null, 2), 'utf8');
  }
}

function lerJSON(caminho) {
  return JSON.parse(fs.readFileSync(caminho, 'utf8'));
}

function salvarJSON(caminho, dados) {
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), 'utf8');
}

inicializarBancoJSON();

const GRUPOS_VALIDOS = new Set(Array.from({ length: 25 }, (_, i) => String(i + 1).padStart(2, '0')));
const DEZENAS_VALIDAS = new Set(gerarTodasDezenas());
const UNIDADES_VALIDAS = new Set(Array.from({ length: 10 }, (_, i) => String(i)));

function validarItem(item, tipo) {
  const limpo = String(item || '').trim();
  if (tipo === 'grupo') {
    const g = limpo.padStart(2, '0');
    if (!GRUPOS_VALIDOS.has(g)) return { erro: `Grupo inválido: "${limpo}". Use 01 a 25.` };
    return { valor: g, ordem: Number(g) };
  }
  if (tipo === 'dezena') {
    const d = limpo.padStart(2, '0');
    if (!DEZENAS_VALIDAS.has(d)) return { erro: `Dezena inválida: "${limpo}". Use 01 a 99 ou 00.` };
    return { valor: d, ordem: d === '00' ? 100 : Number(d) };
  }
  if (tipo === 'centena') {
    const c = limpo.padStart(3, '0');
    if (!/^\d{3}$/.test(c)) return { erro: `Centena inválida: "${limpo}". Use 3 dígitos (ex: 045).` };
    return { valor: c, ordem: Number(c) };
  }
  if (tipo === 'milhar') {
    const m = limpo.padStart(4, '0');
    if (!/^\d{4}$/.test(m)) return { erro: `Milhar inválida: "${limpo}". Use 4 dígitos (ex: 0125).` };
    return { valor: m, ordem: Number(m) };
  }
  if (tipo === 'unidade') {
    if (!UNIDADES_VALIDAS.has(limpo)) return { erro: `Unidade inválida: "${limpo}". Use 0 a 9.` };
    return { valor: limpo, ordem: Number(limpo) };
  }
  return { erro: 'Tipo de item desconhecido.' };
}

function calcularGrupoPorDezena(dezenaNormalizada) {
  const num = dezenaNormalizada === '00' ? 100 : Number(dezenaNormalizada);
  const grupo = Math.ceil(num / 4);
  return String(grupo).padStart(2, '0');
}

function normalizarDezenaSorteio(entrada) {
  const limpo = String(entrada || '').trim();
  if (!/^\d{1,2}$/.test(limpo)) return null;
  const pad = limpo.padStart(2, '0');
  return DEZENAS_VALIDAS.has(pad) ? pad : null;
}

function prepararRegistroVenda({ modalidade, selecao, valor, origem, produto, horarioConcurso, dataCiclo, lead, orderNsu }) {
  const cfg = COTACOES[modalidade];
  if (!cfg) return { erro: 'Modalidade inválida.' };

  const valorNumerico = Number(valor);
  if (isNaN(valorNumerico) || valorNumerico < 0.01) {
    return { erro: 'O valor da venda deve ser maior ou igual a 0,01.' };
  }

  const listaBruta = Array.isArray(selecao) ? selecao : [selecao];
  if (listaBruta.length !== cfg.qtd) {
    return {
      erro: `${cfg.nome} (${cfg.codigo}) exige exatamente ${cfg.qtd} ${cfg.tipo}(s).`
    };
  }

  const validados = [];
  for (const raw of listaBruta) {
    const resItem = validarItem(raw, cfg.tipo);
    if (resItem.erro) return { erro: resItem.erro };
    validados.push(resItem);
  }

  const selecaoFinal = cfg.qtd === 1 ? validados[0].valor : validados.map(v => v.valor);
  const ordenados = [...validados].sort((a, b) => a.ordem - b.ordem).map(v => v.valor);
  const chaveNormalizada = `${cfg.codigo}-${ordenados.join('-')}`;

  const valorFormatado = Number(valorNumerico.toFixed(2));
  const retornoPotencial = Number((valorFormatado * cfg.multiplicador).toFixed(2));
  const origemLimpa = origem === 'landing' ? 'landing' : 'presencial';
  const agoraIso = new Date().toISOString();

  return {
    venda: {
      id: `VND-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dataHora: agoraIso,
      dataCiclo: String(dataCiclo || '').trim() || agoraIso.slice(0, 10),
      horarioConcurso: horarioConcurso ? String(horarioConcurso).trim() : null,
      origem: origemLimpa,
      produto: produto || null,
      lead: lead || null,
      orderNsu: orderNsu || null,
      modalidade: cfg.codigo,
      nomeModalidade: cfg.nome,
      multiplicador: cfg.multiplicador,
      selecao: selecaoFinal,
      chaveNormalizada,
      valor: valorFormatado,
      retornoPotencial
    }
  };
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

async function consultarPagamentoInfinitePay(orderNsu) {
  if (!INFINITEPAY_HANDLE) {
    return { pago: false, erro: 'INFINITEPAY_HANDLE não configurado no servidor.' };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (INFINITEPAY_API_KEY) {
    headers['X-Api-Key'] = INFINITEPAY_API_KEY;
  }

  const resp = await fetch(INFINITEPAY_CHECK_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      handle: INFINITEPAY_HANDLE,
      order_nsu: orderNsu
    })
  });

  if (!resp.ok) {
    const texto = await resp.text();
    return { pago: false, erro: `Falha na consulta InfinitePay: ${texto}` };
  }

  const data = await resp.json();
  const pago = Boolean(
    data &&
      (data.paid === true ||
        data.status === 'paid' ||
        data.payment_status === 'paid')
  );

  return { pago, raw: data };
}

function efetivarPedidoPago(orderNsu, detalhePagamento = null) {
  const pedidos = lerJSON(PEDIDOS_PATH);
  const idx = pedidos.findIndex(p => p.order_nsu === orderNsu);
  if (idx === -1) {
    return { ok: false, statusCode: 404, erro: 'Pedido não encontrado.' };
  }

  const pedido = pedidos[idx];
  if (pedido.status === 'pago') {
    return { ok: true, jaConfirmado: true, pedido };
  }

  const preparado = prepararRegistroVenda({
    modalidade: pedido.modalidade,
    selecao: pedido.selecao,
    valor: pedido.valor,
    origem: 'landing',
    produto: pedido.produto,
    horarioConcurso: pedido.horarioConcurso,
    dataCiclo: pedido.dataCiclo,
    lead: pedido.lead,
    orderNsu: pedido.order_nsu
  });

  if (preparado.erro) {
    return { ok: false, statusCode: 400, erro: preparado.erro };
  }

  pedido.status = 'pago';
  pedido.pagoEm = new Date().toISOString();
  pedido.detalhePagamento = detalhePagamento;
  pedidos[idx] = pedido;
  salvarJSON(PEDIDOS_PATH, pedidos);

  const vendas = lerJSON(VENDAS_PATH);
  vendas.unshift(preparado.venda);
  salvarJSON(VENDAS_PATH, vendas);

  return { ok: true, jaConfirmado: false, pedido, venda: preparado.venda };
}

app.get('/api/catalogo', (req, res) => {
  try {
    const catalogo = lerJSON(CATALOGO_PATH);
    res.json(catalogo);
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao ler catalogo.json' });
  }
});

app.get('/api/vendas', (req, res) => {
  try {
    const vendas = lerJSON(VENDAS_PATH);
    const pedidos = lerJSON(PEDIDOS_PATH);
    const pendentes = pedidos.filter(p => p.status !== 'pago').length;
    const totalArrecadado = vendas.reduce((acc, v) => acc + v.valor, 0);
    const retornoPotencialTotal = vendas.reduce((acc, v) => acc + (v.retornoPotencial || 0), 0);

    res.json({
      totalRegistros: vendas.length,
      pedidosPendentes: pendentes,
      totalArrecadado: Number(totalArrecadado.toFixed(2)),
      retornoPotencialTotal: Number(retornoPotencialTotal.toFixed(2)),
      vendas
    });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao ler vendas.json' });
  }
});

app.post('/api/vendas', (req, res) => {
  const preparado = prepararRegistroVenda(req.body);
  if (preparado.erro) {
    return res.status(400).json({ erro: preparado.erro });
  }

  const vendas = lerJSON(VENDAS_PATH);
  vendas.unshift(preparado.venda);
  salvarJSON(VENDAS_PATH, vendas);

  res.status(201).json(preparado.venda);
});

app.delete('/api/vendas/:id', (req, res) => {
  const { id } = req.params;
  const vendas = lerJSON(VENDAS_PATH);
  const filtradas = vendas.filter(v => v.id !== id);

  if (filtradas.length === vendas.length) {
    return res.status(404).json({ erro: 'Venda não encontrada.' });
  }

  salvarJSON(VENDAS_PATH, filtradas);
  res.json({ sucesso: true });
});

// Resultados dos concursos e cruzamento de bilhetes
app.get('/api/resultados', (req, res) => {
  try {
    const { data, horario } = req.query;
    const resultados = lerJSON(RESULTADOS_PATH);
    let filtrados = resultados;

    if (data) {
      filtrados = filtrados.filter(r => r.dataCiclo === String(data).trim());
    }
    if (horario) {
      filtrados = filtrados.filter(r => r.horario === String(horario).trim());
    }

    const ultimoPorHorario = {};
    for (const r of resultados) {
      if (!ultimoPorHorario[r.horario]) {
        ultimoPorHorario[r.horario] = r;
      }
    }

    res.json({
      total: filtrados.length,
      resultados: filtrados,
      ultimoPorHorario
    });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao ler resultados.json' });
  }
});

app.post('/api/resultados', (req, res) => {
  const chaveEnviada = req.headers['x-admin-key'] || (req.body && req.body.chaveAdmin);
  if (chaveEnviada !== ADMIN_CHAVE) {
    return res.status(401).json({ erro: 'Acesso não autorizado para publicar resultado.' });
  }

  const { horario, dezena, dataCiclo } = req.body || {};
  const dezenaValida = normalizarDezenaSorteio(dezena);
  if (!horario || !dezenaValida) {
    return res.status(400).json({ erro: 'Informe um horário válido e uma dezena (01 a 99 ou 00).' });
  }

  const dataLimpa = String(dataCiclo || '').trim() || new Date().toISOString().slice(0, 10);
  const grupoCorrespondente = calcularGrupoPorDezena(dezenaValida);

  const novoResultado = {
    id: `RES-${Date.now()}`,
    dataCiclo: dataLimpa,
    horario: String(horario).trim(),
    dezena: dezenaValida,
    grupo: grupoCorrespondente,
    atualizadoEm: new Date().toISOString()
  };

  const resultados = lerJSON(RESULTADOS_PATH);
  const semDuplicata = resultados.filter(
    r => !(r.dataCiclo === novoResultado.dataCiclo && r.horario === novoResultado.horario)
  );
  semDuplicata.unshift(novoResultado);
  salvarJSON(RESULTADOS_PATH, semDuplicata);

  const vendas = lerJSON(VENDAS_PATH);
  const possiveisGanhadores = vendas.filter(v => {
    const bateDezena =
      v.modalidade === 'DZ' &&
      (String(v.selecao).padStart(2, '0') === dezenaValida ||
        String(v.chaveNormalizada || '').endsWith(`-${dezenaValida}`));
    const bateHorario = !v.horarioConcurso || v.horarioConcurso === novoResultado.horario;
    const bateData = !v.dataCiclo || v.dataCiclo === novoResultado.dataCiclo;
    return bateDezena && bateHorario && bateData;
  });

  res.status(201).json({
    resultado: novoResultado,
    possiveisGanhadores
  });
});

// Consulta de bilhete pelo ID
app.get('/api/bilhete/:id', (req, res) => {
  try {
    const idBusca = decodeURIComponent(req.params.id || '').trim();
    if (!idBusca) {
      return res.status(400).json({ erro: 'Informe o ID do bilhete.' });
    }

    const vendas = lerJSON(VENDAS_PATH);
    const venda = vendas.find(v => String(v.id).toLowerCase() === idBusca.toLowerCase());

    if (!venda) {
      return res.status(404).json({ erro: 'Bilhete não encontrado para o ID informado.' });
    }

    const resultados = lerJSON(RESULTADOS_PATH);
    const dataVenda = venda.dataCiclo || String(venda.dataHora || '').slice(0, 10);
    const resultadoHorario = resultados.find(
      r =>
        r.horario === venda.horarioConcurso &&
        (!venda.dataCiclo || r.dataCiclo === venda.dataCiclo)
    );

    let statusApuracao = 'Aguardando resultado do horário';
    if (resultadoHorario) {
      const dezenaBilhete = Array.isArray(venda.selecao)
        ? venda.selecao.join('-')
        : String(venda.selecao).padStart(2, '0');
      const acertou = venda.modalidade === 'DZ' && dezenaBilhete === resultadoHorario.dezena;
      statusApuracao = acertou
        ? `Premiado! Dezena ${resultadoHorario.dezena} sorteada`
        : `Apurado (Sorteada: ${resultadoHorario.dezena} • Grupo ${resultadoHorario.grupo})`;
    }

    res.json({
      id: venda.id,
      data: dataVenda,
      horarioConcurso: venda.horarioConcurso || 'Não informado',
      modalidade: venda.modalidade,
      selecao: venda.selecao,
      chaveNormalizada: venda.chaveNormalizada,
      valor: venda.valor,
      statusApuracao,
      resultadoOficial: resultadoHorario || null
    });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao consultar bilhete.' });
  }
});

// Banco de agentes de aquecimento
app.get('/api/agentes', (req, res) => {
  try {
    const configAgentes = lerJSON(AGENTES_PATH);
    res.json(configAgentes);
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao ler agentes.json' });
  }
});

// Motor único de checkout para Landing Pages (InfinitePay)
app.post('/api/checkout/criar', async (req, res) => {
  if (!INFINITEPAY_HANDLE) {
    return res.status(400).json({
      erro: 'Configure INFINITEPAY_HANDLE no ambiente antes de gerar checkout.'
    });
  }

  const { modalidade, selecao, valor, produto, horarioConcurso, dataCiclo, lead, retornoUrl } = req.body;

  const valorNumerico = Number(valor);
  if (isNaN(valorNumerico) || valorNumerico < VALOR_MINIMO_CHECKOUT) {
    return res.status(400).json({
      erro: `O checkout exige valor mínimo de R$ ${VALOR_MINIMO_CHECKOUT.toFixed(2)}.`
    });
  }

  const nomeLead = String((lead && lead.nome) || '').trim();
  const contatoLead = String((lead && lead.contato) || '').trim();
  if (!nomeLead || !contatoLead) {
    return res.status(400).json({
      erro: 'Preencha nome e contato/WhatsApp para caso você ganhe no sorteio.'
    });
  }

  const preparado = prepararRegistroVenda({
    modalidade,
    selecao,
    valor: valorNumerico,
    origem: 'landing',
    produto: produto || 'Produto Base',
    horarioConcurso: horarioConcurso || null,
    dataCiclo: dataCiclo || null,
    lead: { nome: nomeLead, contato: contatoLead }
  });

  if (preparado.erro) {
    return res.status(400).json({ erro: preparado.erro });
  }

  const orderNsu = `NSU-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const baseUrl = getBaseUrl(req);
  const redirectUrl =
    retornoUrl || `${baseUrl}/produto.html?order_nsu=${encodeURIComponent(orderNsu)}`;
  const webhookUrl = `${baseUrl}/api/checkout/webhook`;

  const priceCentavos = Math.round(preparado.venda.valor * 100);
  const tituloProduto = String(produto || 'Produto Base').trim();
  const exibicaoSelecao = Array.isArray(preparado.venda.selecao)
    ? preparado.venda.selecao.join('-')
    : preparado.venda.selecao;

  const payloadInfinitePay = {
    handle: INFINITEPAY_HANDLE,
    order_nsu: orderNsu,
    redirect_url: redirectUrl,
    webhook_url: webhookUrl,
    items: [
      {
        quantity: 1,
        price: priceCentavos,
        description: `${tituloProduto} (${preparado.venda.modalidade}: ${exibicaoSelecao})`
      }
    ]
  };

  const headers = { 'Content-Type': 'application/json' };
  if (INFINITEPAY_API_KEY) {
    headers['X-Api-Key'] = INFINITEPAY_API_KEY;
  }

  try {
    const resp = await fetch(INFINITEPAY_LINKS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payloadInfinitePay)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(502).json({
        erro: data.message || data.erro || 'Falha ao criar link de pagamento na InfinitePay.'
      });
    }

    const checkoutUrl =
      data.url || data.checkout_url || data.payment_url || data.link || null;
    if (!checkoutUrl) {
      return res.status(502).json({
        erro: 'InfinitePay não retornou URL de checkout.'
      });
    }

    const pedidos = lerJSON(PEDIDOS_PATH);
    pedidos.unshift({
      order_nsu: orderNsu,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      origem: 'landing',
      produto: tituloProduto,
      horarioConcurso: preparado.venda.horarioConcurso,
      dataCiclo: preparado.venda.dataCiclo,
      lead: { nome: nomeLead, contato: contatoLead },
      modalidade: preparado.venda.modalidade,
      selecao: preparado.venda.selecao,
      chaveNormalizada: preparado.venda.chaveNormalizada,
      valor: preparado.venda.valor,
      retornoPotencial: preparado.venda.retornoPotencial,
      checkoutUrl
    });
    salvarJSON(PEDIDOS_PATH, pedidos);

    res.status(201).json({
      order_nsu: orderNsu,
      status: 'pendente',
      checkout_url: checkoutUrl
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro de comunicação com a API da InfinitePay.' });
  }
});

// Webhook da InfinitePay (sempre valida via payment_check antes de efetivar)
app.post('/api/checkout/webhook', async (req, res) => {
  const orderNsu =
    (req.body && (req.body.order_nsu || req.body.orderNsu)) ||
    req.query.order_nsu ||
    '';

  if (!orderNsu) {
    return res.status(400).json({ erro: 'order_nsu ausente.' });
  }

  try {
    const verificacao = await consultarPagamentoInfinitePay(String(orderNsu));
    if (!verificacao.pago) {
      return res.status(200).json({ recebido: true, pago: false });
    }

    const resultado = efetivarPedidoPago(String(orderNsu), verificacao.raw);
    if (!resultado.ok) {
      return res.status(resultado.statusCode).json({ erro: resultado.erro });
    }

    res.status(200).json({ recebido: true, pago: true, status: resultado.pedido.status });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao processar webhook.' });
  }
});

// Consulta/confirmação de pedido (usado no retorno da landing page)
app.get('/api/checkout/status/:orderNsu', async (req, res) => {
  const { orderNsu } = req.params;
  const pedidos = lerJSON(PEDIDOS_PATH);
  const pedido = pedidos.find(p => p.order_nsu === orderNsu);

  if (!pedido) {
    return res.status(404).json({ erro: 'Pedido não encontrado.' });
  }

  if (pedido.status === 'pago') {
    return res.json({
      order_nsu: pedido.order_nsu,
      status: 'pago',
      chaveNormalizada: pedido.chaveNormalizada,
      valor: pedido.valor
    });
  }

  try {
    const verificacao = await consultarPagamentoInfinitePay(orderNsu);
    if (verificacao.pago) {
      const resultado = efetivarPedidoPago(orderNsu, verificacao.raw);
      if (resultado.ok) {
        return res.json({
          order_nsu: orderNsu,
          status: 'pago',
          chaveNormalizada: pedido.chaveNormalizada,
          valor: pedido.valor
        });
      }
    }

    res.json({
      order_nsu: orderNsu,
      status: pedido.status,
      chaveNormalizada: pedido.chaveNormalizada,
      valor: pedido.valor
    });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao consultar status do pagamento.' });
  }
});

app.listen(PORT, () => {
  console.log(`99 da sorte rodando em http://localhost:${PORT}`);
});
