const HORARIOS_CONCURSOS = [
  '08:10', '09:10', '10:10', '11:10', '12:10', '13:10',
  '14:10', '15:10', '16:10', '17:10', '18:10', '19:10',
  '19:45', '20:50', '21:10'
];

const DEZENAS_100 = [
  ...Array.from({ length: 99 }, (_, i) => String(i + 1).padStart(2, '0')),
  '00'
];

const AGENTES_PADRAO = {
  ativoGlobal: true,
  intervaloMinSegundos: 8,
  intervaloMaxSegundos: 15,
  agentes: [
    { id: 'AGT-01', nome: 'Lucas M.', regiao: 'Zona Sul', dezenasPreferidas: ['27', '07', '77'], ativo: true },
    { id: 'AGT-02', nome: 'Camila R.', regiao: 'Centro', dezenasPreferidas: ['14', '24', '88'], ativo: true },
    { id: 'AGT-03', nome: 'Rafael S.', regiao: 'Zona Leste', dezenasPreferidas: ['03', '33', '69'], ativo: true },
    { id: 'AGT-04', nome: 'Beatriz F.', regiao: 'Zona Norte', dezenasPreferidas: ['19', '45', '00'], ativo: true },
    { id: 'AGT-05', nome: 'Diego T.', regiao: 'Zona Oeste', dezenasPreferidas: ['11', '52', '91'], ativo: true },
    { id: 'AGT-06', nome: 'Aline C.', regiao: 'Centro', dezenasPreferidas: ['08', '22', '64'], ativo: true }
  ]
};

const relogioAtualEl = document.getElementById('relogio-atual');
const carouselViewportEl = document.getElementById('carousel-viewport');
const carouselTrackEl = document.getElementById('carousel-track');
const carouselIndicadorEl = document.getElementById('carousel-indicador');
const btnPrevSlideEl = document.getElementById('btn-prev-slide');
const btnNextSlideEl = document.getElementById('btn-next-slide');
const btnIrProximoEl = document.getElementById('btn-ir-proximo');
const btnHeroProximoEl = document.getElementById('btn-hero-proximo');
const qrPaginaEl = document.getElementById('qr-pagina');

const formConsultaIdEl = document.getElementById('form-consulta-id');
const inputConsultaIdEl = document.getElementById('input-consulta-id');
const resultadoConsultaIdEl = document.getElementById('resultado-consulta-id');

const modalEl = document.getElementById('modal-concurso');
const modalCodigoEl = document.getElementById('modal-codigo');
const modalTituloEl = document.getElementById('modal-titulo');
const btnFecharModalEl = document.getElementById('btn-fechar-modal');
const modalCronometroEl = document.getElementById('modal-cronometro');
const modalUltimoResultadoEl = document.getElementById('modal-ultimo-resultado');
const slotAgentesEl = document.getElementById('slot-agentes-futuro');
const modalDezenaDisplayEl = document.getElementById('modal-dezena-display');
const btnModalSurpresinhaEl = document.getElementById('btn-modal-surpresinha');
const modalGradeDzEl = document.getElementById('modal-grade-dz');
const formConcursoIndividualEl = document.getElementById('form-concurso-individual');
const modalNomeEl = document.getElementById('modal-nome');
const modalWhatsappEl = document.getElementById('modal-whatsapp');
const modalFeedbackEl = document.getElementById('modal-feedback');

const CARD_LARGURA_PASSO = 178;
let concursos = HORARIOS_CONCURSOS.map((horario, idx) => ({
  id: `C-${String(idx + 1).padStart(2, '0')}`,
  numero: String(idx + 1).padStart(2, '0'),
  horario,
  tipo: idx >= 12 ? 'SESSÃO ESPECIAL' : 'GRADE HORÁRIA',
  valorBilhete: 2.5,
  premio: 50.0,
  ativo: true
}));

let concursoAtivo = null;
let dezenaSelecionada = '';
let indiceFocoCarousel = 0;
let posicaoInicialAjustada = false;

let configAgentes = { ...AGENTES_PADRAO };
let timerAgenteId = null;
let ultimoAgenteId = '';
let ultimaDezenaAgente = '';
let ultimosResultadosPorHorario = {};

