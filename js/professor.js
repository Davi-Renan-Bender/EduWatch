// EduWatch — painel do professor com dados das turmas atribuídas no banco.
let dadosProfessor = { alunos: [], turmas: [] };
let graficoFrequenciaProfessor = null;

document.addEventListener("DOMContentLoaded", async () => {
  const usuarioSessao = await exigirPerfil("professor");
  if (!usuarioSessao) return;

  const usuario = obterUsuarioVisualizacao(usuarioSessao, "professor");
  preencherUsuarioNaSidebar(usuario, "Professor");
  inicializarMenuMobile();
  inicializarNavegacaoPorSecao();
  inicializarNotificacoes();
  inicializarFiltrosAlunos();
  inicializarModalAluno();
  carregarNotificacoes();
  await carregarDadosProfessor();
  window.EduWatchFrequencia?.inicializar();
});

function profElemento(tag, texto, classe) {
  const elemento = document.createElement(tag);
  if (texto !== undefined && texto !== null)
    elemento.textContent = String(texto);
  if (classe) elemento.className = classe;
  return elemento;
}

function profTemNumero(valor) {
  return (
    valor !== null &&
    valor !== "" &&
    valor !== undefined &&
    Number.isFinite(Number(valor))
  );
}

function profMedia(valor) {
  return profTemNumero(valor)
    ? Number(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      })
    : "—";
}

function profStatus(situacao) {
  return (
    {
      normal: { rotulo: "Normal", classe: "status-badge--normal" },
      atencao: { rotulo: "Atenção", classe: "status-badge--atencao" },
      critico: { rotulo: "Crítico", classe: "status-badge--critico" },
      sem_dados: { rotulo: "Sem dados", classe: "status-badge--indefinido" },
    }[situacao] || { rotulo: "Sem dados", classe: "status-badge--indefinido" }
  );
}

function profSelo(situacao) {
  const meta = profStatus(situacao);
  const selo = profElemento("span", undefined, `status-badge ${meta.classe}`);
  const ponto = profElemento("span", undefined, "status-dot");
  ponto.setAttribute("aria-hidden", "true");
  selo.append(ponto, profElemento("span", meta.rotulo));
  return selo;
}

function profEstadoTabela(corpo, colunas, mensagem) {
  if (!corpo) return;
  const linha = document.createElement("tr");
  const celula = profElemento("td", mensagem);
  celula.colSpan = colunas;
  linha.append(celula);
  corpo.replaceChildren(linha);
}

