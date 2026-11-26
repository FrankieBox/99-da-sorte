let estadoApp = {
  concursos: [],
  atividadeRecente: [],
  agentesConfig: {
    ativoGlobal: true,
    intervaloMinSegundos: 8,
    intervaloMaxSegundos: 16,
    agentes: []
  }
};

let concursoSelecionado = null;
let dezenaSelecionada = null;
let intervaloCronometro = null;
let timerBalao = null;
let indiceBalao = 0;

document.addEventListener('DOMContentLoaded', () => {
  gerarGridDezenas();
  configurarQrCodeRodape();
  carregarEstadoServidor();
  configurarEventos();

  setInterval(carregarEstadoServidor, 15000);
  agendarProximoBalao();
});

function configurarQrCodeRodape() {
  const urlAtual = window.location.origin;
  const imgQr = document.getElementById('qr-convite-amigos');
  if (imgQr) {
    imgQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlAtual)}`;
  }
}

async function carregarEstadoServidor() {
  try {
    const resp = await fetch('/api/estado');
    const dados = await resp.json();
    estadoApp = {
      ...estadoApp,
      ...dados
    };
    renderizarGradeConcursos();
    rotacionarBalaoAgente();

    if (concursoSelecionado) {
      const atualizado = estadoApp.concursos.find(c => c.id === concursoSelecionado.id);
      if (atualizado) {
        concursoSelecionado = atualizado;
        atualizarTextoResultadoModal(atualizado);
      }
    }
  } catch (err) {
    console.error('Erro ao sincronizar estado:', err);
  }
}

function renderizarGradeConcursos() {
  const container = document.getElementById('lista-concursos');
  if (!container) return;

  container.innerHTML = estadoApp.concursos.map(c => {
    const temResultado = Boolean(c.resultado);
    const textoResultado = temResultado
      ? `DEZENA: ${c.resultado}`
      : 'Aguardando apuração';

    return `
      <div class="concurso-card" onclick="abrirModalConcurso('${c.id}')">
        <div class="card-top">
          <span>CONCURSO #${c.numero}</span>
          <span>R$ ${Number(c.valor).toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="card-hora">${c.horario}</div>
        <div class="card-premio">Prêmio: <strong>${c.premio}</strong></div>
        <div class="card-resultado ${temResultado ? 'apurado' : ''}">
          ${textoResultado}
        </div>
        <div class="card-btn">ESCOLHER DEZENA ➔</div>
      </div>
    `;
  }).join('');
}

function gerarGridDezenas() {
  const grid = document.getElementById('grid-dezenas');
  if (!grid) return;

  let html = '';
  for (let i = 1; i <= 100; i++) {
    const dz = i === 100 ? '00' : String(i).padStart(2, '0');
    html += `<button type="button" class="dz-btn" data-dz="${dz}" onclick="selecionarDezena('${dz}')">${dz}</button>`;
  }
  grid.innerHTML = html;
}

window.selecionarDezena = function (dz) {
  dezenaSelecionada = dz;
  document.getElementById('display-dezena-escolhida').textContent = `(01-00) ${dz}`;

  document.querySelectorAll('.dz-btn').forEach(btn => {
    btn.classList.toggle('selecionada', btn.dataset.dz === dz);
  });
};

window.abrirModalConcurso = function (concursoId) {
  const concurso = estadoApp.concursos.find(c => c.id === concursoId);
  if (!concurso) return;

  concursoSelecionado = concurso;
  dezenaSelecionada = null;
  document.getElementById('display-dezena-escolhida').textContent = '(01-00) --';
  document.querySelectorAll('.dz-btn').forEach(b => b.classList.remove('selecionada'));

  document.getElementById('modal-concurso-tag').textContent = `CONCURSO #${concurso.numero} • GRADE HORÁRIA`;
  document.getElementById('modal-horario').textContent = concurso.horario;
  atualizarTextoResultadoModal(concurso);
  rotacionarBalaoAgente();

  iniciarCronometro(concurso.horario);
  document.getElementById('modal-sorteio').classList.remove('hidden');
};

