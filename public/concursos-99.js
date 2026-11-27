const HORARIOS_15_PADRAO = [
  { id: '0810', numero: '01', horario: '08:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '0910', numero: '02', horario: '09:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '1010', numero: '03', horario: '10:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '1110', numero: '04', horario: '11:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '1210', numero: '05', horario: '12:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '1310', numero: '06', horario: '13:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '1410', numero: '07', horario: '14:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '1510', numero: '08', horario: '15:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '1610', numero: '09', horario: '16:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '1710', numero: '10', horario: '17:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '1810', numero: '11', horario: '18:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '1910', numero: '12', horario: '19:10', premio: 'R$ 50,00', valor: 2.5 },
  { id: '1945', numero: '13', horario: '19:45', premio: 'R$ 50,00', valor: 2.5 },
  { id: '2050', numero: '14', horario: '20:50', premio: 'R$ 50,00', valor: 2.5 },
  { id: '2110', numero: '15', horario: '21:10', premio: 'R$ 50,00', valor: 2.5 }
];

let estadoApp = {
  concursos: HORARIOS_15_PADRAO.map(h => ({ ...h, resultado: null })),
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

// Controle do carrossel infinito com movimento manual + retorno automático
let animacaoCarrosselId = null;
let pausaManualAte = 0;
let modoPausadoManual = false;
let arrastandoCarrossel = false;
let inicioXArrasto = 0;
let scrollInicialArrasto = 0;
let moveuDuranteArrasto = false;

document.addEventListener('DOMContentLoaded', () => {
  gerarGridDezenas();
  configurarQrCodeRodape();
  configurarControlesCarrossel();
  renderizarGradeConcursos();
  iniciarLoopCarrossel();
  carregarEstadoServidor();
  configurarEventos();

  setInterval(carregarEstadoServidor, 15000);
  agendarProximoBalao();
});

function obterConcursos15() {
  const mapaServidor = new Map(
    (estadoApp.concursos || []).map(c => [String(c.horario), c])
  );

  return HORARIOS_15_PADRAO.map((base, idx) => {
    const servidor = mapaServidor.get(base.horario) || (estadoApp.concursos && estadoApp.concursos[idx]) || {};
    return {
      ...base,
      resultado: servidor.resultado || null,
      valor: Number(servidor.valor || base.valor),
      premio: 'R$ 50,00'
    };
  });
}

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
    if (!resp.ok) return;
    const dados = await resp.json();
    estadoApp = {
      ...estadoApp,
      ...dados
    };
    renderizarGradeConcursos();
    rotacionarBalaoAgente();

    if (concursoSelecionado) {
      const listaAtual = obterConcursos15();
      const atualizado = listaAtual.find(c => c.id === concursoSelecionado.id || c.horario === concursoSelecionado.horario);
      if (atualizado) {
        concursoSelecionado = atualizado;
        atualizarTextoResultadoModal(atualizado);
      }
    }
  } catch (err) {
    console.error('Erro ao sincronizar estado:', err);
  }
}

function montarCardConcursoHtml(c) {
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
}

function renderizarGradeConcursos() {
  const container = document.getElementById('lista-concursos');
  const viewport = document.getElementById('carrossel-concursos');
  if (!container || !viewport) return;

  const lista = obterConcursos15();
  const scrollAnterior = viewport.scrollLeft;

  container.innerHTML = lista.map(montarCardConcursoHtml).join('') + lista.map(montarCardConcursoHtml).join('');

  if (scrollAnterior > 0) {
    viewport.scrollLeft = scrollAnterior;
  }
}

function pausarTemporariamente(ms = 3500) {
  pausaManualAte = Date.now() + ms;
}

function normalizarScrollInfinito(viewport, container) {
  const metade = container.scrollWidth / 2;
  if (!metade) return;

  if (viewport.scrollLeft >= metade) {
    viewport.scrollLeft -= metade;
  } else if (viewport.scrollLeft <= 0) {
    viewport.scrollLeft += metade;
  }
}

