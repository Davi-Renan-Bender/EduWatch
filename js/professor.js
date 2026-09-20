// ==========================================================================
// EduWatch — professor.js
//
// DADOS → LÓGICA → INTERFACE
//
// Quando o backend existir, os blocos marcados com TODO(API) devem ser
// trocados por chamadas a, por exemplo:
//   GET /api/indicadores?professorId=:id   -> DADOS_MOCK_PROFESSOR.resumo
//   GET /api/turmas?professorId=:id        -> DADOS_MOCK_PROFESSOR.turmas
//   GET /api/alunos?professorId=:id        -> DADOS_MOCK_PROFESSOR.alunos
// ==========================================================================

// --------------------------------------------------------------------------
// DADOS MOCKADOS — substituir por resposta da API
// --------------------------------------------------------------------------
const DADOS_MOCK_PROFESSOR = {
  // Indicadores agregados: no backend real, estes números vêm prontos da API
  // e não precisam bater com a soma da lista de amostra abaixo.
  resumo: {
    totalAlunos: 79,
    totalTurmas: 3,
    mediaGeral: 6.6,
    frequenciaMedia: 86,
    alunosAtencao: 9,
    alunosCritico: 4,
  },

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
  ],

  // Amostra de alunos para fins de protótipo visual (não é a turma inteira).
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
      nome: "Beatriz Lima",
      turmaId: "9a",
      turma: "9º Ano A",
      media: 7.9,
      frequencia: 93,
      evolucao: 0.1,
      situacao: "normal",
      observacoes: null,
    },
    {
      id: 5,
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
      id: 6,
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
      id: 7,
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
      id: 8,
      nome: "Camila Rocha",
      turmaId: "9b",
      turma: "9º Ano B",
      media: 6.8,
      frequencia: 88,
      evolucao: 0.1,
      situacao: "atencao",
      observacoes: "Dificuldade em produção textual.",
    },
    {
      id: 9,
      nome: "Bruno Cardoso",
      turmaId: "8a",
      turma: "8º Ano A",
      media: 5.0,
      frequencia: 74,
      evolucao: -0.4,
      situacao: "critico",
      observacoes:
        "Dificuldade de concentração relatada pelos professores das demais disciplinas.",
    },
    {
      id: 10,
      nome: "Fernanda Dias",
      turmaId: "8a",
      turma: "8º Ano A",
      media: 7.1,
      frequencia: 90,
      evolucao: 0.2,
      situacao: "normal",
      observacoes: null,
    },
    {
      id: 11,
      nome: "Lucas Pereira",
      turmaId: "8a",
      turma: "8º Ano A",
      media: 6.4,
      frequencia: 81,
      evolucao: 0.0,
      situacao: "atencao",
      observacoes: "Baixa participação nas aulas.",
    },
    {
      id: 12,
      nome: "Isabela Santos",
      turmaId: "8a",
      turma: "8º Ano A",
      media: 8.9,
      frequencia: 97,
      evolucao: 0.5,
      situacao: "normal",
      observacoes: null,
    },
  ],
};

let alunosFiltrados = [];

document.addEventListener("DOMContentLoaded", function () {
  const usuario = exigirPerfil("professor");
  if (!usuario) return;

  preencherUsuarioNaSidebar(usuario, "Professor");
  inicializarMenuMobile();
  inicializarNavegacaoPorSecao();
  inicializarNotificacoes();

  carregarNotificacoes();
  carregarDadosProfessor();
  inicializarFiltrosAlunos();
  inicializarModalAluno();
});

function carregarDadosProfessor() {
  // TODO(API): trocar por fetch('/api/indicadores'), fetch('/api/turmas'), fetch('/api/alunos')
  window.setTimeout(function () {
    renderResumoProfessor(DADOS_MOCK_PROFESSOR.resumo);
    renderTabelaAtencao(DADOS_MOCK_PROFESSOR.alunos);
    renderTurmas(DADOS_MOCK_PROFESSOR.turmas);
    popularFiltroTurmas(DADOS_MOCK_PROFESSOR.turmas);

    alunosFiltrados = DADOS_MOCK_PROFESSOR.alunos.slice();
    renderTabelaAlunos(alunosFiltrados);

    renderDesempenho(DADOS_MOCK_PROFESSOR.alunos);
    renderFrequenciaTurmas(DADOS_MOCK_PROFESSOR.turmas);
    renderAcompanhamentoProfessor(DADOS_MOCK_PROFESSOR.alunos);
  }, 300);
}

function renderResumoProfessor(resumo) {
  const container = document.getElementById("kpi-resumo-professor");
  container.innerHTML =
    kpiCardHTML("Alunos", String(resumo.totalAlunos)) +
    kpiCardHTML("Turmas", String(resumo.totalTurmas)) +
    kpiCardHTML("Média geral", resumo.mediaGeral.toFixed(1)) +
    kpiCardHTML("Frequência média", resumo.frequenciaMedia + "%") +
    kpiCardHTML(
      "Alunos em atenção",
      String(resumo.alunosAtencao),
      "kpi-card--warning",
    ) +
    kpiCardHTML(
      "Alunos em situação crítica",
      String(resumo.alunosCritico),
      "kpi-card--danger",
    );
}