async function requisitarPainelProfessor() {
  let resposta;
  try {
    resposta = await fetch("api/academico/painel-professor.php", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (_erro) {
    throw new Error(
      "Não foi possível conectar ao EduWatch. Confira o Apache e tente novamente.",
    );
  }
  let dados;
  try {
    dados = await resposta.json();
  } catch (_erro) {
    throw new Error(
      "O servidor retornou uma resposta inválida ao carregar o painel.",
    );
  }
  if (!resposta.ok || dados.sucesso === false) {
    throw new Error(
      dados.mensagem || "Não foi possível carregar o painel das suas turmas.",
    );
  }
  return dados;
}

async function carregarDadosProfessor() {
  try {
    const dados = await requisitarPainelProfessor();
    dadosProfessor = {
      resumo: dados.resumo || {},
      alunos: Array.isArray(dados.alunos) ? dados.alunos : [],
      turmas: Array.isArray(dados.turmas) ? dados.turmas : [],
    };
    renderResumoProfessor(dadosProfessor.resumo);
    renderTurmas(dadosProfessor.turmas);
    renderGraficoFrequenciaProfessor(dadosProfessor.turmas);
    popularFiltroTurmas(dadosProfessor.turmas);
    aplicarFiltrosAlunos();
    renderTabelaAtencao(dadosProfessor.alunos);
    renderDesempenho(dadosProfessor.alunos);
    window.EduWatchCharts?.renderBar(
      "grafico-medias-turmas",
      dadosProfessor.turmas,
      "Média por turma",
      "Ainda não há notas publicadas nas suas turmas.",
    );
    renderAcompanhamentoProfessor(dadosProfessor.alunos);
  } catch (erro) {
    renderErroProfessor(
      erro.message || "Não foi possível carregar os dados das turmas.",
    );
  }
}

function profKpi(rotulo, valor, detalhe, classe) {
  const card = profElemento(
    "article",
    undefined,
    `kpi-card${classe ? ` ${classe}` : ""}`,
  );
  card.append(
    profElemento("span", rotulo, "kpi-label"),
    profElemento("strong", valor, "kpi-value"),
  );
  if (detalhe) card.append(profElemento("span", detalhe, "kpi-trend"));
  return card;
}

function renderResumoProfessor(resumo) {
  const container = document.getElementById("kpi-resumo-professor");
  if (!container) return;
  container.replaceChildren(
    profKpi("Alunos", resumo.total_alunos || 0, "em turmas atribuídas"),
    profKpi("Turmas", resumo.total_turmas || 0, "ativas"),
    profKpi(
      "Média geral",
      profMedia(resumo.media_geral),
      "notas publicadas, escala 0 a 10",
    ),
    profKpi(
      "Avaliações publicadas",
      resumo.avaliacoes_publicadas || 0,
      "das suas disciplinas",
    ),
    profKpi(
      "Alunos em atenção",
      resumo.alunos_atencao || 0,
      "média abaixo de 7,0",
      (resumo.alunos_atencao || 0) > 0 ? "kpi-card--warning" : "",
    ),
  );
}

function renderTabelaAtencao(alunos) {
  const corpo = document.getElementById("tabela-resumo-atencao-corpo");
  if (!corpo) return;
  const lista = alunos.filter((aluno) =>
    ["atencao", "critico"].includes(aluno.situacao),
  );
  if (!lista.length) {
    profEstadoTabela(
      corpo,
      4,
      "Nenhum aluno com média abaixo de 7,0 nas notas publicadas.",
    );
    return;
  }
  corpo.replaceChildren();
  lista.forEach((aluno) => {
    const linha = document.createElement("tr");
    linha.append(
      profElemento("td", aluno.nome),
      profElemento("td", aluno.turma),
      profElemento("td", profMedia(aluno.media)),
    );
    const situacao = document.createElement("td");
    situacao.append(profSelo(aluno.situacao));
    linha.append(situacao);
    corpo.append(linha);
  });
}

function renderTurmas(turmas) {
  const container = document.getElementById("grade-turmas");
  if (!container) return;
  if (!turmas.length) {
    container.replaceChildren(
      profElemento(
        "p",
        "Nenhuma turma ativa está atribuída ao seu usuário.",
        "academic-empty-message",
      ),
    );
    return;
  }
  container.replaceChildren();
  turmas.forEach((turma) => {
    const card = profElemento("button", undefined, "class-card");
    card.type = "button";
    card.dataset.turmaId = String(turma.id);
    const meta = profElemento("span", undefined, "class-card-meta");
    meta.append(
      profElemento("span", `${turma.total_alunos} aluno(s)`),
      profElemento("span", `Média ${profMedia(turma.media)}`),
    );
    const rodape = profElemento("span", undefined, "class-card-footer");
    const avaliacoes = profElemento(
      "span",
      `${turma.avaliacoes_publicadas} avaliação(ões) publicada(s)`,
      "class-card-meta",
    );
    rodape.append(avaliacoes, profSelo(turma.situacao));
    card.append(
      profElemento("span", turma.nome, "class-card-title"),
      meta,
      rodape,
    );
    card.addEventListener("click", () => irParaAlunosDaTurma(String(turma.id)));
    container.append(card);
  });
}

function renderGraficoFrequenciaProfessor(turmas) {
  const canvas = document.getElementById("grafico-frequencia-professor");
  const mensagem = document.getElementById(
    "grafico-frequencia-professor-vazio",
  );

  if (!canvas) return;

  function mostrarMensagem(texto) {
    if (graficoFrequenciaProfessor) {
      graficoFrequenciaProfessor.destroy();
      graficoFrequenciaProfessor = null;
    }

    canvas.hidden = true;

    if (mensagem) {
      mensagem.textContent = texto;
      mensagem.hidden = false;
    }
  }

  if (typeof Chart === "undefined") {
    mostrarMensagem("Não foi possível carregar o Chart.js.");
    return;
  }

  const turmasValidas = (Array.isArray(turmas) ? turmas : [])
    .filter(
      (turma) =>
        turma.frequencia !== null &&
        turma.frequencia !== undefined &&
        turma.frequencia !== "" &&
        Number.isFinite(Number(turma.frequencia)),
    )
    .slice()
    .sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
    );

  if (turmasValidas.length === 0) {
    mostrarMensagem(
      "Ainda não há registros suficientes para calcular a frequência das suas turmas.",
    );
    return;
  }

  canvas.hidden = false;

  if (mensagem) {
    mensagem.hidden = true;
  }

  const rotulosPercentuais = {
    id: "rotulosFrequenciaProfessor",

    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      const elementos = chart.getDatasetMeta(0).data;
      const valores = chart.data.datasets[0].data;

      ctx.save();
      ctx.font = "600 12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#176fc1";

      elementos.forEach((elemento, indice) => {
        const valor = Number(valores[indice]);

        if (!Number.isFinite(valor)) return;

        const texto =
          valor.toLocaleString("pt-BR", {
            maximumFractionDigits: 1,
          }) + "%";

        const larguraTexto = ctx.measureText(texto).width;

        const x = Math.min(elemento.x + 8, chart.width - larguraTexto - 8);

        ctx.fillText(texto, x, elemento.y);
      });

      ctx.restore();
    },
  };

  const configuracao = {
    type: "bar",

    data: {
      labels: turmasValidas.map((turma) => String(turma.nome || "Turma")),

      datasets: [
        {
          label: "Frequência",
          data: turmasValidas.map((turma) => Number(turma.frequencia)),

          backgroundColor: "#176fc1",
          hoverBackgroundColor: "#0b5fae",

          borderRadius: {
            topLeft: 0,
            bottomLeft: 0,
            topRight: 6,
            bottomRight: 6,
          },

          borderSkipped: false,
          maxBarThickness: 30,
        },
      ],
    },

    plugins: [rotulosPercentuais],

    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,

      layout: {
        padding: {
          right: 48,
          top: 8,
        },
      },

      plugins: {
        legend: {
          display: false,
        },

        tooltip: {
          callbacks: {
            label(context) {
              return (
                " Frequência: " +
                Number(context.raw).toLocaleString("pt-BR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }) +
                "%"
              );
            },
          },
        },
      },

      scales: {
        x: {
          min: 0,
          max: 100,

          title: {
            display: true,
            text: "Frequência (%)",
          },

          ticks: {
            stepSize: 20,
            callback(valor) {
              return valor + "%";
            },
          },

          grid: {
            color: "rgba(148, 163, 184, 0.22)",
          },
        },

        y: {
          ticks: {
            color: "#47627d",
          },

          grid: {
            display: false,
          },
        },
      },
    },
  };

  if (graficoFrequenciaProfessor) {
    graficoFrequenciaProfessor.destroy();
  }

  graficoFrequenciaProfessor = new Chart(canvas.getContext("2d"), configuracao);
}

