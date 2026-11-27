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

const CONCURSOS_CATALOGO = HORARIOS_CONCURSOS.map((horario, idx) => ({
  id: `C-${String(idx + 1).padStart(2, '0')}`,
  numero: String(idx + 1).padStart(2, '0'),
  horario,
  tipo: idx >= 12 ? 'SESSÃO ESPECIAL' : 'GRADE HORÁRIA',
  valorBilhete: 2.5,
  premio: 50.0,
  modalidade: 'DZ'
}));

// Código Pix provisório limpo (R$ 2,50) — sem concatenar ou duplicar trechos
const PIX_PROVISORIO_COPIA_COLA =
  '00020126580014br.gov.bcb.pix013657b60c7f-4628-474b-92c5-e22753afc57e52040000530398654042.505802BR5919IZAQUE SOUZA SOARES60085500019962070503***6304AC47';

const STORAGE_SURPRESINHA_KEY = '99_sorte_surpresinha_sha256_ciclo_v1';

const listaConcursosEl = document.getElementById('lista-concursos');
const carrosselViewportEl = document.getElementById('carrossel-concursos');
const btnPrevEl = document.getElementById('btn-carrossel-prev');
const btnNextEl = document.getElementById('btn-carrossel-next');
const btnToggleEl = document.getElementById('btn-carrossel-toggle');

const btnAbrirConsultaTopEl = document.getElementById('btn-abrir-consulta');
const inputBuscaIdEl = document.getElementById('input-busca-id');
const btnBuscarIdEl = document.getElementById('btn-buscar-id');
const resultadoConsultaEl = document.getElementById('resultado-consulta');

const btnCopiarLinkEl = document.getElementById('btn-copiar-link');
const qrConviteAmigosEl = document.getElementById('qr-convite-amigos');

const modalSorteioEl = document.getElementById('modal-sorteio');
const btnFecharModalEl = document.getElementById('btn-fechar-modal');
const modalConcursoTagEl = document.getElementById('modal-concurso-tag');
const modalHorarioEl = document.getElementById('modal-horario');
const modalCronometroEl = document.getElementById('modal-cronometro');
const modalUltimoResultadoEl = document.getElementById('modal-ultimo-resultado');
const slotAgentesEl = document.getElementById('slot-agentes-futuro');
const waNomeEl = document.getElementById('wa-nome');
const waAcaoEl = document.getElementById('wa-acao');
const waDezenaEl = document.getElementById('wa-dezena');

const displayDezenaEscolhidaEl = document.getElementById('display-dezena-escolhida');
const btnSurpresinhaEl = document.getElementById('btn-surpresinha');
const gridDezenasEl = document.getElementById('grid-dezenas');
const formReservaEl = document.getElementById('form-reserva');
const inputNomeEl = document.getElementById('input-nome');
const inputTelefoneEl = document.getElementById('input-telefone');

const modalPixEl = document.getElementById('modal-pix');
const btnFecharPixEl = document.getElementById('btn-fechar-pix');
const pixBilheteIdEl = document.getElementById('pix-bilhete-id');
const pixInfoConcursoEl = document.getElementById('pix-info-concurso');
const imgQrProvisorioEl = document.getElementById('img-qr-provisorio');
const inputPixCopiaColaEl = document.getElementById('input-pix-copia-cola');
const btnCopiarPixEl = document.getElementById('btn-copiar-pix');
const btnConcluirReservaEl = document.getElementById('btn-concluir-reserva');

let concursosAtivosHoje = [];
let concursoAtivo = null;
let dezenaSelecionada = '';

// Controle do carrossel infinito com movimento manual + retorno automático
let animacaoCarrosselId = null;
let pausaManualAte = 0;
let modoPausadoManual = false;
let arrastandoCarrossel = false;
let inicioXArrasto = 0;
let scrollInicialArrasto = 0;
let moveuDuranteArrasto = false;