function formatarDoisDigitos(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function formatarDuracao(ms) {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const horas = Math.floor(totalSeg / 3600);
  const minutos = Math.floor((totalSeg % 3600) / 60);
  const segundos = totalSeg % 60;
  return `${formatarDoisDigitos(horas)}:${formatarDoisDigitos(minutos)}:${formatarDoisDigitos(segundos)}`;
}

function obterDataCicloHoje(agora = new Date()) {
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calcularProximoSorteio(horarioStr, agora = new Date()) {
  const partes = String(horarioStr || '').split(':').map(Number);
  const hh = partes[0] || 0;
  const mm = partes[1] || 0;

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
      encerradoHoje: false
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
    encerradoHoje: true
  };
}

function encontrarIndiceProximoConcurso(agora = new Date()) {
  let melhorIdx = 0;
  let menorRestante = Infinity;

  concursos.forEach((c, idx) => {
    const info = calcularProximoSorteio(c.horario, agora);
    if (!info.encerradoHoje && info.restanteMs < menorRestante) {
      menorRestante = info.restanteMs;
      melhorIdx = idx;
    }
  });

  return melhorIdx;
}

function rolarParaIndice(idx, smooth = true) {
  if (!carouselViewportEl || concursos.length === 0) return;
  const limitado = Math.max(0, Math.min(concursos.length - 1, idx));
  indiceFocoCarousel = limitado;

  carouselViewportEl.scrollTo({
    left: limitado * CARD_LARGURA_PASSO,
    behavior: smooth ? 'smooth' : 'auto'
  });

  if (carouselIndicadorEl) {
    const atual = concursos[limitado];
    carouselIndicadorEl.textContent =
      `Concurso #${atual.numero} (${atual.horario}) • ${limitado + 1} de ${concursos.length}`;
  }
}

function construirCarrossel() {
  if (!carouselTrackEl) return;

  carouselTrackEl.innerHTML = concursos
    .map((c, idx) => `
      <article class="concurso-card" data-idx="${idx}" id="card-concurso-${c.numero}">
        <div class="card-top-row">
          <span class="card-num">#${c.numero} • ${c.tipo === 'SESSÃO ESPECIAL' ? 'ESPECIAL' : 'GRADE'}</span>
          <span class="card-status aberto" data-role="status">ABERTO</span>
        </div>
        <div class="card-hora">${c.horario}</div>
        <div class="card-timer-box">
          <span data-role="timer-label">FECHA EM</span>
          <strong data-role="timer-val">--:--:--</strong>
        </div>
        <div class="card-cta-line">
          <span>R$ 2,50 • PRÊMIO R$ 50</span>
          <span>➔</span>
        </div>
      </article>
    `)
    .join('');

  carouselTrackEl.querySelectorAll('.concurso-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = Number(card.dataset.idx);
      const concurso = concursos[idx];
      if (concurso) abrirModalConcurso(concurso);
    });
  });

  if (!posicaoInicialAjustada) {
    posicaoInicialAjustada = true;
    const idxProximo = encontrarIndiceProximoConcurso(new Date());
    rolarParaIndice(idxProximo, false);
  }
}

function atualizarCronometros() {
  const agora = new Date();

  if (relogioAtualEl) {
    relogioAtualEl.textContent = agora.toLocaleTimeString('pt-BR', { hour12: false });
  }

  const idxProximo = encontrarIndiceProximoConcurso(agora);

  concursos.forEach((c, idx) => {
    const info = calcularProximoSorteio(c.horario, agora);
    const card = document.getElementById(`card-concurso-${c.numero}`);
    if (!card) return;

    const statusEl = card.querySelector('[data-role="status"]');
    const labelEl = card.querySelector('[data-role="timer-label"]');
    const timerEl = card.querySelector('[data-role="timer-val"]');

    card.classList.remove('proximo', 'encerrado-hoje');

    if (info.encerradoHoje) {
      card.classList.add('encerrado-hoje');
      if (statusEl) {
        statusEl.textContent = 'AMANHÃ';
        statusEl.className = 'card-status amanha';
      }
      if (labelEl) labelEl.textContent = 'PRÓXIMO CICLO';
    } else if (idx === idxProximo) {
      card.classList.add('proximo');
      if (statusEl) {
        statusEl.textContent = 'PRÓXIMO';
        statusEl.className = 'card-status proximo-tag';
      }
      if (labelEl) labelEl.textContent = 'FECHA EM';
    } else {
      if (statusEl) {
        statusEl.textContent = 'ABERTO';
        statusEl.className = 'card-status aberto';
      }
      if (labelEl) labelEl.textContent = 'FECHA EM';
    }

    if (timerEl) {
      timerEl.textContent = formatarDuracao(info.restanteMs);
    }
  });

  if (concursoAtivo && modalCronometroEl) {
    const infoAtivo = calcularProximoSorteio(concursoAtivo.horario, agora);
    modalCronometroEl.textContent = formatarDuracao(infoAtivo.restanteMs);
  }
}