function atualizarTextoResultadoModal(concurso) {
  const el = document.getElementById('modal-ultimo-resultado');
  if (concurso.resultado) {
    el.innerHTML = `<span class="neon-green">DEZENA SORTEADA: ${concurso.resultado}</span>`;
  } else {
    el.textContent = 'Aguardando apuração';
  }
}

function iniciarCronometro(horarioStr) {
  if (intervaloCronometro) clearInterval(intervaloCronometro);

  function atualizar() {
    const agora = new Date();
    const [hh, mm] = horarioStr.split(':').map(Number);
    const alvo = new Date();
    alvo.setHours(hh, mm, 0, 0);

    if (alvo <= agora) {
      alvo.setDate(alvo.getDate() + 1);
    }

    const diff = Math.max(0, alvo - agora);
    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');

    document.getElementById('modal-cronometro').textContent = `${h}:${m}:${s}`;
  }

  atualizar();
  intervaloCronometro = setInterval(atualizar, 1000);
}

function montarListaBaloes() {
  if (estadoApp.atividadeRecente && estadoApp.atividadeRecente.length > 0) {
    return estadoApp.atividadeRecente.map(a => ({
      nome: `${a.nome} (${a.bairro})`,
      horario: a.horario,
      dezena: a.dezena
    }));
  }

  const cfg = estadoApp.agentesConfig || {};
  if (cfg.ativoGlobal === false) return [];

  const ativos = Array.isArray(cfg.agentes)
    ? cfg.agentes.filter(ag => ag.ativo !== false)
    : [];

  const horarios = estadoApp.concursos.length > 0
    ? estadoApp.concursos.map(c => c.horario)
    : ['08:10', '10:10', '14:10', '18:10'];

  return ativos.map((ag, idx) => {
    const prefs = Array.isArray(ag.dezenasPreferidas) && ag.dezenasPreferidas.length > 0
      ? ag.dezenasPreferidas
      : ['00'];
    const dz = prefs[idx % prefs.length];
    const horario = (concursoSelecionado && concursoSelecionado.horario) || horarios[idx % horarios.length];
    return {
      nome: `${ag.nome} (${ag.regiao})`,
      horario,
      dezena: dz
    };
  });
}

function rotacionarBalaoAgente() {
  const slot = document.getElementById('slot-agentes-futuro');
  const lista = montarListaBaloes();

  if (!lista || lista.length === 0) {
    if (slot) slot.classList.add('hidden');
    return;
  }

  if (slot) slot.classList.remove('hidden');
  const item = lista[indiceBalao % lista.length];
  indiceBalao++;

  const elNome = document.getElementById('wa-nome');
  const elAcao = document.getElementById('wa-acao');
  const elDz = document.getElementById('wa-dezena');

  if (elNome && elAcao && elDz) {
    elNome.textContent = item.nome;
    elAcao.textContent = `reservou no sorteio das ${item.horario}`;
    elDz.textContent = `DZ ${item.dezena}`;
  }
}

function agendarProximoBalao() {
  if (timerBalao) clearTimeout(timerBalao);
  const cfg = estadoApp.agentesConfig || {};
  const minSeg = Number(cfg.intervaloMinSegundos) > 0 ? Number(cfg.intervaloMinSegundos) : 8;
  const maxSeg = Number(cfg.intervaloMaxSegundos) >= minSeg ? Number(cfg.intervaloMaxSegundos) : 16;
  const delayMs = (Math.floor(Math.random() * (maxSeg - minSeg + 1)) + minSeg) * 1000;

  timerBalao = setTimeout(() => {
    rotacionarBalaoAgente();
    agendarProximoBalao();
  }, delayMs);
}