let timerAgentesId = null;
let ultimoAgenteId = null;
let configAgentesCache = null;
let contadorSurpresinha = 0;
const cicloSurpresinhaMemoria = {};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function obterDataCicloIso(agora = new Date()) {
  return `${agora.getFullYear()}-${pad2(agora.getMonth() + 1)}-${pad2(agora.getDate())}`;
}

function obterAlvoHoje(horarioStr, agora = new Date()) {
  const [hh, mm] = horarioStr.split(':').map(Number);
  return new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
    hh,
    mm,
    0,
    0
  );
}

function formatarDuracao(ms) {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function obterEstadoCicloSurpresinha(chaveContexto) {
  try {
    const raw = localStorage.getItem(STORAGE_SURPRESINHA_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const estado = parsed[chaveContexto];
    if (estado && Array.isArray(estado.sorteadas)) {
      const validas = estado.sorteadas.filter(dz => DEZENAS_100.includes(dz));
      if (validas.length < DEZENAS_100.length) {
        return { all: parsed, sorteadas: validas };
      }
    }
    return { all: parsed, sorteadas: [] };
  } catch (_) {
    const atual = cicloSurpresinhaMemoria[chaveContexto] || [];
    return {
      all: cicloSurpresinhaMemoria,
      sorteadas: atual.length < DEZENAS_100.length ? [...atual] : []
    };
  }
}

function salvarEstadoCicloSurpresinha(chaveContexto, sorteadas, allStore) {
  cicloSurpresinhaMemoria[chaveContexto] = [...sorteadas];
  try {
    const store = allStore && typeof allStore === 'object' ? allStore : {};
    store[chaveContexto] = {
      sorteadas,
      atualizadoEm: Date.now()
    };
    localStorage.setItem(STORAGE_SURPRESINHA_KEY, JSON.stringify(store));
  } catch (_) {
    // Fallback em memória já atualizado
  }
}

async function gerarHashSha256Bytes(texto) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
}

async function sortearDezenaSurpresinhaSha256(chaveContexto) {
  contadorSurpresinha += 1;
  const { all, sorteadas } = obterEstadoCicloSurpresinha(chaveContexto);
  const setSorteadas = new Set(sorteadas);

  let disponiveis = DEZENAS_100.filter(dz => !setSorteadas.has(dz));
  let cicloReiniciado = false;

  // Só volta a repetir após todas as 100 dezenas saírem
  if (disponiveis.length === 0) {
    disponiveis = [...DEZENAS_100];
    sorteadas.length = 0;
    cicloReiniciado = true;
  }

  const aleatorios = new Uint32Array(4);
  crypto.getRandomValues(aleatorios);

  const semente = [
    chaveContexto,
    contadorSurpresinha,
    Date.now(),
    performance.now(),
    Array.from(aleatorios).join('-'),
    sorteadas.join(',')
  ].join('|');

  const hashBytes = await gerarHashSha256Bytes(semente);
  const valor32 =
    ((hashBytes[0] << 24) >>> 0) +
    (hashBytes[1] << 16) +
    (hashBytes[2] << 8) +
    hashBytes[3];

  const escolhida = disponiveis[valor32 % disponiveis.length];
  const novoHistorico = [...sorteadas, escolhida];
  salvarEstadoCicloSurpresinha(chaveContexto, novoHistorico, all);

  return {
    dezena: escolhida,
    cicloReiniciado
  };
}

function montarCardConcursoHtml(c, idx, total) {
  const badgeDestaque = idx % total === 0 ? 'PRÓXIMO' : c.tipo === 'SESSÃO ESPECIAL' ? 'EXTRA' : 'ATIVO';
  return `
    <article class="concurso-card ${idx % total === 0 ? 'card-proximo' : ''}" data-concurso-id="${c.id}">
      <div class="card-topo">
        <span class="card-num">CONCURSO #${c.numero}</span>
        <span class="card-badge">${badgeDestaque}</span>
      </div>
      <div class="card-hora">${c.horario}</div>
      <div class="card-premio">Prêmio: <strong>R$ 50,00</strong> • Bilhete R$ 2,50</div>
      <div class="card-timer-linha">
        <span>FECHA EM</span>
        <strong data-timer-concurso="${c.id}">--:--:--</strong>
      </div>
      <button type="button" class="btn-escolher-dezena" data-abrir-concurso="${c.id}">
        ESCOLHER DEZENA ➔
      </button>
    </article>
  `;
}

function renderizarCarrosselAtivos() {
  if (!listaConcursosEl) return;

  if (concursosAtivosHoje.length === 0) {
    listaConcursosEl.innerHTML = `
      <div class="card-concurso encerrado-dia">
        <div class="card-topo">
          <span>CICLO ENCERRADO</span>
          <span>00:00</span>
        </div>
        <div class="card-hora">AMANHÃ</div>
        <p class="card-sub">Os sorteios de hoje já encerraram. Novos concursos abrem na virada do dia.</p>
      </div>
    `;
    return;
  }

  const scrollAnterior = carrosselViewportEl ? carrosselViewportEl.scrollLeft : 0;
  const total = concursosAtivosHoje.length;

  // Duplica a lista para manter o loop contínuo sem salto brusco
  const htmlOriginal = concursosAtivosHoje.map((c, idx) => montarCardConcursoHtml(c, idx, total)).join('');
  const htmlDuplicado = concursosAtivosHoje.map((c, idx) => montarCardConcursoHtml(c, idx, total)).join('');
  listaConcursosEl.innerHTML = htmlOriginal + htmlDuplicado;

  if (carrosselViewportEl && scrollAnterior > 0) {
    carrosselViewportEl.scrollLeft = scrollAnterior;
  }

  listaConcursosEl.querySelectorAll('[data-abrir-concurso]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const c = concursosAtivosHoje.find(item => item.id === btn.dataset.abrirConcurso);
      if (c) abrirModalConcurso(c);
    });
  });

  listaConcursosEl.querySelectorAll('.card-concurso[data-concurso-id]').forEach(card => {
    card.addEventListener('click', () => {
      const c = concursosAtivosHoje.find(item => item.id === card.dataset.concursoId);
      if (c) abrirModalConcurso(c);
    });
  });
}

