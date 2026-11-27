const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const RAIZ = __dirname;
const PUBLIC_DIR = path.join(RAIZ, 'public');
const DATA_DIR = path.join(RAIZ, 'data');

const CATALOGO_PATH = path.join(DATA_DIR, 'catalogo.json');
const VENDAS_PATH = path.join(DATA_DIR, 'vendas.json');
const PEDIDOS_PATH = path.join(DATA_DIR, 'pedidos_online.json');
const RESULTADOS_PATH = path.join(DATA_DIR, 'resultados.json');
const AGENTES_PATH = path.join(DATA_DIR, 'agentes.json');

const ADMIN_CHAVE = (process.env.ADMIN_KEY || '627424').trim();
const INFINITEPAY_HANDLE = (process.env.INFINITEPAY_HANDLE || '').replace(/^\$/, '').trim();
const INFINITEPAY_API_KEY = (process.env.INFINITEPAY_API_KEY || '').trim();
const INFINITEPAY_LINKS_URL = 'https://api.checkout.infinitepay.io/links';
const INFINITEPAY_CHECK_URL = 'https://api.checkout.infinitepay.io/payment_check';
const VALOR_MINIMO_CHECKOUT = 1.0;

const PIX_PROVISORIO_COPIA_COLA =
  '00020126580014br.gov.bcb.pix013657b60c7f-4628-474b-92c5-e22753afc57e52040000530398654042.505802BR5919IZAQUE SOUZA SOARES60085500019962070503***6304AC47';

const HORARIOS_CONCURSOS = [
  '08:10', '09:10', '10:10', '11:10', '12:10', '13:10',
  '14:10', '15:10', '16:10', '17:10', '18:10', '19:10',
  '19:45', '20:50', '21:10'
];

const COTACOES = {
  M: { nome: 'Milhar', codigo: 'M', multiplicador: 6000, qtd: 1, tipo: 'milhar' },
  C: { nome: 'Centena', codigo: 'C', multiplicador: 600, qtd: 1, tipo: 'centena' },
  DZ: { nome: 'Dezena', codigo: 'DZ', multiplicador: 20, qtd: 1, tipo: 'dezena' },
  U: { nome: 'Unidade', codigo: 'U', multiplicador: 5, qtd: 1, tipo: 'unidade' },
  G: { nome: 'Grupo', codigo: 'G', multiplicador: 15, qtd: 1, tipo: 'grupo' },
  DG: { nome: 'Dupla de Grupo', codigo: 'DG', multiplicador: 16, qtd: 2, tipo: 'grupo' },
  TG: { nome: 'Terno de Grupo', codigo: 'TG', multiplicador: 100, qtd: 3, tipo: 'grupo' },
  PAS: { nome: 'Passe', codigo: 'PAS', multiplicador: 75, qtd: 2, tipo: 'grupo' },
  DDZ: { nome: 'Duque de Dezena', codigo: 'DDZ', multiplicador: 200, qtd: 2, tipo: 'dezena' },
  TDZ: { nome: 'Terno de Dezena', codigo: 'TDZ', multiplicador: 6000, qtd: 3, tipo: 'dezena' }
};

app.use(express.json());
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}
app.use(express.static(RAIZ));

function gerarTodasDezenas() {
  const lista = [];
  for (let i = 1; i <= 99; i++) {
    lista.push(String(i).padStart(2, '0'));
  }
  lista.push('00');
  return lista;
}

function obterCatalogoConcursos() {
  return HORARIOS_CONCURSOS.map((horario, idx) => {
    const numero = String(idx + 1).padStart(2, '0');
    return {
      id: `C-${numero}`,
      numero,
      horario,
      tipo: idx >= 12 ? 'SESSÃO ESPECIAL' : 'GRADE HORÁRIA',
      modalidade: 'DZ',
      valorBilhete: 2.5,
      premio: 50.0
    };
  });
}

function obterDataCicloHoje(agora = new Date()) {
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function concursoEstaAtivoHoje(horarioStr, agora = new Date()) {
  const partes = String(horarioStr || '').split(':').map(Number);
  const hh = partes[0];
  const mm = partes[1];
  if (Number.isNaN(hh) || Number.isNaN(mm)) return false;
  const alvoHoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
    hh,
    mm,
    0,
    0
  );
  return alvoHoje.getTime() > agora.getTime();
}