function irParaAlunosDaTurma(turmaId) {
  document.querySelector('.sidebar-link[data-section="alunos"]')?.click();
  const select = document.getElementById("filtro-turma");
  if (select) select.value = turmaId;
  aplicarFiltrosAlunos();
}

function popularFiltroTurmas(turmas) {
  const select = document.getElementById("filtro-turma");
  if (!select) return;
  const selecionado = select.value;
  select.replaceChildren(profElemento("option", "Todas as turmas"));
  turmas.forEach((turma) => {
    const opcao = profElemento("option", turma.nome);
    opcao.value = String(turma.id);
    select.append(opcao);
  });
  select.value = selecionado;
}

function inicializarFiltrosAlunos() {
  [
    "busca-aluno",
    "filtro-turma",
    "filtro-situacao",
    "filtro-desempenho",
  ].forEach((id) => {
    const campo = document.getElementById(id);
    if (campo) campo.addEventListener("input", aplicarFiltrosAlunos);
    if (campo && campo.tagName === "SELECT")
      campo.addEventListener("change", aplicarFiltrosAlunos);
  });
}

function aplicarFiltrosAlunos() {
  const termo = (document.getElementById("busca-aluno")?.value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
  const turmaId = document.getElementById("filtro-turma")?.value || "";
  const situacao = document.getElementById("filtro-situacao")?.value || "";
  const desempenho = document.getElementById("filtro-desempenho")?.value || "";
  const alunos = dadosProfessor.alunos.filter((aluno) => {
    if (
      termo &&
      !`${aluno.nome} ${aluno.turma}`.toLocaleLowerCase("pt-BR").includes(termo)
    )
      return false;
    if (turmaId && String(aluno.turma_id) !== turmaId) return false;
    if (situacao && aluno.situacao !== situacao) return false;
    if (
      desempenho === "alto" &&
      (!profTemNumero(aluno.media) || aluno.media < 7)
    )
      return false;
    if (
      desempenho === "medio" &&
      (!profTemNumero(aluno.media) || aluno.media < 5 || aluno.media >= 7)
    )
      return false;
    if (
      desempenho === "baixo" &&
      (!profTemNumero(aluno.media) || aluno.media >= 5)
    )
      return false;
    return true;
  });
  renderTabelaAlunos(alunos);
}

function renderTabelaAlunos(alunos) {
  const corpo = document.getElementById("tabela-alunos-corpo");
  if (!corpo) return;
  if (!alunos.length) {
    profEstadoTabela(
      corpo,
      5,
      "Nenhum aluno encontrado para os filtros selecionados.",
    );
    return;
  }
  corpo.replaceChildren();
  alunos.forEach((aluno) => {
    const linha = document.createElement("tr");
    linha.className = "is-clickable";
    linha.dataset.alunoId = String(aluno.id);
    linha.tabIndex = 0;
    linha.append(
      profElemento("td", aluno.nome),
      profElemento("td", aluno.turma),
      profElemento("td", profMedia(aluno.media)),
      profElemento("td", aluno.avaliacoes_lancadas),
    );
    const situacao = document.createElement("td");
    situacao.append(profSelo(aluno.situacao));
    linha.append(situacao);
    corpo.append(linha);
  });
}

function inicializarModalAluno() {
  const corpo = document.getElementById("tabela-alunos-corpo");
  const fechar = document.getElementById("modal-aluno-fechar");
  const modal = document.getElementById("modal-aluno");
  if (!corpo || !fechar || !modal) return;
  corpo.addEventListener("click", (evento) => {
    const linha = evento.target.closest("tr[data-aluno-id]");
    if (linha) abrirDetalheAluno(Number(linha.dataset.alunoId));
  });
  corpo.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    const linha = evento.target.closest("tr[data-aluno-id]");
    if (linha) abrirDetalheAluno(Number(linha.dataset.alunoId));
  });
  fechar.addEventListener("click", () => fecharModal("modal-aluno"));
  modal.addEventListener("click", (evento) => {
    if (evento.target === modal) fecharModal("modal-aluno");
  });
}

