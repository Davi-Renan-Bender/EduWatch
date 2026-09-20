// ==========================================================================
// EduWatch — aluno.js
//
// DADOS → LÓGICA → INTERFACE
//
// Os dados abaixo são mockados apenas para o protótipo visual. Quando o
// backend existir, a função carregarDadosAluno() deve ser reescrita para
// buscar estes mesmos campos em, por exemplo:
//   GET /api/alunos/:id
//   GET /api/desempenho?alunoId=:id
//   GET /api/frequencia?alunoId=:id
// mantendo o mesmo formato de campos (nome, media, frequencia, situacao...)
// para que renderResumo/renderDisciplinas/renderEvolucao/renderAcompanhamento
// não precisem mudar.
// ==========================================================================

// --------------------------------------------------------------------------
// DADOS MOCKADOS — substituir por resposta da API
// --------------------------------------------------------------------------
const DADOS_MOCK_ALUNO = {
  turma: "9º Ano A",
  periodo: "3º Bimestre — 2026",
  mediaGeral: 7.4,
  frequenciaGeral: 91,
  situacaoGeral: "atencao",
  evolucaoRecente: 0.4,
  disciplinas: [
    { nome: "Matemática", media: 6.8, frequencia: 88, situacao: "atencao" },
    { nome: "Português", media: 8.1, frequencia: 95, situacao: "normal" },
    { nome: "Ciências", media: 7.5, frequencia: 92, situacao: "normal" },
    { nome: "História", media: 5.9, frequencia: 85, situacao: "critico" },
    { nome: "Geografia", media: 8.6, frequencia: 96, situacao: "normal" },
  ],
  evolucaoBimestres: [
    { rotulo: "1º Bim.", valor: 6.5 },
    { rotulo: "2º Bim.", valor: 6.9 },
    { rotulo: "3º Bim.", valor: 7.4 },
  ],
  acompanhamento: [
    {
      texto:
        "Dificuldade identificada em Geometria (Matemática) nas últimas duas avaliações.",
    },
    {
      texto:
        "Professor de História sugere reforço em interpretação de texto histórico.",
    },
    {
      texto: "Frequência em queda em Matemática nas últimas três semanas.",
    },
  ],
};

document.addEventListener("DOMContentLoaded", function () {
  const usuario = exigirPerfil("aluno");
  if (!usuario) return; // exigirPerfil já redirecionou para o login

  preencherUsuarioNaSidebar(usuario, "Aluno");
  inicializarMenuMobile();
  inicializarNavegacaoPorSecao();
  inicializarNotificacoes();

  carregarNotificacoes();
  carregarDadosAluno(usuario);
});

/**
 * Simula a busca de dados no backend. Mostra estado de carregamento e,
 * em caso de falha (simulação), mostraria o estado de erro.
 */
function carregarDadosAluno(usuario) {
  const containerCabecalho = document.getElementById("cabecalho-aluno");
  containerCabecalho.innerHTML = estadoCarregandoHTML(
    "Carregando seus dados...",
  );

  // TODO(API): trocar por fetch(`/api/alunos/${usuario.id}`) + fetch(`/api/desempenho?alunoId=${usuario.id}`)
  window.setTimeout(function () {
    try {
      renderCabecalho(usuario, DADOS_MOCK_ALUNO);
      renderResumo(DADOS_MOCK_ALUNO);
      renderDisciplinas(DADOS_MOCK_ALUNO.disciplinas);
      renderFrequencia(DADOS_MOCK_ALUNO);
      renderEvolucao(DADOS_MOCK_ALUNO.evolucaoBimestres);
      renderAcompanhamento(DADOS_MOCK_ALUNO.acompanhamento);
      renderPerfil(usuario, DADOS_MOCK_ALUNO);
    } catch (erro) {
      console.error(erro);
      containerCabecalho.innerHTML = estadoErroHTML(
        "Não foi possível carregar seus dados agora. Tente novamente mais tarde.",
      );
    }
  }, 300);
}

function renderCabecalho(usuario, dados) {
  const container = document.getElementById("cabecalho-aluno");
  const inicial = usuario.nome.charAt(0).toUpperCase();

  container.innerHTML =
    '<div class="student-summary">' +
    '<span class="avatar" aria-hidden="true">' +
    inicial +
    "</span>" +
    '<div class="student-summary-info">' +
    "<h2>" +
    usuario.nome +
    "</h2>" +
    '<div class="student-summary-meta">' +
    "<span>" +
    dados.turma +
    "</span>" +
    "<span>" +
    dados.periodo +
    "</span>" +
    "</div></div>" +
    selosituacaoHTML(dados.situacaoGeral) +
    "</div>";
}

