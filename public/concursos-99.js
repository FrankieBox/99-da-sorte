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

// Interruptor rápido para ligar/desligar o time de agentes de aquecimento
let AGENTE_AQUECIMENTO_ATIVO = true;

const AGENTES_PADRAO = [
  { id: 'AGT-01', nome: 'Lucas M.', regiao: 'Zona Sul', dezenasPreferidas: ['27', '07', '77'], ativo: true },
  { id: 'AGT-02', nome: 'Camila R.', regiao: 'Centro', dezenasPreferidas: ['14', '24', '88'], ativo: true },
  { id: 'AGT-03', nome: 'Rafael S.', regiao: 'Zona Leste', dezenasPreferidas: ['03', '33', '69'], ativo: true },
  { id: 'AGT-04', nome: 'Beatriz F.', regiao: 'Zona Norte', dezenasPreferidas: ['19', '45', '00'], ativo: true },
  { id: 'AGT-05', nome: 'Diego T.', regiao: 'Zona Oeste', dezenasPreferidas: ['11', '52', '91'], ativo: true },
  { id: 'AGT-06', nome: 'Aline C.', regiao: 'Centro', dezenasPreferidas: ['08', '22', '64'], ativo: true }
];

const CONCURSOS = HORARIOS_CONCURSOS.map((horario, idx) => ({
  id: `C-${String(idx + 1).padStart(2, '0')}`,
  numero: String(idx + 1).padStart(2, '0'),
  horario,
  tipo: idx >= 12 ? 'SESSÃO ESPECIAL' : 'GRADE HORÁRIA',
  valorBilhete: 2.5,
  modalidade: 'DZ'
}));

const carouselViewportEl = document.getElementById('carousel-viewport');
const carouselTrackEl = document.getElementById('carousel-track');
const carouselIndicadorEl = document.getElementById('carousel-indicador');
const btnPrevSlideEl = document.getElementById('btn-prev-slide');
const btnNextSlideEl = document.getElementById('btn-next-slide');
const btnIrProximoEl = document.getElementById('btn-ir-proximo');
const relogioAtualEl = document.getElementById('relogio-atual');
const qrPaginaEl = document.getElementById('qr-pagina');

const modalEl = document.getElementById('modal-concurso');
const btnFecharModalEl = document.getElementById('btn-fechar-modal');
const modalCodigoEl = document.getElementById('modal-codigo');
const modalTituloEl = document.getElementById('modal-titulo');
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

const inputConsultaIdEl = document.getElementById('input-consulta-id');
const btnConsultaIdEl = document.getElementById('btn-consulta-id');
const resultadoConsultaIdEl = document.getElementById('resultado-consulta-id');

let concursoAtivo = null;
let dezenaSelecionada = '';
let idProximoGlobal = CONCURSOS[0].id;
let posicaoInicialAjustada = false;

let resultadosPorHorario = {};
let catalogoAgentes = [...AGENTES_PADRAO];
let intervaloMinMs = 8000;
let intervaloMaxMs = 16000;
let timerAgenteId = null;
let ultimoAgenteId = '';
let ultimaDezenaAgente = '';

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

function construirCarrossel() {
  const triplo = [...CONCURSOS, ...CONCURSOS, ...CONCURSOS];

  carouselTrackEl.innerHTML = triplo
    .map((c, idx) => {
      return `
        <article class="concurso-card" data-concurso-id="${c.id}" data-indice-real="${idx % CONCURSOS.length}">
          <div class="card-top-row">
            <span class="card-num">#${c.numero} • ${c.tipo === 'SESSÃO ESPECIAL' ? 'EXTRA' : 'HORA'}</span>
            <span class="card-status aberto" data-status-for="${c.id}">HOJE</span>
          </div>
          <div class="card-hora">${c.horario}</div>
          <div class="card-timer-box">
            <span data-label-for="${c.id}">FECHA EM</span>
            <strong data-timer-for="${c.id}">--:--:--</strong>
          </div>
          <div class="card-cta-line">
            <span>DEZENA • R$ 2,50</span>
            <span>ENTRAR ➔</span>
          </div>
        </article>
      `;
    })
    .join('');

  carouselTrackEl.querySelectorAll('.concurso-card').forEach(card => {
    card.addEventListener('click', () => {
      const c = CONCURSOS.find(item => item.id === card.dataset.concursoId);
      if (c) abrirModalConcurso(c);
    });
  });
}

function larguraUmBloco() {
  const primeiroCard = carouselTrackEl.querySelector('.concurso-card');
  if (!primeiroCard) return 178 * CONCURSOS.length;
  return (primeiroCard.offsetWidth + 10) * CONCURSOS.length;
}