async function carregarConcursosAtivosServidor() {
  try {
    const res = await fetch('/api/concursos/ativos', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.concursos) && data.concursos.length > 0) {
      concursos = data.concursos;
      posicaoInicialAjustada = false;
      construirCarrossel();
      atualizarCronometros();
    }
  } catch (_) {
    // Mantém lista local em modo offline/preview
  }
}

async function carregarUltimosResultados() {
  try {
    const hoje = obterDataCicloHoje(new Date());
    const res = await fetch(`/api/resultados?data=${encodeURIComponent(hoje)}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.ultimoPorHorario && typeof data.ultimoPorHorario === 'object') {
      ultimosResultadosPorHorario = data.ultimoPorHorario;
    }
  } catch (_) {}
}

function atualizarTextoResultadoModal(horario) {
  if (!modalUltimoResultadoEl) return;
  const item = ultimosResultadosPorHorario[horario];
  if (item && item.dezena) {
    modalUltimoResultadoEl.textContent = `DZ ${item.dezena} • Grupo ${item.grupo || '--'}`;
  } else {
    modalUltimoResultadoEl.textContent = 'Aguardando apuração';
  }
}

function montarGradeModal() {
  if (!modalGradeDzEl) return;
  modalGradeDzEl.innerHTML = DEZENAS_100
    .map(dz => `<button type="button" class="cyber-dz-btn" data-dz="${dz}">${dz}</button>`)
    .join('');

  modalGradeDzEl.addEventListener('click', e => {
    const btn = e.target.closest('.cyber-dz-btn');
    if (!btn) return;
    selecionarDezena(btn.dataset.dz);
  });
}

function selecionarDezena(dz) {
  dezenaSelecionada = dz || '';
  if (modalDezenaDisplayEl) {
    modalDezenaDisplayEl.textContent = dezenaSelecionada || '--';
  }
  if (!modalGradeDzEl) return;
  modalGradeDzEl.querySelectorAll('.cyber-dz-btn').forEach(btn => {
    btn.classList.toggle('selecionada', btn.dataset.dz === dezenaSelecionada);
  });
}

async function carregarConfigAgentes() {
  try {
    const res = await fetch('/api/agentes', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data && Array.isArray(data.agentes) && data.agentes.length > 0) {
      configAgentes = {
        ativoGlobal: data.ativoGlobal !== false,
        intervaloMinSegundos: Number(data.intervaloMinSegundos) || 8,
        intervaloMaxSegundos: Number(data.intervaloMaxSegundos) || 15,
        agentes: data.agentes
      };
    }
  } catch (_) {
    configAgentes = { ...AGENTES_PADRAO };
  }
}

function pararAgentesModal() {
  if (timerAgenteId) {
    clearTimeout(timerAgenteId);
    timerAgenteId = null;
  }
  if (slotAgentesEl) {
    slotAgentesEl.innerHTML = '';
  }
}

function escolherAgenteEDezena() {
  const ativos = (configAgentes.agentes || []).filter(a => a && a.ativo !== false);
  if (ativos.length === 0) return null;

  const candidatos = ativos.length > 1 ? ativos.filter(a => a.id !== ultimoAgenteId) : ativos;
  const agente = candidatos[Math.floor(Math.random() * candidatos.length)];

  const prefs = Array.isArray(agente.dezenasPreferidas) && agente.dezenasPreferidas.length > 0
    ? agente.dezenasPreferidas
    : DEZENAS_100;

  let dz = prefs[Math.floor(Math.random() * prefs.length)];
  if (dz === ultimaDezenaAgente) {
    dz = DEZENAS_100[Math.floor(Math.random() * DEZENAS_100.length)];
  }

  ultimoAgenteId = agente.id;
  ultimaDezenaAgente = dz;
  return { agente, dz };
}

function exibirBalaoAgente(concurso) {
  if (!slotAgentesEl || !concursoAtivo || configAgentes.ativoGlobal === false) return;
  const sorteio = escolherAgenteEDezena();
  if (!sorteio) return;

  const { agente, dz } = sorteio;
  slotAgentesEl.innerHTML = `
    <div class="agente-balao">
      <div class="agente-balao-info">
        <strong>${agente.nome}</strong> garantiu um bilhete no <strong>${concurso.horario}</strong>
        <span class="agente-balao-regiao">${agente.regiao || '99 da sorte'} • Agora</span>
      </div>
      <span class="agente-balao-dz">DZ ${dz}</span>
    </div>
  `;
}

function agendarProximoBalaoAgente(concurso) {
  if (!concursoAtivo || configAgentes.ativoGlobal === false) return;
  const minMs = Math.max(4, Number(configAgentes.intervaloMinSegundos) || 8) * 1000;
  const maxMs = Math.max(minMs + 2000, (Number(configAgentes.intervaloMaxSegundos) || 15) * 1000);
  const espera = Math.floor(minMs + Math.random() * (maxMs - minMs));

  timerAgenteId = setTimeout(() => {
    if (!concursoAtivo) return;
    exibirBalaoAgente(concurso);
    agendarProximoBalaoAgente(concurso);
  }, espera);
}

function iniciarAgentesModal(concurso) {
  pararAgentesModal();
  if (configAgentes.ativoGlobal === false) return;
  exibirBalaoAgente(concurso);
  agendarProximoBalaoAgente(concurso);
}

function abrirModalConcurso(concurso) {
  concursoAtivo = concurso;
  dezenaSelecionada = '';

  if (modalCodigoEl) modalCodigoEl.textContent = `CONCURSO #${concurso.numero} • ${concurso.tipo}`;
  if (modalTituloEl) modalTituloEl.textContent = `SORTEIO ${concurso.horario}`;
  if (modalFeedbackEl) {
    modalFeedbackEl.textContent = '';
    modalFeedbackEl.className = 'modal-feedback';
  }

  selecionarDezena('');
  atualizarCronometros();
  atualizarTextoResultadoModal(concurso.horario);

  if (modalEl) {
    modalEl.classList.remove('oculto');
  }

  iniciarAgentesModal(concurso);
}

function fecharModalConcurso() {
  pararAgentesModal();
  concursoAtivo = null;
  if (modalEl) {
    modalEl.classList.add('oculto');
  }
}

if (btnFecharModalEl) {
  btnFecharModalEl.addEventListener('click', fecharModalConcurso);
}

if (modalEl) {
  modalEl.addEventListener('click', e => {
    if (e.target === modalEl) fecharModalConcurso();
  });
}

if (btnModalSurpresinhaEl) {
  btnModalSurpresinhaEl.addEventListener('click', () => {
    const sorteada = DEZENAS_100[Math.floor(Math.random() * DEZENAS_100.length)];
    selecionarDezena(sorteada);
    if (modalFeedbackEl) {
      modalFeedbackEl.className = 'modal-feedback';
      modalFeedbackEl.textContent = `Dezena sugerida: ${sorteada}`;
    }
  });
}

if (formConcursoIndividualEl) {
  formConcursoIndividualEl.addEventListener('submit', async e => {
    e.preventDefault();
    if (!concursoAtivo) return;

    if (!dezenaSelecionada) {
      if (modalFeedbackEl) {
        modalFeedbackEl.className = 'modal-feedback erro';
        modalFeedbackEl.textContent = 'Escolha uma dezena (01 a 99 ou 00) antes de reservar.';
      }
      return;
    }

    const nome = modalNomeEl ? modalNomeEl.value.trim() : '';
    const whatsapp = modalWhatsappEl ? modalWhatsappEl.value.trim() : '';

    if (modalFeedbackEl) {
      modalFeedbackEl.className = 'modal-feedback';
      modalFeedbackEl.textContent = 'Registrando reserva do bilhete...';
    }

    try {
      const res = await fetch('/api/reservar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concursoId: concursoAtivo.id,
          concursoNumero: concursoAtivo.numero,
          horarioConcurso: concursoAtivo.horario,
          dataCiclo: obterDataCicloHoje(new Date()),
          selecao: dezenaSelecionada,
          origem: 'landing',
          nome,
          whatsapp
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.bilhete) {
        if (modalFeedbackEl) {
          modalFeedbackEl.className = 'modal-feedback erro';
          modalFeedbackEl.textContent = data.erro || 'Não foi possível concluir a reserva agora.';
        }
        return;
      }

      localStorage.setItem('99_membro_whatsapp', whatsapp);

      if (modalFeedbackEl) {
        modalFeedbackEl.className = 'modal-feedback';
        modalFeedbackEl.innerHTML = `
          Bilhete reservado! ID: <strong>${data.bilhete.id}</strong> • Dezena <strong>${data.bilhete.selecao}</strong> • Status Pix: <strong>PENDENTE</strong>.<br />
          <a href="/membros.html" style="color:#b8ff00;text-decoration:underline;">Ver na Área de Membros</a>
        `;
      }
    } catch (_) {
      if (modalFeedbackEl) {
        modalFeedbackEl.className = 'modal-feedback erro';
        modalFeedbackEl.textContent = 'Falha de comunicação com o servidor.';
      }
    }
  });
}

if (formConsultaIdEl) {
  formConsultaIdEl.addEventListener('submit', async e => {
    e.preventDefault();
    const idBusca = inputConsultaIdEl ? inputConsultaIdEl.value.trim() : '';
    if (!idBusca || !resultadoConsultaIdEl) return;

    resultadoConsultaIdEl.style.color = '#38bdf8';
    resultadoConsultaIdEl.textContent = 'Consultando bilhete...';

    try {
      const res = await fetch(`/api/bilhete/${encodeURIComponent(idBusca)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        resultadoConsultaIdEl.style.color = '#f87171';
        resultadoConsultaIdEl.textContent = data.erro || 'Bilhete não encontrado.';
        return;
      }

      resultadoConsultaIdEl.style.color = '#b8ff00';
      resultadoConsultaIdEl.innerHTML = `
        <strong>ID:</strong> ${data.id} • <strong>DZ:</strong> ${data.dezena}<br />
        <strong>Concurso:</strong> #${data.concurso.numero} (${data.concurso.horario}) • <strong>Pix:</strong> ${String(data.statusPagamento || 'pendente').toUpperCase()}<br />
        <strong>Situação:</strong> ${data.statusApuracao}
      `;
    } catch (_) {
      resultadoConsultaIdEl.style.color = '#f87171';
      resultadoConsultaIdEl.textContent = 'Erro ao consultar o bilhete.';
    }
  });
}

if (btnPrevSlideEl) {
  btnPrevSlideEl.addEventListener('click', () => {
    rolarParaIndice(indiceFocoCarousel - 1, true);
  });
}

if (btnNextSlideEl) {
  btnNextSlideEl.addEventListener('click', () => {
    rolarParaIndice(indiceFocoCarousel + 1, true);
  });
}

function irParaProximoSorteio() {
  const idx = encontrarIndiceProximoConcurso(new Date());
  rolarParaIndice(idx, true);
  const prox = concursos[idx];
  if (prox) abrirModalConcurso(prox);
}

if (btnIrProximoEl) {
  btnIrProximoEl.addEventListener('click', irParaProximoSorteio);
}

if (btnHeroProximoEl) {
  btnHeroProximoEl.addEventListener('click', irParaProximoSorteio);
}

if (carouselViewportEl) {
  carouselViewportEl.addEventListener('scroll', () => {
    const idxAprox = Math.round(carouselViewportEl.scrollLeft / CARD_LARGURA_PASSO);
    const limitado = Math.max(0, Math.min(concursos.length - 1, idxAprox));
    indiceFocoCarousel = limitado;
    if (carouselIndicadorEl && concursos[limitado]) {
      const atual = concursos[limitado];
      carouselIndicadorEl.textContent =
        `Concurso #${atual.numero} (${atual.horario}) • ${limitado + 1} de ${concursos.length}`;
    }
  });
}

function configurarQrPagina() {
  if (!qrPaginaEl) return;
  const urlAtual = encodeURIComponent(window.location.href);
  qrPaginaEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${urlAtual}`;
}

construirCarrossel();
montarGradeModal();
configurarQrPagina();
atualizarCronometros();
carregarConcursosAtivosServidor();
carregarUltimosResultados();
carregarConfigAgentes();

setInterval(atualizarCronometros, 1000);
setInterval(carregarUltimosResultados, 20000);