function renderResumo(dados) {
  const container = document.getElementById("kpi-resumo-aluno");
  const tendencia =
    dados.evolucaoRecente >= 0 ? "kpi-trend--up" : "kpi-trend--down";
  const sinal = dados.evolucaoRecente >= 0 ? "+" : "";

  container.innerHTML =
    kpiCardHTML("Média geral", dados.mediaGeral.toFixed(1)) +
    kpiCardHTML("Frequência", dados.frequenciaGeral + "%") +
    kpiCardHTML("Disciplinas", String(dados.disciplinas.length)) +
    kpiCardHTML(
      "Evolução recente",
      sinal + dados.evolucaoRecente.toFixed(1),
      tendencia,
    );
}

function kpiCardHTML(rotulo, valor, classeTendencia) {
  const tendenciaHTML = classeTendencia
    ? '<span class="kpi-trend ' +
      classeTendencia +
      '">em relação ao bimestre anterior</span>'
    : "";

  return (
    '<article class="kpi-card">' +
    '<span class="kpi-label">' +
    rotulo +
    "</span>" +
    '<strong class="kpi-value">' +
    valor +
    "</strong>" +
    tendenciaHTML +
    "</article>"
  );
}

function renderDisciplinas(disciplinas) {
  const corpo = document.getElementById("tabela-disciplinas-corpo");

  if (!disciplinas || disciplinas.length === 0) {
    corpo.innerHTML =
      '<tr><td colspan="4">' +
      estadoVazioHTML("Nenhuma disciplina encontrada.") +
      "</td></tr>";
    return;
  }

  corpo.innerHTML = disciplinas
    .map(function (disciplina) {
      return (
        "<tr>" +
        "<td>" +
        disciplina.nome +
        "</td>" +
        "<td>" +
        disciplina.media.toFixed(1) +
        "</td>" +
        "<td>" +
        disciplina.frequencia +
        "%</td>" +
        "<td>" +
        selosituacaoHTML(disciplina.situacao) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function renderFrequencia(dados) {
  const kpiContainer = document.getElementById("kpi-frequencia-aluno");
  const faltantes = dados.disciplinas.filter(function (d) {
    return d.frequencia < 90;
  }).length;

  kpiContainer.innerHTML =
    kpiCardHTML("Frequência geral", dados.frequenciaGeral + "%") +
    kpiCardHTML("Disciplinas com frequência abaixo de 90%", String(faltantes));

  const corpo = document.getElementById("tabela-frequencia-corpo");
  corpo.innerHTML = dados.disciplinas
    .map(function (disciplina) {
      return (
        "<tr>" +
        "<td>" +
        disciplina.nome +
        "</td>" +
        "<td>" +
        disciplina.frequencia +
        "%</td>" +
        "<td>" +
        selosituacaoHTML(disciplina.situacao) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function renderEvolucao(evolucaoBimestres) {
  const container = document.getElementById("grafico-evolucao");

  if (!evolucaoBimestres || evolucaoBimestres.length === 0) {
    container.innerHTML = estadoVazioHTML(
      "Ainda não há histórico suficiente para exibir a evolução.",
    );
    return;
  }

  const valorMaximo = Math.max.apply(
    Math,
    evolucaoBimestres.map(function (b) {
      return b.valor;
    }),
  );

  container.innerHTML = evolucaoBimestres
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

function renderAcompanhamento(itens) {
  const lista = document.getElementById("lista-acompanhamento");

  if (!itens || itens.length === 0) {
    lista.innerHTML =
      "<li>" +
      estadoVazioHTML("Nenhum ponto de atenção registrado no momento.") +
      "</li>";
    return;
  }

  lista.innerHTML = itens
    .map(function (item) {
      return (
        '<li class="note-item">' +
        iconeSvg("alerta") +
        "<span>" +
        item.texto +
        "</span></li>"
      );
    })
    .join("");
}

function renderPerfil(usuario, dados) {
  const campos = document.getElementById("perfil-campos");
  const cpfFormatado = usuario.cpf.replace(
    /(\d{3})(\d{3})(\d{3})(\d{2})/,
    "$1.$2.$3-$4",
  );

  campos.innerHTML =
    campoPerfilHTML("Nome completo", usuario.nome) +
    campoPerfilHTML("CPF", cpfFormatado) +
    campoPerfilHTML("Turma", dados.turma) +
    campoPerfilHTML("Período letivo", dados.periodo);
}

function campoPerfilHTML(rotulo, valor) {
  return "<div><dt>" + rotulo + "</dt><dd>" + valor + "</dd></div>";
}

function carregarNotificacoes() {
  // TODO(API): trocar por fetch('/api/notificacoes')
  const notificacoes = [
    {
      titulo: "Nova nota lançada",
      detalhe: "Matemática — Avaliação bimestral",
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
        '<div class="notification-item">' +
        "<strong>" +
        n.titulo +
        "</strong>" +
        "<span>" +
        n.detalhe +
        "</span></div>"
      );
    })
    .join("");
}