function encontrarConcurso({ concursoId, concursoNumero, horarioConcurso, horario, produto }) {
  const catalogo = obterCatalogoConcursos();
  const idLimpo = String(concursoId || '').trim().toUpperCase();
  const digitosNum = String(concursoNumero || '').replace(/\D/g, '');
  const numLimpo = digitosNum ? digitosNum.padStart(2, '0') : '';
  const horaLimpa = String(horarioConcurso || horario || '').trim();

  if (idLimpo) {
    const porId = catalogo.find(c => c.id.toUpperCase() === idLimpo);
    if (porId) return porId;
  }

  if (numLimpo) {
    const porNum = catalogo.find(c => c.numero === numLimpo);
    if (porNum) return porNum;
  }

  if (horaLimpa) {
    const porHora = catalogo.find(c => c.horario === horaLimpa);
    if (porHora) return porHora;
  }

  const matchHoraTexto = String(produto || '').match(/\b\d{2}:\d{2}\b/);
  if (matchHoraTexto) {
    const porTexto = catalogo.find(c => c.horario === matchHoraTexto[0]);
    if (porTexto) return porTexto;
  }

  return null;
}

function gerarIdBilheteConcurso(concurso) {
  const sufixo = Math.floor(1000 + Math.random() * 9000);
  return `99S-${concurso.id}-${sufixo}`;
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
    concursos: obterCatalogoConcursos(),
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

function prepararRegistroVenda({
  modalidade,
  selecao,
  valor,
  origem,
  produto,
  concursoId,
  concursoNumero,
  horarioConcurso,
  dataCiclo,
  lead,
  orderNsu
}) {
  const modLimpa = String(modalidade || 'DZ').trim().toUpperCase();
  const cfg = COTACOES[modLimpa];
  if (!cfg) return { erro: 'Modalidade inválida.' };

  const valorNumerico = Number(valor);
  if (Number.isNaN(valorNumerico) || valorNumerico < 0.01) {
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

  const concurso = encontrarConcurso({ concursoId, concursoNumero, horarioConcurso, produto });
  const selecaoFinal = cfg.qtd === 1 ? validados[0].valor : validados.map(v => v.valor);
  const ordenados = [...validados].sort((a, b) => a.ordem - b.ordem).map(v => v.valor);
  const chaveNormalizada = `${cfg.codigo}-${ordenados.join('-')}`;

  const valorFormatado = Number(valorNumerico.toFixed(2));
  const retornoPotencial = concurso && cfg.codigo === 'DZ'
    ? Number(concurso.premio || 50).toFixed(2) * 1
    : Number((valorFormatado * cfg.multiplicador).toFixed(2));

  const origemLimpa = origem === 'landing' ? 'landing' : 'presencial';
  const agora = new Date();
  const dataCicloLimpa = String(dataCiclo || '').trim() || obterDataCicloHoje(agora);
  const idGerado = concurso && cfg.codigo === 'DZ'
    ? gerarIdBilheteConcurso(concurso)
    : `VND-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  return {
    venda: {
      id: idGerado,
      dataHora: agora.toISOString(),
      dataCiclo: dataCicloLimpa,
      concursoId: concurso ? concurso.id : null,
      concursoNumero: concurso ? concurso.numero : null,
      horarioConcurso: concurso ? concurso.horario : (horarioConcurso || null),
      origem: origemLimpa,
      produto: produto || (concurso ? `Concurso #${concurso.numero} • ${concurso.horario}` : null),
      lead: lead || null,
      orderNsu: orderNsu || null,
      modalidade: cfg.codigo,
      nomeModalidade: cfg.nome,
      multiplicador: cfg.multiplicador,
      selecao: selecaoFinal,
      chaveNormalizada,
      valor: valorFormatado,
      retornoPotencial,
      pixCopiaCola: PIX_PROVISORIO_COPIA_COLA
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
    concursoId: pedido.concursoId,
    concursoNumero: pedido.concursoNumero,
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

app.get('/api/concursos/ativos', (req, res) => {
  const agora = new Date();
  const dataCiclo = obterDataCicloHoje(agora);
  const todos = obterCatalogoConcursos();
  const ativosHoje = todos.filter(c => concursoEstaAtivoHoje(c.horario, agora));

  res.json({
    dataCiclo,
    totalCatalogo: todos.length,
    totalAtivos: ativosHoje.length,
    encerradosAteVirada: ativosHoje.length === 0,
    concursos: ativosHoje
  });
});

app.post('/api/reservar', (req, res) => {
  try {
    const body = req.body || {};
    const concurso = encontrarConcurso(body);

    if (!concurso) {
      return res.status(404).json({ erro: 'Concurso não encontrado.' });
    }

    const agora = new Date();
    if (!concursoEstaAtivoHoje(concurso.horario, agora)) {
      return res.status(400).json({
        erro: `O concurso #${concurso.numero} (${concurso.horario}) já encerrou hoje. Aguarde a virada do dia para novos concursos.`
      });
    }

    const dezenaLimpa = normalizarDezenaSorteio(body.selecao || body.dezena);
    if (!dezenaLimpa) {
      return res.status(400).json({ erro: 'Selecione uma dezena válida (01 a 99 ou 00).' });
    }

    const nome = String((body.lead && body.lead.nome) || body.nome || '').trim();
    const contato = String((body.lead && body.lead.contato) || body.telefone || body.whatsapp || '').trim();
    if (!nome || !contato) {
      return res.status(400).json({ erro: 'Informe nome e WhatsApp/telefone para registrar o bilhete.' });
    }

    const dataCiclo = String(body.dataCiclo || '').trim() || obterDataCicloHoje(agora);
    const idBilhete = gerarIdBilheteConcurso(concurso);
    const valor = Number(concurso.valorBilhete) || 2.5;
    const grupo = calcularGrupoPorDezena(dezenaLimpa);

    const novoBilhete = {
      id: idBilhete,
      dataHora: agora.toISOString(),
      dataCiclo,
      concursoId: concurso.id,
      concursoNumero: concurso.numero,
      horarioConcurso: concurso.horario,
      produto: `Concurso #${concurso.numero} • ${concurso.horario}`,
      modalidade: 'DZ',
      nomeModalidade: 'Dezena',
      selecao: dezenaLimpa,
      chaveNormalizada: `DZ-${concurso.id}-${dezenaLimpa}`,
      valor,
      retornoPotencial: Number(concurso.premio) || 50.0,
      grupo,
      origem: body.origem === 'presencial' ? 'presencial' : 'landing',
      statusPagamento: 'pendente_pix_provisorio',
      pixCopiaCola: PIX_PROVISORIO_COPIA_COLA,
      lead: { nome, contato }
    };

    const vendas = lerJSON(VENDAS_PATH);
    vendas.unshift(novoBilhete);
    salvarJSON(VENDAS_PATH, vendas);

    return res.status(201).json({
      ok: true,
      bilhete: novoBilhete,
      concurso
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Falha ao registrar reserva do bilhete.' });
  }
});

app.get('/api/catalogo', (req, res) => {
  try {
    const catalogo = lerJSON(CATALOGO_PATH);
    res.json({
      ...catalogo,
      concursos: obterCatalogoConcursos()
    });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao ler catalogo.json' });
  }
});

app.get('/api/vendas', (req, res) => {
  try {
    const vendas = lerJSON(VENDAS_PATH);
    const pedidos = lerJSON(PEDIDOS_PATH);
    const pendentes = pedidos.filter(p => p.status !== 'pago').length;
    const totalArrecadado = vendas.reduce((acc, v) => acc + Number(v.valor || 0), 0);
    const retornoPotencialTotal = vendas.reduce((acc, v) => acc + Number(v.retornoPotencial || 0), 0);

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
  const preparado = prepararRegistroVenda(req.body || {});
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
    for (const r of filtrados) {
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
  const chaveEnviada = String(
    req.headers['x-admin-key'] || (req.body && req.body.chaveAdmin) || ''
  ).trim();
  if (chaveEnviada !== ADMIN_CHAVE) {
    return res.status(401).json({ erro: 'Acesso não autorizado para publicar resultado.' });
  }

  const body = req.body || {};
  const concurso = encontrarConcurso(body);
  const horarioLimpo = concurso ? concurso.horario : String(body.horario || '').trim();
  const dezenaValida = normalizarDezenaSorteio(body.dezena);

  if (!horarioLimpo || !dezenaValida) {
    return res.status(400).json({ erro: 'Informe um horário válido e uma dezena (01 a 99 ou 00).' });
  }

  const dataLimpa = String(body.dataCiclo || '').trim() || obterDataCicloHoje();
  const grupoCorrespondente = calcularGrupoPorDezena(dezenaValida);

  const novoResultado = {
    id: `RES-${Date.now()}`,
    dataCiclo: dataLimpa,
    concursoId: concurso ? concurso.id : null,
    concursoNumero: concurso ? concurso.numero : null,
    horario: horarioLimpo,
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

  res.status(201).json({ resultado: novoResultado, possiveisGanhadores });
});

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

    const concursoInfo = encontrarConcurso(venda) || {
      id: venda.concursoId || 'C-00',
      numero: venda.concursoNumero || '--',
      horario: venda.horarioConcurso || '--:--',
      premio: venda.retornoPotencial || 50.0
    };

    const dataCicloBilhete = venda.dataCiclo || String(venda.dataHora || '').slice(0, 10);
    const resultados = lerJSON(RESULTADOS_PATH);
    const resultadoHorario = resultados.find(r => {
      const mesmaData = r.dataCiclo === dataCicloBilhete;
      const mesmoHorario = r.horario === (venda.horarioConcurso || concursoInfo.horario);
      const mesmoConcurso = !r.concursoId || !venda.concursoId || r.concursoId === venda.concursoId;
      return mesmaData && mesmoHorario && mesmoConcurso;
    });

    const dezenaBilhete = Array.isArray(venda.selecao)
      ? venda.selecao.join('-')
      : String(venda.selecao).padStart(2, '0');

    let statusApuracao = `Aguardando apuração do Concurso #${concursoInfo.numero} (${concursoInfo.horario})`;
    let premiado = false;

    if (resultadoHorario) {
      premiado = venda.modalidade === 'DZ' && dezenaBilhete === resultadoHorario.dezena;
      statusApuracao = premiado
        ? `PREMIADO! Dezena ${resultadoHorario.dezena} sorteada no Concurso #${concursoInfo.numero} (${concursoInfo.horario})`
        : `Não premiado no Concurso #${concursoInfo.numero} (Sorteada: ${resultadoHorario.dezena} • Grupo ${resultadoHorario.grupo})`;
    }

    res.json({
      id: venda.id,
      dataCiclo: dataCicloBilhete,
      concurso: {
        id: concursoInfo.id,
        numero: concursoInfo.numero,
        horario: concursoInfo.horario,
        premio: concursoInfo.premio || 50.0
      },
      modalidade: venda.modalidade || 'DZ',
      dezena: dezenaBilhete,
      valor: venda.valor ?? 2.5,
      premiado,
      statusApuracao,
      resultadoOficial: resultadoHorario || null
    });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao consultar bilhete.' });
  }
});

app.get('/api/agentes', (req, res) => {
  try {
    const configAgentes = lerJSON(AGENTES_PATH);
    res.json(configAgentes);
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao ler agentes.json' });
  }
});

app.post('/api/agentes/toggle', (req, res) => {
  const chaveEnviada = String(
    req.headers['x-admin-key'] || (req.body && req.body.chaveAdmin) || ''
  ).trim();
  if (chaveEnviada !== ADMIN_CHAVE) {
    return res.status(401).json({ erro: 'Acesso não autorizado.' });
  }

  try {
    const configAgentes = lerJSON(AGENTES_PATH);
    const novoEstado =
      req.body && typeof req.body.ativoGlobal === 'boolean'
        ? req.body.ativoGlobal
        : !configAgentes.ativoGlobal;

    configAgentes.ativoGlobal = novoEstado;
    salvarJSON(AGENTES_PATH, configAgentes);
    res.json({ ativoGlobal: configAgentes.ativoGlobal });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao atualizar agentes.json' });
  }
});

app.post('/api/checkout/criar', async (req, res) => {
  if (!INFINITEPAY_HANDLE) {
    return res.status(400).json({
      erro: 'Configure INFINITEPAY_HANDLE no ambiente antes de gerar checkout.'
    });
  }

  const body = req.body || {};
  const { modalidade, selecao, valor, produto, lead, retornoUrl } = body;

  const valorNumerico = Number(valor);
  if (Number.isNaN(valorNumerico) || valorNumerico < VALOR_MINIMO_CHECKOUT) {
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
    concursoId: body.concursoId,
    concursoNumero: body.concursoNumero,
    horarioConcurso: body.horarioConcurso,
    dataCiclo: body.dataCiclo,
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
      concursoId: preparado.venda.concursoId,
      concursoNumero: preparado.venda.concursoNumero,
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