function normalizarLoopCarrossel() {
  const bloco = larguraUmBloco();
  if (!bloco) return;

  if (carouselViewportEl.scrollLeft < bloco * 0.4) {
    carouselViewportEl.scrollLeft += bloco;
  } else if (carouselViewportEl.scrollLeft > bloco * 1.8) {
    carouselViewportEl.scrollLeft -= bloco;
  }

  const primeiroCard = carouselTrackEl.querySelector('.concurso-card');
  const passo = primeiroCard ? primeiroCard.offsetWidth + 10 : 178;
  const idxAtual = Math.round((carouselViewportEl.scrollLeft % bloco) / passo) % CONCURSOS.length;
  const numeroExibido = pad2(((idxAtual + CONCURSOS.length) % CONCURSOS.length) + 1);
  carouselIndicadorEl.textContent = `Concurso #${numeroExibido} de ${CONCURSOS.length}`;
}

function focarConcursoNoCarrossel(concursoId, suave = true) {
  const bloco = larguraUmBloco();
  const cardsCentrais = Array.from(carouselTrackEl.querySelectorAll('.concurso-card')).slice(
    CONCURSOS.length,
    CONCURSOS.length * 2
  );
  const alvo = cardsCentrais.find(el => el.dataset.concursoId === concursoId);
  if (!alvo) return;

  const destino = alvo.offsetLeft - 14;
  if (suave) {
    carouselViewportEl.scrollTo({ left: destino, behavior: 'smooth' });
  } else {
    carouselViewportEl.scrollLeft = destino || bloco;
  }
  normalizarLoopCarrossel();
}

btnPrevSlideEl.addEventListener('click', () => {
  carouselViewportEl.scrollBy({ left: -185, behavior: 'smooth' });
});

btnNextSlideEl.addEventListener('click', () => {
  carouselViewportEl.scrollBy({ left: 185, behavior: 'smooth' });
});

btnIrProximoEl.addEventListener('click', () => {
  focarConcursoNoCarrossel(idProximoGlobal, true);
});

carouselViewportEl.addEventListener('scroll', normalizarLoopCarrossel, { passive: true });

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

  idProximoGlobal = idProximoHoje || CONCURSOS[0].id;

  estados.forEach(({ concurso, info }) => {
    const duracaoFmt = formatarDuracao(info.restanteMs);
    const ehProximo = concurso.id === idProximoGlobal;

    document.querySelectorAll(`[data-timer-for="${concurso.id}"]`).forEach(el => {
      el.textContent = duracaoFmt;
    });

    document.querySelectorAll(`.concurso-card[data-concurso-id="${concurso.id}"]`).forEach(cardEl => {
      cardEl.classList.toggle('proximo', ehProximo);
      cardEl.classList.toggle('encerrado-hoje', !info.hoje);
    });

    document.querySelectorAll(`[data-status-for="${concurso.id}"]`).forEach(statusEl => {
      if (ehProximo) {
        statusEl.textContent = 'PRÓXIMO';
        statusEl.className = 'card-status proximo-tag';
      } else if (info.hoje) {
        statusEl.textContent = 'HOJE';
        statusEl.className = 'card-status aberto';
      } else {
        statusEl.textContent = 'AMANHÃ';
        statusEl.className = 'card-status amanha';
      }
    });

    document.querySelectorAll(`[data-label-for="${concurso.id}"]`).forEach(labelEl => {
      labelEl.textContent = info.hoje ? 'FECHA EM' : 'PRÓXIMO CICLO';
    });

    if (concursoAtivo && concursoAtivo.id === concurso.id) {
      modalCronometroEl.textContent = duracaoFmt;
    }
  });

  if (!posicaoInicialAjustada) {
    posicaoInicialAjustada = true;
    focarConcursoNoCarrossel(idProximoGlobal, false);
  }
}

async function carregarResultados() {
  try {
    const res = await fetch('/api/resultados');
    if (!res.ok) return;
    const data = await res.json();
    resultadosPorHorario = data.ultimoPorHorario || {};
    if (concursoAtivo) {
      atualizarBlocoResultadoModal(concursoAtivo.horario);
    }
  } catch (e) {
    // Mantém estado atual em caso de falha de rede
  }
}

function atualizarBlocoResultadoModal(horario) {
  if (!modalUltimoResultadoEl) return;
  const resHorario = resultadosPorHorario[horario];
  if (resHorario && resHorario.dezena) {
    modalUltimoResultadoEl.textContent = `Dezena ${resHorario.dezena} • Grupo ${resHorario.grupo}`;
  } else {
    modalUltimoResultadoEl.textContent = 'Aguardando apuração';
  }
}