function configurarEventos() {
  document.getElementById('btn-surpresinha').addEventListener('click', () => {
    const num = Math.floor(Math.random() * 100) + 1;
    const dz = num === 100 ? '00' : String(num).padStart(2, '0');
    selecionarDezena(dz);
  });

  document.getElementById('btn-fechar-modal').addEventListener('click', () => {
    document.getElementById('modal-sorteio').classList.add('hidden');
  });

  document.getElementById('btn-fechar-pix').addEventListener('click', () => {
    document.getElementById('modal-pix').classList.add('hidden');
  });

  document.getElementById('btn-concluir-reserva').addEventListener('click', () => {
    document.getElementById('modal-pix').classList.add('hidden');
  });

  document.getElementById('form-reserva').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!dezenaSelecionada) {
      alert('Escolha uma dezena (01 a 00) ou clique em SURPRESINHA.');
      return;
    }

    const nome = document.getElementById('input-nome').value;
    const telefone = document.getElementById('input-telefone').value;

    try {
      const resp = await fetch('/api/reservar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concursoId: concursoSelecionado.id,
          dezena: dezenaSelecionada,
          nome,
          telefone
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        alert(data.erro || 'Erro ao reservar bilhete.');
        return;
      }

      document.getElementById('modal-sorteio').classList.add('hidden');
      exibirModalPixProvisorio(data.bilhete);
      carregarEstadoServidor();
    } catch (err) {
      alert('Falha de conexão com o servidor.');
    }
  });

  document.getElementById('btn-copiar-pix').addEventListener('click', () => {
    const input = document.getElementById('input-pix-copia-cola');
    input.select();
    navigator.clipboard.writeText(input.value);
    alert('Código Pix Provisório copiado!');
  });

  document.getElementById('btn-buscar-id').addEventListener('click', consultarBilhetePorId);
  document.getElementById('btn-abrir-consulta').addEventListener('click', () => {
    document.getElementById('secao-consulta').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('input-busca-id').focus();
  });

  document.getElementById('btn-copiar-link').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.origin);
    alert('Link do 99 da Sorte copiado para enviar aos amigos!');
  });
}

function exibirModalPixProvisorio(bilhete) {
  document.getElementById('pix-bilhete-id').textContent = bilhete.id;
  document.getElementById('pix-info-concurso').textContent =
    `Sorteio ${bilhete.horario} • Dezena ${bilhete.dezena}`;
  document.getElementById('input-pix-copia-cola').value = bilhete.pixCopiaCola;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(bilhete.pixCopiaCola)}`;
  document.getElementById('img-qr-provisorio').src = qrUrl;

  document.getElementById('input-busca-id').value = bilhete.id;
  document.getElementById('modal-pix').classList.remove('hidden');
}

async function consultarBilhetePorId() {
  const id = document.getElementById('input-busca-id').value.trim().toUpperCase();
  const box = document.getElementById('resultado-consulta');

  if (!id) {
    alert('Digite o ID do bilhete (ex: 99S-XXXXXX).');
    return;
  }

  try {
    const resp = await fetch(`/api/bilhete/${encodeURIComponent(id)}`);
    const data = await resp.json();

    box.classList.remove('hidden');
    if (!resp.ok) {
      box.innerHTML = `<span style="color:#f87171;">${data.erro}</span>`;
      return;
    }

    const b = data.bilhete;
    const statusPgto = b.statusPagamento === 'PAGO_CONFIRMADO'
      ? '<span style="color:#b4ff00;">PAGO / CONFIRMADO</span>'
      : '<span style="color:#facc15;">QR CODE PROVISÓRIO GERADO</span>';

    let statusResultado = 'Aguardando sorteio do horário';
    if (b.statusSorteio === 'PREMIADO') {
      statusResultado = '<strong style="color:#b4ff00;">🏆 BILHETE PREMIADO!</strong>';
    } else if (b.statusSorteio === 'NAO_PREMIADO') {
      statusResultado = `Não premiado (Dezena sorteada: ${data.resultadoConcurso})`;
    }

    box.innerHTML = `
      <div><strong>ID:</strong> ${b.id} | <strong>Apostador:</strong> ${b.nome}</div>
      <div><strong>Sorteio:</strong> ${b.horario} | <strong>Dezena:</strong> <span class="neon-green">${b.dezena}</span></div>
      <div><strong>Pagamento:</strong> ${statusPgto}</div>
      <div><strong>Status:</strong> ${statusResultado}</div>
    `;
  } catch (err) {
    box.classList.remove('hidden');
    box.innerHTML = '<span style="color:#f87171;">Erro ao consultar bilhete.</span>';
  }
}
