const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const CATALOGO_PATH = path.join(DATA_DIR, 'catalogo.json');
const VENDAS_PATH = path.join(DATA_DIR, 'vendas.json');

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
      valorMinimo: 0.01,
      cotacoes: COTACOES
    },
    produtos
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
    const totalArrecadado = vendas.reduce((acc, v) => acc + v.valor, 0);
    const retornoPotencialTotal = vendas.reduce((acc, v) => acc + (v.retornoPotencial || 0), 0);
    res.json({
      totalRegistros: vendas.length,
      totalArrecadado: Number(totalArrecadado.toFixed(2)),
      retornoPotencialTotal: Number(retornoPotencialTotal.toFixed(2)),
      vendas
    });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao ler vendas.json' });
  }
});

app.post('/api/vendas', (req, res) => {
  const { modalidade, selecao, valor, origem } = req.body;

  const cfg = COTACOES[modalidade];
  if (!cfg) {
    return res.status(400).json({ erro: 'Modalidade inválida.' });
  }

  const valorNumerico = Number(valor);
  if (isNaN(valorNumerico) || valorNumerico < 0.01) {
    return res.status(400).json({ erro: 'O valor da venda deve ser maior ou igual a 0,01.' });
  }

  const listaBruta = Array.isArray(selecao) ? selecao : [selecao];
  if (listaBruta.length !== cfg.qtd) {
    return res.status(400).json({
      erro: `${cfg.nome} (${cfg.codigo}) exige exatamente ${cfg.qtd} ${cfg.tipo}(s).`
    });
  }

  const validados = [];
  for (const raw of listaBruta) {
    const resItem = validarItem(raw, cfg.tipo);
    if (resItem.erro) {
      return res.status(400).json({ erro: resItem.erro });
    }
    validados.push(resItem);
  }

  const selecaoFinal = cfg.qtd === 1 ? validados[0].valor : validados.map(v => v.valor);
  const ordenados = [...validados].sort((a, b) => a.ordem - b.ordem).map(v => v.valor);
  const chaveNormalizada = `${cfg.codigo}-${ordenados.join('-')}`;

  const valorFormatado = Number(valorNumerico.toFixed(2));
  const retornoPotencial = Number((valorFormatado * cfg.multiplicador).toFixed(2));
  const origemLimpa = origem === 'landing' ? 'landing' : 'presencial';

  const novaVenda = {
    id: `VND-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    dataHora: new Date().toISOString(),
    origem: origemLimpa,
    modalidade: cfg.codigo,
    nomeModalidade: cfg.nome,
    multiplicador: cfg.multiplicador,
    selecao: selecaoFinal,
    chaveNormalizada,
    valor: valorFormatado,
    retornoPotencial
  };

  const vendas = lerJSON(VENDAS_PATH);
  vendas.unshift(novaVenda);
  salvarJSON(VENDAS_PATH, vendas);

  res.status(201).json(novaVenda);
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

app.listen(PORT, () => {
  console.log(`99 da sorte rodando em http://localhost:${PORT}`);
});