function kpiCardHTML(rotulo, valor, classeExtra) {
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

function renderTabelaAtencao(alunos) {
  const corpo = document.getElementById("tabela-resumo-atencao-corpo");
  const listaAtencao = alunos.filter(function (a) {
    return a.situacao !== "normal";
  });

  if (listaAtencao.length === 0) {
    corpo.innerHTML =
      '<tr><td colspan="4">' +
      estadoVazioHTML("Nenhum aluno em atenção no momento.") +
      "</td></tr>";
    return;
  }

  corpo.innerHTML = listaAtencao
    .map(function (a) {
      return (
        "<tr>" +
        "<td>" +
        a.nome +
        "</td>" +
        "<td>" +
        a.turma +
        "</td>" +
        "<td>" +
        a.media.toFixed(1) +
        "</td>" +
        "<td>" +
        selosituacaoHTML(a.situacao) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function renderTurmas(turmas) {
  const container = document.getElementById("grade-turmas");

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
        '<span class="class-card-meta"><span>' +
        turma.totalAlunos +
        " alunos</span><span>Média " +
        turma.media.toFixed(1) +
        "</span></span>" +
        '<span class="class-card-footer"><span class="class-card-meta"><span>Frequência ' +
        turma.frequencia +
        "%</span></span>" +
        selosituacaoHTML(turma.situacao) +
        "</span></button>"
      );
    })
    .join("");

  container.querySelectorAll(".class-card").forEach(function (card) {
    card.addEventListener("click", function () {
      irParaAlunosDaTurma(card.getAttribute("data-turma-id"));
    });
  });
}

function irParaAlunosDaTurma(turmaId) {
  const linkAlunos = document.querySelector(
    '.sidebar-link[data-section="alunos"]',
  );
  if (linkAlunos) linkAlunos.click();

  const selectTurma = document.getElementById("filtro-turma");
  if (selectTurma) selectTurma.value = turmaId;

  aplicarFiltrosAlunos();
}

function popularFiltroTurmas(turmas) {
  const select = document.getElementById("filtro-turma");
  turmas.forEach(function (turma) {
    const opcao = document.createElement("option");
    opcao.value = turma.id;
    opcao.textContent = turma.nome;
    select.appendChild(opcao);
  });
}

function inicializarFiltrosAlunos() {
  const busca = document.getElementById("busca-aluno");
  const filtroTurma = document.getElementById("filtro-turma");
  const filtroSituacao = document.getElementById("filtro-situacao");
  const filtroDesempenho = document.getElementById("filtro-desempenho");

  [busca, filtroTurma, filtroSituacao, filtroDesempenho].forEach(
    function (campo) {
      if (campo) campo.addEventListener("input", aplicarFiltrosAlunos);
    },
  );
}

function aplicarFiltrosAlunos() {
  const termo = (document.getElementById("busca-aluno").value || "")
    .trim()
    .toLowerCase();
  const turmaId = document.getElementById("filtro-turma").value;
  const situacao = document.getElementById("filtro-situacao").value;
  const desempenho = document.getElementById("filtro-desempenho").value;

  alunosFiltrados = DADOS_MOCK_PROFESSOR.alunos.filter(function (aluno) {
    const combinaBusca =
      !termo || aluno.nome.toLowerCase().indexOf(termo) !== -1;
    const combinaTurma = !turmaId || aluno.turmaId === turmaId;
    const combinaSituacao = !situacao || aluno.situacao === situacao;

    let combinaDesempenho = true;
    if (desempenho === "alto") combinaDesempenho = aluno.media >= 7;
    if (desempenho === "medio")
      combinaDesempenho = aluno.media >= 5 && aluno.media < 7;
    if (desempenho === "baixo") combinaDesempenho = aluno.media < 5;

    return combinaBusca && combinaTurma && combinaSituacao && combinaDesempenho;
  });

  renderTabelaAlunos(alunosFiltrados);
}

function renderTabelaAlunos(lista) {
  const corpo = document.getElementById("tabela-alunos-corpo");

  if (!lista || lista.length === 0) {
    corpo.innerHTML =
      '<tr><td colspan="6">' +
      estadoVazioHTML("Nenhum aluno encontrado para os filtros selecionados.") +
      "</td></tr>";
    return;
  }

  corpo.innerHTML = lista
    .map(function (aluno) {
      const sinalEvolucao = aluno.evolucao >= 0 ? "+" : "";
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
        "%</td>" +
        "<td>" +
        sinalEvolucao +
        aluno.evolucao.toFixed(1) +
        "</td>" +
        "<td>" +
        selosituacaoHTML(aluno.situacao) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function inicializarModalAluno() {
  const corpoTabela = document.getElementById("tabela-alunos-corpo");
  const botaoFechar = document.getElementById("modal-aluno-fechar");

  corpoTabela.addEventListener("click", function (evento) {
    const linha = evento.target.closest("tr[data-aluno-id]");
    if (linha) abrirDetalheAluno(Number(linha.getAttribute("data-aluno-id")));
  });

  corpoTabela.addEventListener("keydown", function (evento) {
    if (evento.key !== "Enter") return;
    const linha = evento.target.closest("tr[data-aluno-id]");
    if (linha) abrirDetalheAluno(Number(linha.getAttribute("data-aluno-id")));
  });

  botaoFechar.addEventListener("click", function () {
    fecharModal("modal-aluno");
  });

  document
    .getElementById("modal-aluno")
    .addEventListener("click", function (evento) {
      if (evento.target.id === "modal-aluno") fecharModal("modal-aluno");
    });
}

function abrirDetalheAluno(alunoId) {
  const aluno = DADOS_MOCK_PROFESSOR.alunos.find(function (a) {
    return a.id === alunoId;
  });
  if (!aluno) return;

  document.getElementById("modal-aluno-titulo").textContent = aluno.nome;

  const sinalEvolucao = aluno.evolucao >= 0 ? "+" : "";

  document.getElementById("modal-aluno-corpo").innerHTML =
    '<div class="modal-kpis">' +
    kpiCardHTML("Turma", aluno.turma) +
    kpiCardHTML("Média", aluno.media.toFixed(1)) +
    kpiCardHTML("Frequência", aluno.frequencia + "%") +
    kpiCardHTML("Evolução", sinalEvolucao + aluno.evolucao.toFixed(1)) +
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

function renderDesempenho(alunos) {
  const ordenadosDesc = alunos.slice().sort(function (a, b) {
    return b.media - a.media;
  });

  const melhores = ordenadosDesc.slice(0, 3);
  const piores = ordenadosDesc.slice(-3).reverse();

  document.getElementById("tabela-melhores-medias-corpo").innerHTML = melhores
    .map(function (a) {
      return (
        "<tr><td>" +
        a.nome +
        "</td><td>" +
        a.turma +
        "</td><td>" +
        a.media.toFixed(1) +
        "</td></tr>"
      );
    })
    .join("");

  document.getElementById("tabela-piores-medias-corpo").innerHTML = piores
    .map(function (a) {
      return (
        "<tr><td>" +
        a.nome +
        "</td><td>" +
        a.turma +
        "</td><td>" +
        a.media.toFixed(1) +
        "</td></tr>"
      );
    })
    .join("");
}

function renderFrequenciaTurmas(turmas) {
  const grafico = document.getElementById("grafico-frequencia-turmas");
  const valorMaximo = 100;

  grafico.innerHTML = turmas
    .map(function (turma) {
      const altura = Math.max(
        8,
        Math.round((turma.frequencia / valorMaximo) * 100),
      );
      return (
        '<div class="mini-chart-bar">' +
        '<span class="mini-chart-value">' +
        turma.frequencia +
        "%</span>" +
        '<div class="mini-chart-fill mini-chart-fill--' +
        turma.situacao +
        '" style="height: ' +
        altura +
        '%"></div>' +
        '<span class="mini-chart-label">' +
        turma.nome +
        "</span>" +
        "</div>"
      );
    })
    .join("");

  document.getElementById("tabela-frequencia-turmas-corpo").innerHTML = turmas
    .map(function (turma) {
      return (
        "<tr><td>" +
        turma.nome +
        "</td><td>" +
        turma.frequencia +
        "%</td><td>" +
        selosituacaoHTML(turma.situacao) +
        "</td></tr>"
      );
    })
    .join("");
}

function renderAcompanhamentoProfessor(alunos) {
  const lista = document.getElementById("lista-acompanhamento-professor");
  const alunosParaAcompanhar = alunos.filter(function (a) {
    return a.situacao !== "normal";
  });

  if (alunosParaAcompanhar.length === 0) {
    lista.innerHTML =
      "<li>" +
      estadoVazioHTML("Nenhum aluno exige acompanhamento no momento.") +
      "</li>";
    return;
  }

  lista.innerHTML = alunosParaAcompanhar
    .map(function (a) {
      const observacao = a.observacoes || "Sem observação registrada.";
      return (
        '<li class="note-item">' +
        iconeSvg("alerta") +
        "<span><strong>" +
        a.nome +
        "</strong> (" +
        a.turma +
        ") — " +
        observacao +
        "</span></li>"
      );
    })
    .join("");
}

function carregarNotificacoes() {
  // TODO(API): trocar por fetch('/api/notificacoes')
  const notificacoes = [
    {
      titulo: "Novo aluno em situação crítica",
      detalhe: "Juliana Ferreira — 9º Ano B",
    },
    {
      titulo: "Frequência abaixo do esperado",
      detalhe: "8º Ano A — frequência média de 80%",
    },
  ];

  const lista = document.getElementById("notification-list");
  const marcador = document.getElementById("notification-dot");

  if (notificacoes.length === 0) {
    lista.innerHTML = estadoVazioHTML("Nenhuma notificação no momento.");
    return;
  }

  marcador.hidden = false;
  lista.innerHTML = notificacoes
    .map(function (n) {
      return (
        '<div class="notification-item"><strong>' +
        n.titulo +
        "</strong><span>" +
        n.detalhe +
        "</span></div>"
      );
    })
    .join("");
}
