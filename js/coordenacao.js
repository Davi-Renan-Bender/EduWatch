// ==========================================================================
// EduWatch — coordenacao.js
//
// DADOS → LÓGICA → INTERFACE
//
// Quando o backend existir, os blocos marcados com TODO(API) devem ser
// substituídos por chamadas à API.
//
// Exemplos futuros:
//   GET /api/indicadores/escola
//   GET /api/alunos
//   GET /api/professores
//   GET /api/turmas
//   GET /api/acompanhamento
//   GET /api/notificacoes
// ==========================================================================

// --------------------------------------------------------------------------
// DADOS MOCKADOS — substituir por resposta da API
// --------------------------------------------------------------------------

const DADOS_MOCK_COORDENACAO = {
  // Indicadores gerais da escola.
  // No backend real, estes valores virão de consultas agregadas.
  resumo: {
    totalAlunos: 120,
    totalProfessores: 14,
    totalTurmas: 6,
    mediaGeral: 7.1,
    frequenciaMedia: 89,
    alunosNormais: 75,
    alunosAtencao: 32,
    alunosCritico: 13,
  },

  // Turmas da escola.
  turmas: [
    {
      id: "9a",
      nome: "9º Ano A",
      totalAlunos: 28,
      media: 7.3,
      frequencia: 91,
      situacao: "normal",
    },
    {
      id: "9b",
      nome: "9º Ano B",
      totalAlunos: 26,
      media: 6.5,
      frequencia: 86,
      situacao: "atencao",
    },
    {
      id: "8a",
      nome: "8º Ano A",
      totalAlunos: 25,
      media: 6.0,
      frequencia: 80,
      situacao: "critico",
    },
    {
      id: "8b",
      nome: "8º Ano B",
      totalAlunos: 24,
      media: 7.0,
      frequencia: 88,
      situacao: "atencao",
    },
    {
      id: "7a",
      nome: "7º Ano A",
      totalAlunos: 23,
      media: 8.0,
      frequencia: 94,
      situacao: "normal",
    },
    {
      id: "7b",
      nome: "7º Ano B",
      totalAlunos: 22,
      media: 6.8,
      frequencia: 87,
      situacao: "atencao",
    },
  ],

  // Amostra de alunos para fins de protótipo visual.
  // Não representa todos os alunos da escola.
  alunos: [
    {
      id: 1,
      nome: "Davi Oliveira",
      turmaId: "9a",
      turma: "9º Ano A",
      media: 7.4,
      frequencia: 91,
      evolucao: 0.4,
      situacao: "atencao",
      observacoes:
        "Dificuldade identificada em Geometria nas últimas avaliações.",
    },
    {
      id: 2,
      nome: "Larissa Souza",
      turmaId: "9a",
      turma: "9º Ano A",
      media: 8.6,
      frequencia: 96,
      evolucao: 0.2,
      situacao: "normal",
      observacoes: null,
    },
    {
      id: 3,
      nome: "Pedro Almeida",
      turmaId: "9a",
      turma: "9º Ano A",
      media: 5.4,
      frequencia: 82,
      evolucao: -0.3,
      situacao: "critico",
      observacoes:
        "Baixo engajamento nas atividades em sala nas últimas semanas.",
    },
    {
      id: 4,
      nome: "Rafael Costa",
      turmaId: "9b",
      turma: "9º Ano B",
      media: 6.1,
      frequencia: 85,
      evolucao: -0.2,
      situacao: "atencao",
      observacoes: "Dificuldade em interpretação de texto.",
    },
    {
      id: 5,
      nome: "Juliana Ferreira",
      turmaId: "9b",
      turma: "9º Ano B",
      media: 4.8,
      frequencia: 76,
      evolucao: -0.5,
      situacao: "critico",
      observacoes: "Faltas recorrentes às segundas-feiras.",
    },
    {
      id: 6,
      nome: "Gustavo Martins",
      turmaId: "9b",
      turma: "9º Ano B",
      media: 8.2,
      frequencia: 94,
      evolucao: 0.3,
      situacao: "normal",
      observacoes: null,
    },
    {
      id: 7,
      nome: "Camila Rocha",
      turmaId: "8a",
      turma: "8º Ano A",
      media: 6.8,
      frequencia: 88,
      evolucao: 0.1,
      situacao: "atencao",
      observacoes: "Dificuldade em produção textual.",
    },
    {
      id: 8,
      nome: "Bruno Cardoso",
      turmaId: "8a",
      turma: "8º Ano A",
      media: 5.0,
      frequencia: 74,
      evolucao: -0.4,
      situacao: "critico",
      observacoes: "Dificuldade de concentração relatada pelos professores.",
    },
    {
      id: 9,
      nome: "Fernanda Dias",
      turmaId: "8b",
      turma: "8º Ano B",
      media: 7.1,
      frequencia: 90,
      evolucao: 0.2,
      situacao: "normal",
      observacoes: null,
    },
    {
      id: 10,
      nome: "Lucas Pereira",
      turmaId: "8b",
      turma: "8º Ano B",
      media: 6.4,
      frequencia: 81,
      evolucao: 0.0,
      situacao: "atencao",
      observacoes: "Baixa participação nas aulas.",
    },
    {
      id: 11,
      nome: "Isabela Santos",
      turmaId: "7a",
      turma: "7º Ano A",
      media: 8.9,
      frequencia: 97,
      evolucao: 0.5,
      situacao: "normal",
      observacoes: null,
    },
    {
      id: 12,
      nome: "Marcos Lima",
      turmaId: "7b",
      turma: "7º Ano B",
      media: 5.8,
      frequencia: 79,
      evolucao: -0.3,
      situacao: "critico",
      observacoes: "Queda de desempenho e baixa frequência no período recente.",
    },
  ],

  // Professores e os indicadores consolidados das turmas sob responsabilidade.
  professores: [
    {
      id: 1,
      nome: "Carlos Mendes",
      turmaIds: ["9a", "9b"],
      turmas: 2,
      alunos: 54,
      mediaTurmas: 6.9,
      frequenciaMedia: 89,
    },
    {
      id: 2,
      nome: "Mariana Silva",
      turmaIds: ["8a", "8b"],
      turmas: 2,
      alunos: 49,
      mediaTurmas: 6.5,
      frequenciaMedia: 84,
    },
    {
      id: 3,
      nome: "Roberto Alves",
      turmaIds: ["7a"],
      turmas: 1,
      alunos: 23,
      mediaTurmas: 8.0,
      frequenciaMedia: 94,
    },
    {
      id: 4,
      nome: "Ana Paula Costa",
      turmaIds: ["7b"],
      turmas: 1,
      alunos: 22,
      mediaTurmas: 6.8,
      frequenciaMedia: 87,
    },
  ],

  // Evolução da média geral da escola.
  evolucaoEscola: [
    {
      rotulo: "1º bim.",
      valor: 6.6,
    },
    {
      rotulo: "2º bim.",
      valor: 6.8,
    },
    {
      rotulo: "3º bim.",
      valor: 7.0,
    },
    {
      rotulo: "4º bim.",
      valor: 7.1,
    },
  ],
};

