// ==========================================================================
// EduWatch — professor.js
//
// DADOS → LÓGICA → INTERFACE
//

let alunosFiltrados = [];

document.addEventListener("DOMContentLoaded", async function () {
  const usuarioSessao = await exigirPerfil("professor");

  if (!usuarioSessao) return;

  const usuario = obterUsuarioVisualizacao(usuarioSessao, "professor");

  preencherUsuarioNaSidebar(usuario, "Professor");
  inicializarMenuMobile();
  inicializarNavegacaoPorSecao();
  inicializarNotificacoes();

  carregarNotificacoes();
  carregarDadosProfessor();
  inicializarFiltrosAlunos();
  inicializarModalAluno();
});

function carregarDadosProfessor() {}

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

  alunosFiltrados = [];
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
  document.getElementById("modal-aluno-titulo").textContent =
    "Detalhes do aluno";

  document.getElementById("modal-aluno-corpo").innerHTML =
    '<div class="modal-section">' +
    estadoVazioHTML("Os dados deste aluno ainda não foram carregados.") +
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
  const lista = document.getElementById("notification-list");
  const marcador = document.getElementById("notification-dot");

  lista.innerHTML = estadoVazioHTML("Nenhuma notificação no momento.");

  marcador.hidden = true;
}