function sincronizarConcursosAtivos(forcarReconstrucao = false) {
  const agora = new Date();
  const ativos = CONCURSOS_CATALOGO.filter(
    c => obterAlvoHoje(c.horario, agora).getTime() > agora.getTime()
  );

  const mudouLista =
    forcarReconstrucao ||
    ativos.length !== concursosAtivosHoje.length ||
    ativos.some((item, idx) => !concursosAtivosHoje[idx] || concursosAtivosHoje[idx].id !== item.id);

  concursosAtivosHoje = ativos;

  if (concursoAtivo) {
    const alvoAtivo = obterAlvoHoje(concursoAtivo.horario, agora);
    if (alvoAtivo.getTime() <= agora.getTime()) {
      fecharModalConcurso();
    }
  }

  if (mudouLista) {
    renderizarCarrosselAtivos();
  }
}

function atualizarCronometros() {
  sincronizarConcursosAtivos(false);
  const agora = new Date();

  concursosAtivosHoje.forEach(c => {
    const alvo = obterAlvoHoje(c.horario, agora);
    const restanteMs = Math.max(0, alvo.getTime() - agora.getTime());
    const fmt = formatarDuracao(restanteMs);

    document.querySelectorAll(`[data-timer-concurso="${c.id}"]`).forEach(el => {
      el.textContent = fmt;
    });

    if (concursoAtivo && concursoAtivo.id === c.id && modalCronometroEl) {
      modalCronometroEl.textContent = fmt;
    }
  });
}

function pausarTemporariamente(ms = 3500) {
  pausaManualAte = Date.now() + ms;
}

function normalizarScrollInfinito() {
  if (!carrosselViewportEl || !listaConcursosEl) return;
  const metade = listaConcursosEl.scrollWidth / 2;
  if (!metade) return;

  if (carrosselViewportEl.scrollLeft >= metade) {
    carrosselViewportEl.scrollLeft -= metade;
  } else if (carrosselViewportEl.scrollLeft <= 0) {
    carrosselViewportEl.scrollLeft += metade;
  }
}