let alunosFiltradosCoordenacao = [];

// --------------------------------------------------------------------------
// INICIALIZAÇÃO
// --------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
  const usuarioSessao = exigirPerfil("coordenacao");

  if (!usuarioSessao) {
    return;
  }

  const usuario = obterUsuarioVisualizacao(usuarioSessao, "coordenacao");

  preencherUsuarioNaSidebar(usuario, "Coordenação");

  inicializarMenuMobile();
  inicializarNavegacaoPorSecao();
  inicializarNotificacoes();

  carregarNotificacoes();
  carregarDadosCoordenacao();
  inicializarFiltrosAlunosCoordenacao();
  inicializarModalAlunoCoordenacao();
});

// --------------------------------------------------------------------------
// CARREGAMENTO DOS DADOS
// --------------------------------------------------------------------------

function carregarDadosCoordenacao() {
  // TODO(API):
  // Trocar os dados mockados por chamadas à API.
  //
  // Exemplo futuro:
  // Promise.all([
  //   fetch("/api/indicadores/escola"),
  //   fetch("/api/alunos"),
  //   fetch("/api/professores"),
  //   fetch("/api/turmas"),
  // ])
  //
  // A interface abaixo foi mantida independente da origem dos dados.

  window.setTimeout(function () {
    renderResumoCoordenacao(DADOS_MOCK_COORDENACAO.resumo);

    renderMenoresMedias(DADOS_MOCK_COORDENACAO.turmas);
    renderMenoresFrequencias(DADOS_MOCK_COORDENACAO.turmas);

    popularFiltroTurmasCoordenacao(DADOS_MOCK_COORDENACAO.turmas);

    alunosFiltradosCoordenacao = DADOS_MOCK_COORDENACAO.alunos.slice();

    renderTabelaAlunosCoordenacao(alunosFiltradosCoordenacao);
    renderProfessores(DADOS_MOCK_COORDENACAO.professores);
    renderTurmasCoordenacao(DADOS_MOCK_COORDENACAO.turmas);

    renderSituacoesEscola(DADOS_MOCK_COORDENACAO.resumo);
    renderEvolucaoEscola(DADOS_MOCK_COORDENACAO.evolucaoEscola);
    renderAcompanhamentoCoordenacao(DADOS_MOCK_COORDENACAO.alunos);
  }, 300);
}