function abrirDetalheAluno(alunoId) {
  const aluno = dadosProfessor.alunos.find(
    (item) => Number(item.id) === alunoId,
  );
  const titulo = document.getElementById("modal-aluno-titulo");
  const corpo = document.getElementById("modal-aluno-corpo");
  if (!aluno || !titulo || !corpo) return;
  titulo.textContent = aluno.nome;
  const lista = document.createElement("dl");
  lista.className = "profile-fields";
  [
    ["Turma", aluno.turma],
    ["Média", profMedia(aluno.media)],
    ["Avaliações lançadas", aluno.avaliacoes_lancadas],
    ["Situação", profStatus(aluno.situacao).rotulo],
  ].forEach(([rotulo, valor]) => {
    const linha = document.createElement("div");
    linha.append(profElemento("dt", rotulo), profElemento("dd", valor));
    lista.append(linha);
  });
  corpo.replaceChildren(lista);
  abrirModal("modal-aluno");
}

function renderDesempenho(alunos) {
  const comMedia = alunos.filter((aluno) => profTemNumero(aluno.media));
  const melhores = [...comMedia].sort((a, b) => b.media - a.media).slice(0, 3);
  const piores = [...comMedia].sort((a, b) => a.media - b.media).slice(0, 3);
  renderRanking(
    "tabela-melhores-medias-corpo",
    melhores,
    "Ainda não há notas publicadas para formar este ranking.",
  );
  renderRanking(
    "tabela-piores-medias-corpo",
    piores,
    "Ainda não há notas publicadas para formar este ranking.",
  );
}