function configurarControlesCarrossel() {
  if (!carrosselViewportEl || !listaConcursosEl) return;

  if (btnPrevEl) {
    btnPrevEl.addEventListener('click', () => {
      pausarTemporariamente(4000);
      carrosselViewportEl.scrollLeft -= 210;
      normalizarScrollInfinito();
    });
  }

  if (btnNextEl) {
    btnNextEl.addEventListener('click', () => {
      pausarTemporariamente(4000);
      carrosselViewportEl.scrollLeft += 210;
      normalizarScrollInfinito();
    });
  }

  if (btnToggleEl) {
    btnToggleEl.addEventListener('click', () => {
      modoPausadoManual = !modoPausadoManual;
      if (!modoPausadoManual) {
        pausaManualAte = 0;
        btnToggleEl.textContent = '⏸ PAUSAR';
        btnToggleEl.classList.remove('ativo');
      } else {
        btnToggleEl.textContent = '▶ RODAR';
        btnToggleEl.classList.add('ativo');
      }
    });
  }

  carrosselViewportEl.addEventListener('pointerdown', e => {
    arrastandoCarrossel = true;
    moveuDuranteArrasto = false;
    inicioXArrasto = e.clientX;
    scrollInicialArrasto = carrosselViewportEl.scrollLeft;
    pausarTemporariamente(5000);
  });

  window.addEventListener('pointermove', e => {
    if (!arrastandoCarrossel || !carrosselViewportEl) return;
    const delta = e.clientX - inicioXArrasto;
    if (Math.abs(delta) > 4) {
      moveuDuranteArrasto = true;
    }
    carrosselViewportEl.scrollLeft = scrollInicialArrasto - delta;
    normalizarScrollInfinito();
  });

  window.addEventListener('pointerup', () => {
    if (!arrastandoCarrossel) return;
    arrastandoCarrossel = false;
    pausarTemporariamente(3500);
    if (moveuDuranteArrasto && listaConcursosEl) {
      const bloquearClique = ev => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      listaConcursosEl.addEventListener('click', bloquearClique, { capture: true, once: true });
      setTimeout(() => {
        listaConcursosEl.removeEventListener('click', bloquearClique, { capture: true });
      }, 60);
    }
  });

  carrosselViewportEl.addEventListener('wheel', () => {
    pausarTemporariamente(3500);
    normalizarScrollInfinito();
  }, { passive: true });
}

function iniciarLoopCarrossel() {
  if (animacaoCarrosselId) cancelAnimationFrame(animacaoCarrosselId);

  let ultimoTempo = performance.now();
  const velocidadePxPorSegundo = 34;

  function passo(agora) {
    const dt = Math.min(0.05, (agora - ultimoTempo) / 1000);
    ultimoTempo = agora;

    const modalAberto = modalSorteioEl && !modalSorteioEl.classList.contains('hidden');
    const pixAberto = modalPixEl && !modalPixEl.classList.contains('hidden');

    if (
      carrosselViewportEl &&
      listaConcursosEl &&
      concursosAtivosHoje.length > 0 &&
      !modoPausadoManual &&
      !arrastandoCarrossel &&
      !modalAberto &&
      !pixAberto &&
      Date.now() >= pausaManualAte
    ) {
      carrosselViewportEl.scrollLeft += velocidadePxPorSegundo * dt;
      normalizarScrollInfinito();
    }

    animacaoCarrosselId = requestAnimationFrame(passo);
  }

  animacaoCarrosselId = requestAnimationFrame(passo);
}

function montarGradeDezenas() {
  if (!gridDezenasEl) return;
  gridDezenasEl.innerHTML = DEZENAS_100.map(
    dz => `<button type="button" class="btn-dezena dz-btn" data-dz="${dz}">${dz}</button>`
  ).join('');

  gridDezenasEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-dz]');
    if (!btn) return;
    selecionarDezena(btn.dataset.dz);
  });
}