// --------------------------------------------------------------------------
// COMPONENTE KPI
// --------------------------------------------------------------------------

function kpiCardCoordenacaoHTML(rotulo, valor, classeExtra) {
  return (
    '<article class="kpi-card' +
    (classeExtra ? " " + classeExtra : "") +
    '">' +
    '<span class="kpi-label">' +
    rotulo +
    "</span>" +
    '<strong class="kpi-value">' +
    valor +
    "</strong>" +
    "</article>"
  );
}

// --------------------------------------------------------------------------
// VISÃO GERAL
// --------------------------------------------------------------------------

function renderResumoCoordenacao(resumo) {
  const container = document.getElementById("kpi-resumo-escola");

  if (!container) {
    return;
  }

  container.innerHTML =
    kpiCardCoordenacaoHTML("Alunos", String(resumo.totalAlunos)) +
    kpiCardCoordenacaoHTML("Professores", String(resumo.totalProfessores)) +
    kpiCardCoordenacaoHTML("Turmas", String(resumo.totalTurmas)) +
    kpiCardCoordenacaoHTML("Média geral", resumo.mediaGeral.toFixed(1)) +
    kpiCardCoordenacaoHTML("Frequência média", resumo.frequenciaMedia + "%") +
    kpiCardCoordenacaoHTML(
      "Alunos em atenção",
      String(resumo.alunosAtencao),
      "kpi-card--warning",
    ) +
    kpiCardCoordenacaoHTML(
      "Alunos em situação crítica",
      String(resumo.alunosCritico),
      "kpi-card--danger",
    );
}

