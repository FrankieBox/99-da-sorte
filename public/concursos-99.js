const HORARIOS_CONCURSOS = [
  '08:10',
  '09:10',
  '10:10',
  '11:10',
  '12:10',
  '13:10',
  '14:10',
  '15:10',
  '16:10',
  '17:10',
  '18:10',
  '19:10',
  '19:45',
  '20:50',
  '21:10'
];

const DEZENAS_100 = [
  ...Array.from({ length: 99 }, (_, i) => String(i + 1).padStart(2, '0')),
  '00'
];

const CONCURSOS = HORARIOS_CONCURSOS.map((horario, idx) => ({
  id: `C-${String(idx + 1).padStart(2, '0')}`,
  numero: String(idx + 1).padStart(2, '0'),
  horario,
  tipo: idx >= 12 ? 'SESSÃO ESPECIAL' : 'GRADE HORÁRIA',
  valorBilhete: 2.5,
  modalidade: 'DZ'
}));

const gridConcursosEl = document.getElementById('grid-concursos');
const relogioAtualEl = document.getElementById('relogio-atual');
const qrPaginaEl = document.getElementById('qr-pagina');

const modalEl = document.getElementById('modal-concurso');
const btnFecharModalEl = document.getElementById('btn-fechar-modal');
const modalCodigoEl = document.getElementById('modal-codigo');
const modalTituloEl = document.getElementById('modal-titulo');
const modalCronometroEl = document.getElementById('modal-cronometro');
const modalDezenaDisplayEl = document.getElementById('modal-dezena-display');
const btnModalSurpresinhaEl = document.getElementById('btn-modal-surpresinha');
const modalGradeDzEl = document.getElementById('modal-grade-dz');
const formConcursoIndividualEl = document.getElementById('form-concurso-individual');
const modalNomeEl = document.getElementById('modal-nome');
const modalWhatsappEl = document.getElementById('modal-whatsapp');
const modalFeedbackEl = document.getElementById('modal-feedback');

let concursoAtivo = null;
let dezenaSelecionada = '';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatarDuracao(ms) {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function calcularProximoAlvo(horarioStr, agora) {
  const [hh, mm] = horarioStr.split(':').map(Number);
  const alvoHoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
    hh,
    mm,
    0,
    0
  );

  if (alvoHoje.getTime() > agora.getTime()) {
    return {
      alvo: alvoHoje,
      restanteMs: alvoHoje.getTime() - agora.getTime(),
      hoje: true
    };
  }

  const alvoAmanha = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate() + 1,
    hh,
    mm,
    0,
    0
  );

  return {
    alvo: alvoAmanha,
    restanteMs: alvoAmanha.getTime() - agora.getTime(),
    hoje: false
  };
}

function construirCards() {
  gridConcursosEl.innerHTML = CONCURSOS.map(c => {
    return `
      <article class="concurso-card" id="card-${c.id}" data-concurso-id="${c.id}">
        <div class="card-top-row">
          <span class="card-num">#${c.numero} • ${c.tipo === 'SESSÃO ESPECIAL' ? 'EXTRA' : 'HORA'}</span>
          <span class="card-status aberto" id="status-${c.id}">HOJE</span>
        </div>
        <div class="card-hora">${c.horario}</div>
        <div class="card-timer-box">
          <span id="label-timer-${c.id}">FECHA EM</span>
          <strong id="timer-${c.id}">--:--:--</strong>
        </div>
        <div class="card-cta-line">
          <span>DEZENA • R$ 2,50</span>
          <span>ENTRAR ➔</span>
        </div>
      </article>
    `;
  }).join('');

  gridConcursosEl.querySelectorAll('.concurso-card').forEach(card => {
    card.addEventListener('click', () => {
      const c = CONCURSOS.find(item => item.id === card.dataset.concursoId);
      if (c) abrirModalConcurso(c);
    });
  });
}