async function carregarConfigAgentes() {
  try {
    const res = await fetch('/api/agentes');
    if (!res.ok) return;
    const cfg = await res.json();
    if (typeof cfg.ativoGlobal === 'boolean') {
      AGENTE_AQUECIMENTO_ATIVO = cfg.ativoGlobal;
    }
    if (Array.isArray(cfg.agentes) && cfg.agentes.length > 0) {
      catalogoAgentes = cfg.agentes.filter(a => a.ativo !== false);
    }
    if (cfg.intervaloMinSegundos) {
      intervaloMinMs = Number(cfg.intervaloMinSegundos) * 1000;
    }
    if (cfg.intervaloMaxSegundos) {
      intervaloMaxMs = Math.max(intervaloMinMs + 1000, Number(cfg.intervaloMaxSegundos) * 1000);
    }
  } catch (e) {
    catalogoAgentes = AGENTES_PADRAO.filter(a => a.ativo !== false);
  }
}

function escolherDezenaAgente(agente) {
  const poolPrefs = Array.isArray(agente.dezenasPreferidas)
    ? agente.dezenasPreferidas.filter(d => DEZENAS_100.includes(d) && d !== ultimaDezenaAgente)
    : [];

  let escolhida = '';
  if (poolPrefs.length > 0 && Math.random() < 0.7) {
    escolhida = poolPrefs[Math.floor(Math.random() * poolPrefs.length)];
  } else {
    const alternativas = DEZENAS_100.filter(d => d !== ultimaDezenaAgente);
    escolhida = alternativas[Math.floor(Math.random() * alternativas.length)];
  }

  ultimaDezenaAgente = escolhida;
  return escolhida;
}

function exibirBalaoAgente() {
  if (!slotAgentesEl || !concursoAtivo || !AGENTE_AQUECIMENTO_ATIVO || catalogoAgentes.length === 0) {
    return;
  }

  const candidatos = catalogoAgentes.filter(a => a.id !== ultimoAgenteId);
  const lista = candidatos.length > 0 ? candidatos : catalogoAgentes;
  const agente = lista[Math.floor(Math.random() * lista.length)];
  ultimoAgenteId = agente.id;

  const dezena = escolherDezenaAgente(agente);
  slotAgentesEl.innerHTML = `
    <div class="balao-agente-toast" style="padding:8px 12px;border-radius:10px;background:rgba(16,32,56,0.92);border:1px solid rgba(163,230,53,0.45);color:#f8fafc;font-size:0.82rem;display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <span><strong>${agente.nome}</strong> • ${agente.regiao} garantiu a dezena <strong style="color:#a3e635;">${dezena}</strong></span>
      <span style="opacity:0.75;font-size:0.74rem;">${concursoAtivo.horario}</span>
    </div>
  `;
}

function agendarProximoBalaoAgente() {
  limparAgentesModal();
  if (!concursoAtivo || !AGENTE_AQUECIMENTO_ATIVO) return;

  const delay =
    intervaloMinMs + Math.floor(Math.random() * Math.max(1000, intervaloMaxMs - intervaloMinMs));

  timerAgenteId = setTimeout(() => {
    if (!concursoAtivo || !AGENTE_AQUECIMENTO_ATIVO) return;
    exibirBalaoAgente();
    agendarProximoBalaoAgente();
  }, delay);
}

function limparAgentesModal() {
  if (timerAgenteId) {
    clearTimeout(timerAgenteId);
    timerAgenteId = null;
  }
  if (slotAgentesEl) {
    slotAgentesEl.innerHTML = '';
  }
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
  atualizarBlocoResultadoModal(concurso.horario);
  atualizarCronometros();
  modalEl.classList.remove('oculto');

  if (AGENTE_AQUECIMENTO_ATIVO) {
    exibirBalaoAgente();
    agendarProximoBalaoAgente();
  }
}

function fecharModalConcurso() {
  concursoAtivo = null;
  limparAgentesModal();
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

async function consultarBilhetePorId() {
  if (!inputConsultaIdEl || !resultadoConsultaIdEl) return;
  const id = inputConsultaIdEl.value.trim();
  if (!id) {
    resultadoConsultaIdEl.textContent = 'Digite o ID do bilhete para consultar.';
    return;
  }

  resultadoConsultaIdEl.textContent = 'Consultando bilhete...';
  const res = await fetch(`/api/bilhete/${encodeURIComponent(id)}`);
  const data = await res.json();

  if (!res.ok) {
    resultadoConsultaIdEl.textContent = data.erro || 'Bilhete não encontrado.';
    return;
  }

  const selFmt = Array.isArray(data.selecao) ? data.selecao.join(' • ') : data.selecao;
  resultadoConsultaIdEl.textContent =
    `ID ${data.id} • Dia ${data.data} • Concurso ${data.horarioConcurso} • ` +
    `${data.modalidade} ${selFmt} • ${data.statusApuracao}`;
}

if (btnConsultaIdEl) {
  btnConsultaIdEl.addEventListener('click', consultarBilhetePorId);
}

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
      horarioConcurso: concursoAtivo.horario,
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

construirCarrossel();
montarGradeModal();
configurarQrPagina();
atualizarCronometros();
carregarResultados();
carregarConfigAgentes();
setInterval(atualizarCronometros, 1000);
setInterval(carregarResultados, 20000);