function renderMenoresMedias(turmas) {
  const corpo = document.getElementById("tabela-menor-media-corpo");

  if (!corpo) {
    return;
  }

  if (!turmas || turmas.length === 0) {
    corpo.innerHTML =
      '<tr><td colspan="2">' +
      estadoVazioHTML("Nenhuma turma encontrada.") +
      "</td></tr>";
    return;
  }

  const menores = turmas
    .slice()
    .sort(function (a, b) {
      return a.media - b.media;
    })
    .slice(0, 3);

  corpo.innerHTML = menores
    .map(function (turma) {
      return (
        "<tr>" +
        "<td>" +
        turma.nome +
        "</td>" +
        "<td>" +
        turma.media.toFixed(1) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function renderMenoresFrequencias(turmas) {
  const corpo = document.getElementById("tabela-menor-frequencia-corpo");

  if (!corpo) {
    return;
  }

  if (!turmas || turmas.length === 0) {
    corpo.innerHTML =
      '<tr><td colspan="2">' +
      estadoVazioHTML("Nenhuma turma encontrada.") +
      "</td></tr>";
    return;
  }

  const menores = turmas
    .slice()
    .sort(function (a, b) {
      return a.frequencia - b.frequencia;
    })
    .slice(0, 3);

  corpo.innerHTML = menores
    .map(function (turma) {
      return (
        "<tr>" +
        "<td>" +
        turma.nome +
        "</td>" +
        "<td>" +
        turma.frequencia +
        "%" +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

// --------------------------------------------------------------------------
// ALUNOS
// --------------------------------------------------------------------------

function popularFiltroTurmasCoordenacao(turmas) {
  const select = document.getElementById("filtro-turma-coord");

  if (!select) {
    return;
  }

  turmas.forEach(function (turma) {
    const opcao = document.createElement("option");

    opcao.value = turma.id;
    opcao.textContent = turma.nome;

    select.appendChild(opcao);
  });
}

function inicializarFiltrosAlunosCoordenacao() {
  const busca = document.getElementById("busca-aluno-coord");
  const filtroTurma = document.getElementById("filtro-turma-coord");
  const filtroSituacao = document.getElementById("filtro-situacao-coord");

  [busca, filtroTurma, filtroSituacao].forEach(function (campo) {
    if (!campo) {
      return;
    }

    campo.addEventListener("input", aplicarFiltrosAlunosCoordenacao);

    campo.addEventListener("change", aplicarFiltrosAlunosCoordenacao);
  });
}

function aplicarFiltrosAlunosCoordenacao() {
  const buscaEl = document.getElementById("busca-aluno-coord");
  const turmaEl = document.getElementById("filtro-turma-coord");
  const situacaoEl = document.getElementById("filtro-situacao-coord");

  const termo = buscaEl ? (buscaEl.value || "").trim().toLowerCase() : "";

  const turmaId = turmaEl ? turmaEl.value : "";
  const situacao = situacaoEl ? situacaoEl.value : "";

  alunosFiltradosCoordenacao = DADOS_MOCK_COORDENACAO.alunos.filter(
    function (aluno) {
      const combinaBusca =
        !termo || aluno.nome.toLowerCase().indexOf(termo) !== -1;

      const combinaTurma = !turmaId || aluno.turmaId === turmaId;

      const combinaSituacao = !situacao || aluno.situacao === situacao;

      return combinaBusca && combinaTurma && combinaSituacao;
    },
  );

  renderTabelaAlunosCoordenacao(alunosFiltradosCoordenacao);
}

function renderTabelaAlunosCoordenacao(lista) {
  const corpo = document.getElementById("tabela-alunos-coord-corpo");

  if (!corpo) {
    return;
  }

  if (!lista || lista.length === 0) {
    corpo.innerHTML =
      '<tr><td colspan="5">' +
      estadoVazioHTML("Nenhum aluno encontrado para os filtros selecionados.") +
      "</td></tr>";

    return;
  }

  corpo.innerHTML = lista
    .map(function (aluno) {
      return (
        '<tr class="is-clickable" data-aluno-id="' +
        aluno.id +
        '" tabindex="0">' +
        "<td>" +
        aluno.nome +
        "</td>" +
        "<td>" +
        aluno.turma +
        "</td>" +
        "<td>" +
        aluno.media.toFixed(1) +
        "</td>" +
        "<td>" +
        aluno.frequencia +
        "%" +
        "</td>" +
        "<td>" +
        selosituacaoHTML(aluno.situacao) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

// --------------------------------------------------------------------------
// PROFESSORES
// --------------------------------------------------------------------------

function renderProfessores(professores) {
  const corpo = document.getElementById("tabela-professores-corpo");

  if (!corpo) {
    return;
  }

  if (!professores || professores.length === 0) {
    corpo.innerHTML =
      '<tr><td colspan="5">' +
      estadoVazioHTML("Nenhum professor encontrado.") +
      "</td></tr>";

    return;
  }

  corpo.innerHTML = professores
    .map(function (professor) {
      return (
        "<tr>" +
        "<td>" +
        professor.nome +
        "</td>" +
        "<td>" +
        professor.turmas +
        "</td>" +
        "<td>" +
        professor.alunos +
        "</td>" +
        "<td>" +
        professor.mediaTurmas.toFixed(1) +
        "</td>" +
        "<td>" +
        professor.frequenciaMedia +
        "%" +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

// --------------------------------------------------------------------------
// TURMAS
// --------------------------------------------------------------------------

function renderTurmasCoordenacao(turmas) {
  const container = document.getElementById("grade-turmas-coord");

  if (!container) {
    return;
  }

  if (!turmas || turmas.length === 0) {
    container.innerHTML = estadoVazioHTML("Nenhuma turma encontrada.");

    return;
  }

  container.innerHTML = turmas
    .map(function (turma) {
      return (
        '<button class="class-card" type="button" data-turma-id="' +
        turma.id +
        '">' +
        '<span class="class-card-title">' +
        turma.nome +
        "</span>" +
        '<span class="class-card-meta">' +
        "<span>" +
        turma.totalAlunos +
        " alunos</span>" +
        "<span>Média " +
        turma.media.toFixed(1) +
        "</span>" +
        "</span>" +
        '<span class="class-card-footer">' +
        '<span class="class-card-meta">' +
        "<span>Frequência " +
        turma.frequencia +
        "%</span>" +
        "</span>" +
        selosituacaoHTML(turma.situacao) +
        "</span>" +
        "</button>"
      );
    })
    .join("");

  container.querySelectorAll(".class-card").forEach(function (card) {
    card.addEventListener("click", function () {
      irParaAlunosDaTurmaCoordenacao(card.getAttribute("data-turma-id"));
    });
  });
}

function irParaAlunosDaTurmaCoordenacao(turmaId) {
  const linkAlunos = document.querySelector(
    '.sidebar-link[data-section="alunos"]',
  );

  if (linkAlunos) {
    linkAlunos.click();
  }

  const selectTurma = document.getElementById("filtro-turma-coord");

  if (selectTurma) {
    selectTurma.value = turmaId;
  }

  aplicarFiltrosAlunosCoordenacao();
}

// --------------------------------------------------------------------------
// INDICADORES
// --------------------------------------------------------------------------

function renderSituacoesEscola(resumo) {
  const container = document.getElementById("kpi-situacao-escola");

  if (!container) {
    return;
  }

  container.innerHTML =
    kpiCardCoordenacaoHTML("Normal", String(resumo.alunosNormais)) +
    kpiCardCoordenacaoHTML(
      "Atenção",
      String(resumo.alunosAtencao),
      "kpi-card--warning",
    ) +
    kpiCardCoordenacaoHTML(
      "Crítico",
      String(resumo.alunosCritico),
      "kpi-card--danger",
    );
}

function renderEvolucaoEscola(evolucao) {
  const container = document.getElementById("grafico-evolucao-escola");

  if (!container) {
    return;
  }

  if (!evolucao || evolucao.length === 0) {
    container.innerHTML = estadoVazioHTML(
      "Ainda não há histórico suficiente para exibir a evolução.",
    );

    return;
  }

  // A escala da média escolar vai de 0 a 10.
  const valorMaximo = 10;

  container.innerHTML = evolucao
    .map(function (bimestre) {
      const altura = Math.max(
        8,
        Math.round((bimestre.valor / valorMaximo) * 100),
      );

      return (
        '<div class="mini-chart-bar">' +
        '<span class="mini-chart-value">' +
        bimestre.valor.toFixed(1) +
        "</span>" +
        '<div class="mini-chart-fill" style="height: ' +
        altura +
        '%"></div>' +
        '<span class="mini-chart-label">' +
        bimestre.rotulo +
        "</span>" +
        "</div>"
      );
    })
    .join("");
}

// --------------------------------------------------------------------------
// ACOMPANHAMENTO
// --------------------------------------------------------------------------

function renderAcompanhamentoCoordenacao(alunos) {
  const lista = document.getElementById("lista-acompanhamento-coord");

  if (!lista) {
    return;
  }

  const alunosParaAcompanhar = alunos.filter(function (aluno) {
    return aluno.situacao !== "normal";
  });

  if (alunosParaAcompanhar.length === 0) {
    lista.innerHTML =
      "<li>" +
      estadoVazioHTML("Nenhum aluno exige acompanhamento no momento.") +
      "</li>";

    return;
  }

  lista.innerHTML = alunosParaAcompanhar
    .map(function (aluno) {
      const observacao = aluno.observacoes || "Sem observação registrada.";

      return (
        '<li class="note-item">' +
        iconeSvg("alerta") +
        "<span><strong>" +
        aluno.nome +
        "</strong> (" +
        aluno.turma +
        ") — " +
        observacao +
        "</span></li>"
      );
    })
    .join("");
}

// --------------------------------------------------------------------------
// MODAL DE ALUNO
// --------------------------------------------------------------------------

function inicializarModalAlunoCoordenacao() {
  const corpoTabela = document.getElementById("tabela-alunos-coord-corpo");

  const botaoFechar = document.getElementById("modal-aluno-fechar");

  const modal = document.getElementById("modal-aluno");

  if (!corpoTabela || !botaoFechar || !modal) {
    return;
  }

  corpoTabela.addEventListener("click", function (evento) {
    const linha = evento.target.closest("tr[data-aluno-id]");

    if (!linha) {
      return;
    }

    abrirDetalheAlunoCoordenacao(Number(linha.getAttribute("data-aluno-id")));
  });

  corpoTabela.addEventListener("keydown", function (evento) {
    if (evento.key !== "Enter") {
      return;
    }

    const linha = evento.target.closest("tr[data-aluno-id]");

    if (!linha) {
      return;
    }

    abrirDetalheAlunoCoordenacao(Number(linha.getAttribute("data-aluno-id")));
  });

  botaoFechar.addEventListener("click", function () {
    fecharModal("modal-aluno");
  });

  modal.addEventListener("click", function (evento) {
    if (evento.target.id === "modal-aluno") {
      fecharModal("modal-aluno");
    }
  });
}

function abrirDetalheAlunoCoordenacao(alunoId) {
  const aluno = DADOS_MOCK_COORDENACAO.alunos.find(function (item) {
    return item.id === alunoId;
  });

  if (!aluno) {
    return;
  }

  const titulo = document.getElementById("modal-aluno-titulo");

  const corpo = document.getElementById("modal-aluno-corpo");

  if (!titulo || !corpo) {
    return;
  }

  titulo.textContent = aluno.nome;

  const sinalEvolucao = aluno.evolucao >= 0 ? "+" : "";

  corpo.innerHTML =
    '<div class="modal-kpis">' +
    kpiCardCoordenacaoHTML("Turma", aluno.turma) +
    kpiCardCoordenacaoHTML("Média", aluno.media.toFixed(1)) +
    kpiCardCoordenacaoHTML("Frequência", aluno.frequencia + "%") +
    kpiCardCoordenacaoHTML(
      "Evolução",
      sinalEvolucao + aluno.evolucao.toFixed(1),
    ) +
    "</div>" +
    '<div class="modal-section">' +
    "<h3>Situação de acompanhamento</h3>" +
    selosituacaoHTML(aluno.situacao) +
    "</div>" +
    '<div class="modal-section">' +
    "<h3>Observações pedagógicas</h3>" +
    '<p class="modal-observacao">' +
    (aluno.observacoes || "Nenhuma observação registrada até o momento.") +
    "</p>" +
    "</div>";

  abrirModal("modal-aluno");
}

// --------------------------------------------------------------------------
// NOTIFICAÇÕES
// --------------------------------------------------------------------------

function carregarNotificacoes() {
  // TODO(API): trocar por fetch("/api/notificacoes")

  const notificacoes = [
    {
      titulo: "Novo aluno em situação crítica",
      detalhe: "Juliana Ferreira — 9º Ano B",
    },
    {
      titulo: "Frequência abaixo do esperado",
      detalhe: "8º Ano A — frequência média de 80%",
    },
    {
      titulo: "Queda de desempenho identificada",
      detalhe: "7º Ano B — redução de 0,3 ponto na média",
    },
  ];

  const lista = document.getElementById("notification-list");

  const marcador = document.getElementById("notification-dot");

  if (!lista) {
    return;
  }

  if (!notificacoes.length) {
    lista.innerHTML = estadoVazioHTML("Nenhuma notificação no momento.");

    if (marcador) {
      marcador.hidden = true;
    }

    return;
  }

  if (marcador) {
    marcador.hidden = false;
  }

  lista.innerHTML = notificacoes
    .map(function (notificacao) {
      return (
        '<div class="notification-item">' +
        "<strong>" +
        notificacao.titulo +
        "</strong>" +
        "<span>" +
        notificacao.detalhe +
        "</span>" +
        "</div>"
      );
    })
    .join("");
}