function selecionarDezena(dz) {
  dezenaSelecionada = dz || '';
  if (displayDezenaEscolhidaEl) {
    displayDezenaEscolhidaEl.textContent = dezenaSelecionada ? `(01-00) ${dezenaSelecionada}` : '(01-00) --';
  }
  if (gridDezenasEl) {
    gridDezenasEl.querySelectorAll('[data-dz]').forEach(btn => {
      btn.classList.toggle('selecionada', btn.dataset.dz === dezenaSelecionada);
    });
  }
}

if (btnSurpresinhaEl) {
  btnSurpresinhaEl.addEventListener('click', async () => {
    const contexto = concursoAtivo
      ? `${obterDataCicloIso()}-${concursoAtivo.id}`
      : `${obterDataCicloIso()}-GERAL`;
    const resultado = await sortearDezenaSurpresinhaSha256(contexto);
    selecionarDezena(resultado.dezena);
  });
}

async function carregarUltimoResultado(concurso) {
  if (!modalUltimoResultadoEl) return;
  modalUltimoResultadoEl.textContent = 'Aguardando apuração';
  try {
    const hojeIso = obterDataCicloIso();
    const url = `/api/resultados?horario=${encodeURIComponent(concurso.horario)}&data=${encodeURIComponent(hojeIso)}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const payload = await res.json();
    const item =
      (payload.resultados && payload.resultados[0]) ||
      (payload.ultimoPorHorario && payload.ultimoPorHorario[concurso.horario]);
    if (item && item.dezena) {
      modalUltimoResultadoEl.textContent = `Dezena ${item.dezena} • Grupo ${item.grupo}`;
    }
  } catch (_) {
    // Mantém "Aguardando apuração"
  }
}

function pararAgentesModal() {
  if (timerAgentesId) {
    clearTimeout(timerAgentesId);
    timerAgentesId = null;
  }
}

function escolherDezenaAgente(agente) {
  const prefs = Array.isArray(agente && agente.dezenasPreferidas) ? agente.dezenasPreferidas : [];
  if (prefs.length > 0 && Math.random() < 0.65) {
    return String(prefs[Math.floor(Math.random() * prefs.length)]).padStart(2, '0');
  }
  return DEZENAS_100[Math.floor(Math.random() * DEZENAS_100.length)];
}

function atualizarBalaoAgente(cfg, concurso) {
  if (!concursoAtivo || concursoAtivo.id !== concurso.id) return;
  const ativos = (cfg && Array.isArray(cfg.agentes) ? cfg.agentes : []).filter(a => a && a.ativo !== false);
  if (ativos.length === 0) return;

  const candidatos = ativos.length > 1 ? ativos.filter(a => a.id !== ultimoAgenteId) : ativos;
  const agente = candidatos[Math.floor(Math.random() * candidatos.length)];
  ultimoAgenteId = agente.id;

  const nome = agente.nome || 'Passageiro 99';
  const regiao = agente.regiao || 'Rota 99';
  const dz = escolherDezenaAgente(agente);

  if (waNomeEl) waNomeEl.textContent = `${nome} (${regiao})`;
  if (waAcaoEl) waAcaoEl.textContent = `reservou no Concurso #${concurso.numero} (${concurso.horario})`;
  if (waDezenaEl) waDezenaEl.textContent = `DZ ${dz}`;
  if (slotAgentesEl) slotAgentesEl.classList.remove('hidden');
}

async function iniciarAgentesModal(concurso) {
  pararAgentesModal();
  try {
    const res = await fetch('/api/agentes');
    if (!res.ok) return;
    const cfg = await res.json();
    configAgentesCache = cfg;

    if (!cfg || !cfg.ativoGlobal || !concursoAtivo || concursoAtivo.id !== concurso.id) {
      return;
    }

    atualizarBalaoAgente(cfg, concurso);
    const minSeg = Math.max(5, Number(cfg.intervaloMinSegundos) || 8);
    const maxSeg = Math.max(minSeg + 2, Number(cfg.intervaloMaxSegundos) || 16);

    const agendar = () => {
      if (!concursoAtivo || concursoAtivo.id !== concurso.id) return;
      const espera = (minSeg + Math.random() * (maxSeg - minSeg)) * 1000;
      timerAgentesId = setTimeout(() => {
        if (!concursoAtivo || concursoAtivo.id !== concurso.id) return;
        atualizarBalaoAgente(configAgentesCache, concurso);
        agendar();
      }, espera);
    };

    agendar();
  } catch (_) {
    // Falha silenciosa
  }
}

function abrirModalConcurso(concurso) {
  concursoAtivo = concurso;
  selecionarDezena('');
  if (formReservaEl) formReservaEl.reset();

  if (modalConcursoTagEl) {
    modalConcursoTagEl.textContent = `CONCURSO #${concurso.numero} • PRÊMIO R$ 50,00`;
  }
  if (modalHorarioEl) {
    modalHorarioEl.textContent = concurso.horario;
  }

  atualizarCronometros();
  carregarUltimoResultado(concurso);
  iniciarAgentesModal(concurso);

  if (modalSorteioEl) {
    modalSorteioEl.classList.remove('hidden');
  }
}

function fecharModalConcurso() {
  pararAgentesModal();
  concursoAtivo = null;
  if (modalSorteioEl) {
    modalSorteioEl.classList.add('hidden');
  }
}

if (btnFecharModalEl) {
  btnFecharModalEl.addEventListener('click', fecharModalConcurso);
}

if (modalSorteioEl) {
  modalSorteioEl.addEventListener('click', e => {
    if (e.target === modalSorteioEl) fecharModalConcurso();
  });
}

function abrirModalPixProvisorio(bilhete, concurso) {
  const idExibido = (bilhete && bilhete.id) || `99S-${concurso.id}-0000`;
  const dezenaExibida = (bilhete && bilhete.selecao) || dezenaSelecionada;
  const pixLimpo = (bilhete && bilhete.pixCopiaCola) || PIX_PROVISORIO_COPIA_COLA;

  if (pixBilheteIdEl) pixBilheteIdEl.textContent = idExibido;
  if (pixInfoConcursoEl) {
    pixInfoConcursoEl.textContent = `Concurso #${concurso.numero} • ${concurso.horario} • Dezena ${dezenaExibida}`;
  }
  if (inputPixCopiaColaEl) {
    inputPixCopiaColaEl.value = pixLimpo;
  }
  if (imgQrProvisorioEl) {
    const encodedPix = encodeURIComponent(pixLimpo);
    imgQrProvisorioEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodedPix}`;
  }
  if (inputBuscaIdEl) {
    inputBuscaIdEl.value = idExibido;
  }

  if (modalPixEl) {
    modalPixEl.classList.remove('hidden');
  }
}

function fecharModalPixProvisorio() {
  if (modalPixEl) {
    modalPixEl.classList.add('hidden');
  }
}

if (btnFecharPixEl) {
  btnFecharPixEl.addEventListener('click', fecharModalPixProvisorio);
}

if (btnCopiarPixEl && inputPixCopiaColaEl) {
  btnCopiarPixEl.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(inputPixCopiaColaEl.value);
      btnCopiarPixEl.textContent = 'COPIADO ✓';
      setTimeout(() => {
        btnCopiarPixEl.textContent = 'COPIAR CÓDIGO PIX';
      }, 1800);
    } catch (_) {
      inputPixCopiaColaEl.select();
    }
  });
}

if (btnConcluirReservaEl) {
  btnConcluirReservaEl.addEventListener('click', () => {
    fecharModalPixProvisorio();
    fecharModalConcurso();
  });
}

if (formReservaEl) {
  formReservaEl.addEventListener('submit', async e => {
    e.preventDefault();
    if (!concursoAtivo) return;

    if (!dezenaSelecionada) {
      alert('Escolha uma dezena de 01 a 99 ou 00 antes de reservar.');
      return;
    }

    const nome = (inputNomeEl && inputNomeEl.value.trim()) || '';
    const telefone = (inputTelefoneEl && inputTelefoneEl.value.trim()) || '';
    if (!nome || !telefone) {
      alert('Preencha seu nome e telefone.');
      return;
    }

    const concursoAtual = concursoAtivo;
    const payload = {
      concursoId: concursoAtual.id,
      concursoNumero: concursoAtual.numero,
      horarioConcurso: concursoAtual.horario,
      dataCiclo: obterDataCicloIso(),
      modalidade: 'DZ',
      selecao: dezenaSelecionada,
      valor: concursoAtual.valorBilhete,
      origem: 'landing',
      lead: { nome, contato: telefone }
    };

    try {
      const res = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.erro || 'Não foi possível registrar a reserva deste concurso.');
        return;
      }

      abrirModalPixProvisorio(data.bilhete, concursoAtual);
    } catch (_) {
      alert('Erro de comunicação ao registrar o bilhete. Tente novamente.');
    }
  });
}

async function consultarBilhetePorId() {
  if (!inputBuscaIdEl || !resultadoConsultaEl) return;
  const idBusca = inputBuscaIdEl.value.trim();
  if (!idBusca) {
    resultadoConsultaEl.classList.remove('hidden');
    resultadoConsultaEl.innerHTML = '<span>Digite o ID do bilhete (ex.: 99S-C03-4821).</span>';
    return;
  }

  resultadoConsultaEl.classList.remove('hidden');
  resultadoConsultaEl.innerHTML = '<span>Consultando bilhete...</span>';

  try {
    const res = await fetch(`/api/bilhete/${encodeURIComponent(idBusca)}`);
    const data = await res.json();

    if (!res.ok) {
      resultadoConsultaEl.innerHTML = `<strong>${data.erro || 'Bilhete não encontrado.'}</strong>`;
      return;
    }

    const cNum = (data.concurso && data.concurso.numero) || '--';
    const cHora = (data.concurso && data.concurso.horario) || '--:--';
    const cData = data.dataCiclo || '--';

    resultadoConsultaEl.innerHTML = `
      <div class="consulta-detalhe">
        <div><strong>ID:</strong> ${data.id}</div>
        <div><strong>Concurso:</strong> #${cNum} • Horário ${cHora} • Data ${cData}</div>
        <div><strong>Dezena escolhida:</strong> ${data.dezena} (DZ • R$ ${Number(data.valor || 2.5).toFixed(2).replace('.', ',')})</div>
        <div><strong>Situação:</strong> ${data.statusApuracao}</div>
      </div>
    `;
  } catch (_) {
    resultadoConsultaEl.innerHTML = '<span>Erro ao consultar o bilhete. Tente novamente.</span>';
  }
}

if (btnBuscarIdEl) {
  btnBuscarIdEl.addEventListener('click', consultarBilhetePorId);
}

if (inputBuscaIdEl) {
  inputBuscaIdEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      consultarBilhetePorId();
    }
  });
}

if (btnAbrirConsultaTopEl && inputBuscaIdEl) {
  btnAbrirConsultaTopEl.addEventListener('click', () => {
    inputBuscaIdEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    inputBuscaIdEl.focus();
  });
}

if (btnCopiarLinkEl) {
  btnCopiarLinkEl.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      btnCopiarLinkEl.textContent = 'LINK COPIADO ✓';
      setTimeout(() => {
        btnCopiarLinkEl.textContent = 'COPIAR LINK DE CONVITE';
      }, 1800);
    } catch (_) {
      alert(window.location.href);
    }
  });
}

if (qrConviteAmigosEl) {
  qrConviteAmigosEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(window.location.href)}`;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pararAgentesModal();
  } else if (concursoAtivo) {
    iniciarAgentesModal(concursoAtivo);
  }
});

montarGradeDezenas();
configurarControlesCarrossel();
sincronizarConcursosAtivos(true);
atualizarCronometros();
iniciarLoopCarrossel();
setInterval(atualizarCronometros, 1000);
