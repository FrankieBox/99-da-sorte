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
    regras: {
      estoqueIlimitado: true,
      valorMinimo: 0.01,
      modalidades: ['grupo', 'dezena', 'terno_dezena']
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
    res.json({
      totalRegistros: vendas.length,
      totalArrecadado: Number(totalArrecadado.toFixed(2)),
      vendas
    });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao ler vendas.json' });
  }
});

app.post('/api/vendas', (req, res) => {
  const { modalidade, selecao, valor } = req.body;

  const valorNumerico = Number(valor);
  if (isNaN(valorNumerico) || valorNumerico < 0.01) {
    return res.status(400).json({ erro: 'O valor da venda deve ser maior ou igual a 0,01.' });
  }

  const valorFormatado = Number(valorNumerico.toFixed(2));
  let selecaoFinal = null;
  let chaveNormalizada = '';

  if (modalidade === 'grupo') {
    const g = String(selecao || '').trim().padStart(2, '0');
    if (!GRUPOS_VALIDOS.has(g)) {
      return res.status(400).json({ erro: 'Grupo inválido. Escolha entre 01 e 25.' });
    }
    selecaoFinal = g;
    chaveNormalizada = `G-${g}`;
  } else if (modalidade === 'dezena') {
    const d = String(selecao || '').trim().padStart(2, '0');
    if (!DEZENAS_VALIDAS.has(d)) {
      return res.status(400).json({ erro: 'Dezena inválida. Escolha entre 01 e 99, ou 00.' });
    }
    selecaoFinal = d;
    chaveNormalizada = `D-${d}`;
  } else if (modalidade === 'terno_dezena') {
    if (!Array.isArray(selecao) || selecao.length !== 3) {
      return res.status(400).json({ erro: 'O terno de dezena exige exatamente 3 dezenas.' });
    }
    const dezenasNormalizadas = selecao.map(item => String(item || '').trim().padStart(2, '0'));
    for (const d of dezenasNormalizadas) {
      if (!DEZENAS_VALIDAS.has(d)) {
        return res.status(400).json({ erro: `Dezena inválida no terno: "${d}". Use 01 a 99 ou 00.` });
      }
    }
    selecaoFinal = dezenasNormalizadas;
    const ordenadas = [...dezenasNormalizadas].sort((a, b) => {
      const valA = a === '00' ? 100 : Number(a);
      const valB = b === '00' ? 100 : Number(b);
      return valA - valB;
    });
    chaveNormalizada = `T-${ordenadas.join('-')}`;
  } else {
    return res.status(400).json({ erro: 'Modalidade inválida. Use: grupo, dezena ou terno_dezena.' });
  }

  const novaVenda = {
    id: `VND-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    dataHora: new Date().toISOString(),
    modalidade,
    selecao: selecaoFinal,
    chaveNormalizada,
    valor: valorFormatado
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
  console.log(`Servidor a correr em http://localhost:${PORT}`);
});