function renderRanking(id, alunos, vazio) {
  const corpo = document.getElementById(id);
  if (!corpo) return;
  if (!alunos.length) {
    profEstadoTabela(corpo, 3, vazio);
    return;
  }
  corpo.replaceChildren();
  alunos.forEach((aluno) => {
    const linha = document.createElement("tr");
    linha.append(
      profElemento("td", aluno.nome),
      profElemento("td", aluno.turma),
      profElemento("td", profMedia(aluno.media)),
    );
    corpo.append(linha);
  });
}

function renderAcompanhamentoProfessor(alunos) {
  const lista = document.getElementById("lista-acompanhamento-professor");
  if (!lista) return;
  const atencao = alunos.filter((aluno) =>
    ["atencao", "critico"].includes(aluno.situacao),
  );
  lista.replaceChildren();
  if (!atencao.length) {
    lista.append(
      profElemento(
        "li",
        "Nenhum aluno com média abaixo de 7,0 nas notas publicadas.",
      ),
    );
    return;
  }
  atencao.forEach((aluno) =>
    lista.append(
      profElemento(
        "li",
        `${aluno.nome} (${aluno.turma}): média ${profMedia(aluno.media)} em avaliações publicadas.`,
        "note-item",
      ),
    ),
  );
}

function renderErroProfessor(mensagem) {
  const kpis = document.getElementById("kpi-resumo-professor");
  if (kpis)
    kpis.replaceChildren(
      profKpi(
        "Dados das turmas",
        "Indisponíveis",
        mensagem,
        "kpi-card--warning",
      ),
    );
  profEstadoTabela(
    document.getElementById("tabela-resumo-atencao-corpo"),
    4,
    mensagem,
  );
  profEstadoTabela(document.getElementById("tabela-alunos-corpo"), 5, mensagem);
  profEstadoTabela(
    document.getElementById("tabela-melhores-medias-corpo"),
    3,
    mensagem,
  );
  profEstadoTabela(
    document.getElementById("tabela-piores-medias-corpo"),
    3,
    mensagem,
  );
  window.EduWatchCharts?.showMessage(
    "grafico-medias-turmas",
    "O gráfico será exibido quando os dados puderem ser carregados.",
  );
}

function carregarNotificacoes() {
  const lista = document.getElementById("notification-list");
  const marcador = document.getElementById("notification-dot");
  if (lista)
    lista.replaceChildren(profElemento("p", "Nenhuma notificação no momento."));
  if (marcador) marcador.hidden = true;
}