function atualizarCronometros() {
  const agora = new Date();
  relogioAtualEl.textContent = agora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  let menorRestanteHoje = Infinity;
  let idProximoHoje = null;

  const estados = CONCURSOS.map(c => {
    const info = calcularProximoAlvo(c.horario, agora);
    if (info.hoje && info.restanteMs < menorRestanteHoje) {
      menorRestanteHoje = info.restanteMs;
      idProximoHoje = c.id;
    }
    return { concurso: c, info };
  });

  estados.forEach(({ concurso, info }) => {
    const cardEl = document.getElementById(`card-${concurso.id}`);
    const timerEl = document.getElementById(`timer-${concurso.id}`);
    const labelEl = document.getElementById(`label-timer-${concurso.id}`);
    const statusEl = document.getElementById(`status-${concurso.id}`);
    if (!cardEl || !timerEl || !labelEl || !statusEl) return;

    timerEl.textContent = formatarDuracao(info.restanteMs);

    const ehProximo = concurso.id === idProximoHoje;
    cardEl.classList.toggle('proximo', ehProximo);
    cardEl.classList.toggle('encerrado-hoje', !info.hoje);

    if (ehProximo) {
      statusEl.textContent = 'PRÓXIMO';
      statusEl.className = 'card-status proximo-tag';
      labelEl.textContent = 'FECHA EM';
    } else if (info.hoje) {
      statusEl.textContent = 'HOJE';
      statusEl.className = 'card-status aberto';
      labelEl.textContent = 'FECHA EM';
    } else {
      statusEl.textContent = 'AMANHÃ';
      statusEl.className = 'card-status amanha';
      labelEl.textContent = 'PRÓXIMO CICLO';
    }

    if (concursoAtivo && concursoAtivo.id === concurso.id) {
      modalCronometroEl.textContent = formatarDuracao(info.restanteMs);
    }
  });
}

function montarGradeModal() {
  modalGradeDzEl.innerHTML = DEZENAS_100.map(
    dz => `<button type="button" class="cyber-dz-btn" data-dz="${dz}">${dz}</button>`
  ).join('');

  modalGradeDzEl.addEventListener('click', e => {
    const btn = e.target.closest('.cyber-dz-btn');
    if (!btn) return;
    selecionarDezena(btn.dataset.dz);
  });
}

function selecionarDezena(dz) {
  dezenaSelecionada = dz;
  modalDezenaDisplayEl.textContent = dz || '--';
  modalGradeDzEl.querySelectorAll('.cyber-dz-btn').forEach(btn => {
    btn.classList.toggle('selecionada', btn.dataset.dz === dz);
  });
}

function abrirModalConcurso(concurso) {
  concursoAtivo = concurso;
  dezenaSelecionada = '';
  modalCodigoEl.textContent = `CONCURSO #${concurso.numero} • ${concurso.tipo}`;
  modalTituloEl.textContent = `SORTEIO ${concurso.horario}`;
  modalFeedbackEl.textContent = '';
  modalFeedbackEl.className = 'modal-feedback';
  selecionarDezena('');
  atualizarCronometros();
  modalEl.classList.remove('oculto');
}

function fecharModalConcurso() {
  concursoAtivo = null;
  modalEl.classList.add('oculto');
}

btnFecharModalEl.addEventListener('click', fecharModalConcurso);
modalEl.addEventListener('click', e => {
  if (e.target === modalEl) fecharModalConcurso();
});

btnModalSurpresinhaEl.addEventListener('click', () => {
  const sorteada = DEZENAS_100[Math.floor(Math.random() * DEZENAS_100.length)];
  selecionarDezena(sorteada);
  modalFeedbackEl.className = 'modal-feedback';
  modalFeedbackEl.textContent = `Dezena sugerida: ${sorteada}`;
});

formConcursoIndividualEl.addEventListener('submit', async e => {
  e.preventDefault();
  if (!concursoAtivo) return;

  if (!dezenaSelecionada) {
    modalFeedbackEl.className = 'modal-feedback erro';
    modalFeedbackEl.textContent = 'Escolha uma dezena (01 a 00) antes de continuar.';
    return;
  }

  modalFeedbackEl.className = 'modal-feedback';
  modalFeedbackEl.textContent = 'Conectando ao checkout...';

  const res = await fetch('/api/checkout/criar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      produto: `Concurso ${concursoAtivo.horario} (#${concursoAtivo.numero})`,
      modalidade: 'DZ',
      selecao: dezenaSelecionada,
      valor: concursoAtivo.valorBilhete,
      lead: {
        nome: modalNomeEl.value.trim(),
        contato: modalWhatsappEl.value.trim()
      }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    modalFeedbackEl.className = 'modal-feedback erro';
    modalFeedbackEl.textContent =
      data.erro ||
      `Bilhete Dezena ${dezenaSelecionada} (Concurso ${concursoAtivo.horario}) registrado em modo pré-checkout enquanto o banco é finalizado.`;
    return;
  }

  window.location.href = data.checkout_url;
});

function configurarQrPagina() {
  const urlAtual = encodeURIComponent(window.location.href);
  qrPaginaEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${urlAtual}`;
}

construirCards();
montarGradeModal();
configurarQrPagina();
atualizarCronometros();
setInterval(atualizarCronometros, 1000);