function configurarControlesCarrossel() {
  const viewport = document.getElementById('carrossel-concursos');
  const container = document.getElementById('lista-concursos');
  const btnPrev = document.getElementById('btn-carrossel-prev');
  const btnNext = document.getElementById('btn-carrossel-next');
  const btnToggle = document.getElementById('btn-carrossel-toggle');

  if (!viewport || !container) return;

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      pausarTemporariamente(4000);
      viewport.scrollLeft -= 210;
      normalizarScrollInfinito(viewport, container);
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      pausarTemporariamente(4000);
      viewport.scrollLeft += 210;
      normalizarScrollInfinito(viewport, container);
    });
  }

  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      modoPausadoManual = !modoPausadoManual;
      if (!modoPausadoManual) {
        pausaManualAte = 0;
        btnToggle.textContent = '⏸ PAUSAR';
        btnToggle.classList.remove('ativo');
      } else {
        btnToggle.textContent = '▶ RODAR';
        btnToggle.classList.add('ativo');
      }
    });
  }

  viewport.addEventListener('pointerdown', e => {
    arrastandoCarrossel = true;
    moveuDuranteArrasto = false;
    inicioXArrasto = e.clientX;
    scrollInicialArrasto = viewport.scrollLeft;
    pausarTemporariamente(5000);
  });

  window.addEventListener('pointermove', e => {
    if (!arrastandoCarrossel) return;
    const delta = e.clientX - inicioXArrasto;
    if (Math.abs(delta) > 4) {
      moveuDuranteArrasto = true;
    }
    viewport.scrollLeft = scrollInicialArrasto - delta;
    normalizarScrollInfinito(viewport, container);
  });

  window.addEventListener('pointerup', () => {
    if (!arrastandoCarrossel) return;
    arrastandoCarrossel = false;
    pausarTemporariamente(3500);
    if (moveuDuranteArrasto) {
      const bloquearClique = ev => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      container.addEventListener('click', bloquearClique, { capture: true, once: true });
      setTimeout(() => {
        container.removeEventListener('click', bloquearClique, { capture: true });
      }, 60);
    }
  });

  viewport.addEventListener('wheel', () => {
    pausarTemporariamente(3500);
    normalizarScrollInfinito(viewport, container);
  }, { passive: true });
}

function iniciarLoopCarrossel() {
  if (animacaoCarrosselId) cancelAnimationFrame(animacaoCarrosselId);

  let ultimoTempo = performance.now();
  const velocidadePxPorSegundo = 34;

  function passo(agora) {
    const dt = Math.min(0.05, (agora - ultimoTempo) / 1000);
    ultimoTempo = agora;

    const viewport = document.getElementById('carrossel-concursos');
    const container = document.getElementById('lista-concursos');
    const modalAberto = !document.getElementById('modal-sorteio')?.classList.contains('hidden');

    if (
      viewport &&
      container &&
      !modoPausadoManual &&
      !arrastandoCarrossel &&
      !modalAberto &&
      Date.now() >= pausaManualAte
    ) {
      viewport.scrollLeft += velocidadePxPorSegundo * dt;
      normalizarScrollInfinito(viewport, container);
    }

    animacaoCarrosselId = requestAnimationFrame(passo);
  }

  animacaoCarrosselId = requestAnimationFrame(passo);
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
  const lista = obterConcursos15();
  const concurso = lista.find(c => c.id === concursoId);
  if (!concurso) return;

  concursoSelecionado = concurso;
  dezenaSelecionada = null;
  document.getElementById('display-dezena-escolhida').textContent = '(01-00) --';
  document.querySelectorAll('.dz-btn').forEach(b => b.classList.remove('selecionada'));

  document.getElementById('modal-concurso-tag').textContent = `CONCURSO #${concurso.numero} • PRÊMIO ${concurso.premio}`;
  document.getElementById('modal-horario').textContent = concurso.horario;
  atualizarTextoResultadoModal(concurso);
  rotacionarBalaoAgente();

  iniciarCronometro(concurso.horario);
  document.getElementById('modal-sorteio').classList.remove('hidden');
};

function atualizarTextoResultadoModal(concurso) {
  const el = document.getElementById('modal-ultimo-resultado');
  if (concurso.resultado) {
    el.innerHTML = `<span class="amarelo-99">DEZENA SORTEADA: ${concurso.resultado}</span>`;
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

  const lista15 = obterConcursos15();
  const horarios = lista15.map(c => c.horario);

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
      ? '<span style="color:#ffcc00;">PAGO / CONFIRMADO</span>'
      : '<span style="color:#ffffff;">QR CODE PROVISÓRIO GERADO</span>';

    let statusResultado = 'Aguardando sorteio do horário';
    if (b.statusSorteio === 'PREMIADO') {
      statusResultado = '<strong style="color:#ffcc00;">🏆 BILHETE PREMIADO!</strong>';
    } else if (b.statusSorteio === 'NAO_PREMIADO') {
      statusResultado = `Não premiado (Dezena sorteada: ${data.resultadoConcurso})`;
    }

    box.innerHTML = `
      <div><strong>ID:</strong> ${b.id} | <strong>Apostador:</strong> ${b.nome}</div>
      <div><strong>Sorteio:</strong> ${b.horario} | <strong>Dezena:</strong> <span class="amarelo-99">${b.dezena}</span></div>
      <div><strong>Pagamento:</strong> ${statusPgto}</div>
      <div><strong>Status:</strong> ${statusResultado}</div>
    `;
  } catch (err) {
    box.classList.remove('hidden');
    box.innerHTML = '<span style="color:#f87171;">Erro ao consultar bilhete.</span>';
  }
}
