// ==========================================================================
// EduWatch — coordenacao.js
//
// DADOS → LÓGICA → INTERFACE
//

let alunosFiltradosCoordenacao = [];

// --------------------------------------------------------------------------
// INICIALIZAÇÃO
// --------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async function () {
  const usuarioSessao = await exigirPerfil("coordenacao");

  if (!usuarioSessao) {
    return;
  }

  const usuario = usuarioSessao.modoGestaoUsuariosAdmin
    ? usuarioSessao
    : obterUsuarioVisualizacao(usuarioSessao, "coordenacao");

  preencherUsuarioNaSidebar(usuario, "Coordenação");

  inicializarMenuMobile();
  inicializarNavegacaoPorSecao();
  inicializarNotificacoes();
  inicializarCadastroUsuarios(usuarioSessao);

  if (window.location.hash === "#cadastros") {
    const linkCadastros = document.querySelector('.sidebar-link[data-section="cadastros"]');
    if (linkCadastros) linkCadastros.click();
  }

  carregarNotificacoes();
  carregarDadosCoordenacao();
  inicializarFiltrosAlunosCoordenacao();
  inicializarModalAlunoCoordenacao();
});

// --------------------------------------------------------------------------
// CARREGAMENTO DOS DADOS
// --------------------------------------------------------------------------

function carregarDadosCoordenacao() {}


// --------------------------------------------------------------------------
// CADASTRO ADMINISTRATIVO DE USUÁRIOS
// --------------------------------------------------------------------------

function exibirMensagemCadastroUsuario(mensagem, tipo = "info") {
  const elemento = document.getElementById("cadastro-mensagem");
  if (!elemento) return;

  elemento.textContent = mensagem;
  elemento.classList.toggle("form-message--success", tipo === "sucesso");
  elemento.classList.toggle("form-message--error", tipo === "erro");
  elemento.classList.toggle("form-message--info", tipo === "info");
}

function inicializarCadastroUsuarios(usuarioSessao) {
  const formulario = document.getElementById("form-cadastro-usuario");
  const campoTipo = document.getElementById("cadastro-tipo");
  const campoNome = document.getElementById("cadastro-nome");
  const campoEmail = document.getElementById("cadastro-email");
  const campoCpf = document.getElementById("cadastro-cpf");
  const campoSenha = document.getElementById("cadastro-senha");
  const campoConfirmarSenha = document.getElementById("cadastro-confirmar-senha");
  const botao = document.getElementById("btn-cadastrar-usuario");

  if (!formulario || !campoTipo || !campoNome || !campoEmail || !campoSenha || !campoConfirmarSenha || !botao) {
    return;
  }

  // O administrador pode criar outros administradores. A coordenação não.
  // Esta opção é apenas de interface: o PHP verifica a autorização novamente.
  const ehAdministrador = usuarioSessao?.tipoUsuario === "administrador" || usuarioSessao?.nivel === "admin";
  if (ehAdministrador && !Array.from(campoTipo.options).some((opcao) => opcao.value === "administrador")) {
    const opcaoAdmin = document.createElement("option");
    opcaoAdmin.value = "administrador";
    opcaoAdmin.textContent = "Administrador";
    campoTipo.appendChild(opcaoAdmin);
  }

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    exibirMensagemCadastroUsuario("");

    const email = campoEmail.value.trim().toLowerCase();
    const nome = campoNome.value.trim();
    const tipoUsuario = campoTipo.value;
    const senha = campoSenha.value;
    const confirmarSenha = campoConfirmarSenha.value;
    const cpfOriginal = campoCpf ? campoCpf.value.trim() : "";
    const cpf = cpfOriginal ? cpfOriginal.replace(/\D/g, "") : "";

    if (!tipoUsuario || !nome || !email || !campoEmail.validity.valid) {
      exibirMensagemCadastroUsuario("Preencha o tipo, o nome e um e-mail válido.", "erro");
      return;
    }

    if (senha.length < 6) {
      exibirMensagemCadastroUsuario("A senha deve ter pelo menos 6 caracteres.", "erro");
      return;
    }

    if (senha !== confirmarSenha) {
      exibirMensagemCadastroUsuario("As senhas não coincidem.", "erro");
      campoConfirmarSenha.focus();
      return;
    }

    if (cpfOriginal && cpf.length !== 11) {
      exibirMensagemCadastroUsuario("Se informar CPF, digite 11 números. Você também pode deixar o campo vazio.", "erro");
      campoCpf.focus();
      return;
    }

    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Cadastrando...";

    try {
      const resposta = await fetch("api/usuarios/criar.php", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          nome,
          tipoUsuario,
          cpf,
          senha,
          confirmarSenha,
        }),
      });

      let resultado;
      try {
        resultado = await resposta.json();
      } catch {
        throw new Error("O servidor retornou uma resposta inesperada. Confirme se está usando o Apache do XAMPP.");
      }

      if (!resposta.ok || resultado.sucesso !== true) {
        throw new Error(resultado.mensagem || "Não foi possível cadastrar o usuário.");
      }

      formulario.reset();
      exibirMensagemCadastroUsuario(
        "Usuário cadastrado com sucesso: " + resultado.usuario.email + ". A conta já pode fazer login.",
        "sucesso"
      );
    } catch (erro) {
      exibirMensagemCadastroUsuario(
        erro instanceof Error ? erro.message : "Não foi possível concluir o cadastro. Tente novamente.",
        "erro"
      );
    } finally {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  });
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
  const titulo = document.getElementById("modal-aluno-titulo");
  const corpo = document.getElementById("modal-aluno-corpo");

  if (!titulo || !corpo) return;

  titulo.textContent = "Detalhes do aluno";

  corpo.innerHTML =
    '<div class="modal-section">' +
    estadoVazioHTML("Os dados deste aluno ainda não foram carregados.") +
    "</div>";

  abrirModal("modal-aluno");
}

// --------------------------------------------------------------------------
// NOTIFICAÇÕES
// --------------------------------------------------------------------------

function carregarNotificacoes() {
  const lista = document.getElementById("notification-list");
  const marcador = document.getElementById("notification-dot");

  lista.innerHTML = estadoVazioHTML("Nenhuma notificação no momento.");

  marcador.hidden = true;
}
