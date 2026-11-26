const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Garante que arquivos estáticos na raiz do projeto sejam encontrados
const RAIZ = __dirname;
app.use(express.static(RAIZ));

const DATA_DIR = path.join(RAIZ, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const HORARIOS_PADRAO = [
  { id: '0810', numero: '01', horario: '08:10', premio: 'R$ 150,00', valor: 2.50 },
  { id: '1010', numero: '02', horario: '10:10', premio: 'R$ 150,00', valor: 2.50 },
  { id: '1210', numero: '03', horario: '12:10', premio: 'R$ 200,00', valor: 2.50 },
  { id: '1410', numero: '04', horario: '14:10', premio: 'R$ 200,00', valor: 2.50 },
  { id: '1610', numero: '05', horario: '16:10', premio: 'R$ 250,00', valor: 2.50 },
  { id: '1810', numero: '06', horario: '18:10', premio: 'R$ 300,00', valor: 2.50 },
  { id: '2010', numero: '07', horario: '20:10', premio: 'R$ 400,00', valor: 2.50 },
  { id: '2210', numero: '08', horario: '22:10', premio: 'R$ 500,00', valor: 2.50 }
];

function lerDB() {
  if (!fs.existsSync(DB_FILE)) {
    const inicial = {
      dataReferencia: new Date().toISOString().split('T')[0],
      pixProvisorioChave: 'pagamentos.teste@99dasorte.com.br',
      pixProvisorioRecebedor: '99 DA SORTE TESTE PROVISORIO',
      concursos: HORARIOS_PADRAO.map(h => ({
        ...h,
        resultado: null,
        atualizadoEm: null
      })),
      bilhetes: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    const fallback = {
      dataReferencia: new Date().toISOString().split('T')[0],
      pixProvisorioChave: 'pagamentos.teste@99dasorte.com.br',
      pixProvisorioRecebedor: '99 DA SORTE TESTE PROVISORIO',
      concursos: HORARIOS_PADRAO.map(h => ({
        ...h,
        resultado: null,
        atualizadoEm: null
      })),
      bilhetes: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

function salvarDB(dados) {
  fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2));
}

function gerarIdBilhete() {
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `99S-${random}`;
}

function gerarPayloadPixProvisorio(chave, nome, valor, txid) {
  const valorStr = Number(valor).toFixed(2);
  return `00020126580014BR.GOV.BCB.PIX0136${chave}520400005303986540${valorStr.length}${valorStr}5802BR5925${nome.substring(0, 25)}6009SAO PAULO62140510${txid}6304ABCD`;
}

function enviarHtmlSeguro(res, nomeArquivo) {
  const caminho = path.join(RAIZ, nomeArquivo);
  if (fs.existsSync(caminho)) {
    return res.sendFile(caminho);
  }
  return res.status(404).send(`
    <body style="background:#050a14;color:#fff;font-family:sans-serif;padding:24px;">
      <h2>Arquivo ${nomeArquivo} não encontrado na raiz</h2>
      <p>Verifique se <strong>${nomeArquivo}</strong> está na mesma pasta do <code>server.js</code> no GitHub.</p>
      <p>Arquivos na raiz: ${fs.readdirSync(RAIZ).join(', ')}</p>
    </body>
  `);
}

app.get('/', (req, res) => {
  enviarHtmlSeguro(res, 'concursos-99.html');
});

app.get('/concursos-99.html', (req, res) => {
  enviarHtmlSeguro(res, 'concursos-99.html');
});

app.get('/adm.html', (req, res) => {
  enviarHtmlSeguro(res, 'adm.html');
});

app.get('/api/estado', (req, res) => {
  const db = lerDB();
  const ultimosPublicos = db.bilhetes
    .slice(-15)
    .reverse()
    .map(b => {
      const partes = b.nome.trim().split(' ');
      const nomeCurto = partes.length > 1
        ? `${partes[0]} ${partes[1][0]}.`
        : partes[0];
      return {
        nome: nomeCurto,
        bairro: b.bairro || 'Centro',
        horario: b.horario,
        dezena: b.dezena
      };
    });

  res.json({
    dataReferencia: db.dataReferencia,
    concursos: db.concursos,
    atividadeRecente: ultimosPublicos
  });
});

app.post('/api/reservar', (req, res) => {
  const { concursoId, dezena, nome, telefone, bairro } = req.body;

  if (!concursoId || !dezena || !nome || !telefone) {
    return res.status(400).json({ erro: 'Preencha dezena, nome e telefone.' });
  }

  const db = lerDB();
  const concurso = db.concursos.find(c => c.id === concursoId);

  if (!concurso) {
    return res.status(404).json({ erro: 'Concurso não encontrado.' });
  }

  const id = gerarIdBilhete();
  const pixCopiaCola = gerarPayloadPixProvisorio(
    db.pixProvisorioChave,
    db.pixProvisorioRecebedor,
    concurso.valor,
    id.replace('-', '')
  );

  const novoBilhete = {
    id,
    concursoId: concurso.id,
    numeroConcurso: concurso.numero,
    horario: concurso.horario,
    dezena: String(dezena).padStart(2, '0'),
    nome: nome.trim(),
    telefone: telefone.trim(),
    bairro: (bairro || 'Vila Nova').trim(),
    valor: concurso.valor,
    statusPagamento: 'PENDENTE_QR_PROVISORIO',
    statusSorteio: concurso.resultado
      ? (concurso.resultado === String(dezena).padStart(2, '0') ? 'PREMIADO' : 'NAO_PREMIADO')
      : 'AGUARDANDO_SORTEIO',
    pixCopiaCola,
    criadoEm: new Date().toISOString()
  };

  db.bilhetes.push(novoBilhete);
  salvarDB(db);

  res.status(201).json({
    mensagem: 'Bilhete reservado com QR Code provisório!',
    bilhete: novoBilhete
  });
});

app.get('/api/bilhete/:id', (req, res) => {
  const idBusca = req.params.id.trim().toUpperCase();
  const db = lerDB();
  const bilhete = db.bilhetes.find(b => b.id === idBusca);

  if (!bilhete) {
    return res.status(404).json({ erro: 'Bilhete não encontrado. Verifique o código ID.' });
  }

  const concurso = db.concursos.find(c => c.id === bilhete.concursoId);

  res.json({
    bilhete,
    resultadoConcurso: concurso ? concurso.resultado : null
  });
});

app.get('/api/adm/dados', (req, res) => {
  const senha = req.headers['x-adm-pass'];
  if (senha !== '2310') {
    return res.status(401).json({ erro: 'Senha inválida' });
  }
  const db = lerDB();
  res.json(db);
});

app.post('/api/adm/resultado', (req, res) => {
  const senha = req.headers['x-adm-pass'];
  if (senha !== '2310') {
    return res.status(401).json({ erro: 'Senha inválida' });
  }

  const { concursoId, dezenaSorteada } = req.body;
  const db = lerDB();
  const concurso = db.concursos.find(c => c.id === concursoId);

  if (!concurso) {
    return res.status(404).json({ erro: 'Concurso não encontrado' });
  }

  const dzFormatada = dezenaSorteada ? String(dezenaSorteada).padStart(2, '0') : null;
  concurso.resultado = dzFormatada;
  concurso.atualizadoEm = new Date().toISOString();

  db.bilhetes.forEach(b => {
    if (b.concursoId === concursoId) {
      if (!dzFormatada) {
        b.statusSorteio = 'AGUARDANDO_SORTEIO';
      } else if (b.dezena === dzFormatada) {
        b.statusSorteio = 'PREMIADO';
      } else {
        b.statusSorteio = 'NAO_PREMIADO';
      }
    }
  });

  salvarDB(db);
  res.json({ mensagem: 'Resultado sincronizado com sucesso!', concurso });
});

app.post('/api/adm/confirmar-pagamento', (req, res) => {
  const senha = req.headers['x-adm-pass'];
  if (senha !== '2310') {
    return res.status(401).json({ erro: 'Senha inválida' });
  }

  const { bilheteId } = req.body;
  const db = lerDB();
  const bilhete = db.bilhetes.find(b => b.id === bilheteId);

  if (!bilhete) {
    return res.status(404).json({ erro: 'Bilhete não encontrado' });
  }

  bilhete.statusPagamento = 'PAGO_CONFIRMADO';
  salvarDB(db);
  res.json({ mensagem: 'Pagamento confirmado!', bilhete });
});

app.post('/api/adm/config-pix', (req, res) => {
  const senha = req.headers['x-adm-pass'];
  if (senha !== '2310') {
    return res.status(401).json({ erro: 'Senha inválida' });
  }

  const { chave, recebedor } = req.body;
  const db = lerDB();
  if (chave) db.pixProvisorioChave = chave.trim();
  if (recebedor) db.pixProvisorioRecebedor = recebedor.trim();
  salvarDB(db);

  res.json({ mensagem: 'Configuração Pix provisória atualizada!' });
});

app.listen(PORT, () => {
  console.log(`Servidor 99 da Sorte rodando na porta ${PORT}`);
});
