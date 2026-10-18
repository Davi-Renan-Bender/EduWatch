// ==========================================================================
// EduWatch — coordenacao.js
//
// DADOS → LÓGICA → INTERFACE
//

let alunosFiltradosCoordenacao = [];
let alunosCoordenacaoTodos = [];
let graficoSituacaoEscola = null;
let graficoEvolucaoEscola = null;

function escaparHTMLCoordenacao(valor) {
  return String(valor ?? "").replace(/[&<>"\']/g, (caractere) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\'": "&#39;",
  })[caractere]);
}

function formatarMediaCoordenacao(valor) {
  return valor === null || valor === undefined || !Number.isFinite(Number(valor))
    ? "—"
    : Number(valor).toFixed(1);
}

function formatarFrequenciaCoordenacao(valor) {
  return valor === null || valor === undefined || !Number.isFinite(Number(valor))
    ? "Sem dados"
    : Number(valor) + "%";
}

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

async function carregarDadosCoordenacao() {
  const kpis = document.getElementById("kpi-resumo-escola");
  const corpoAlunos = document.getElementById("tabela-alunos-coord-corpo");
  if (kpis) kpis.innerHTML = estadoCarregandoHTML("Carregando indicadores da escola...");
  if (corpoAlunos) corpoAlunos.innerHTML = '<tr><td colspan="5">' + estadoCarregandoHTML("Carregando alunos...") + "</td></tr>";

  try {
    const resposta = await fetch("api/academico/painel-coordenacao.php", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    let dados;
    try { dados = await resposta.json(); }
    catch { throw new Error("O servidor retornou uma resposta inválida. Verifique o Apache e a API."); }
    if (!resposta.ok || dados.sucesso !== true) {
      throw new Error(dados.mensagem || "Não foi possível carregar os dados da coordenação.");
    }

    const resumo = dados.resumo || {};
    renderResumoCoordenacao(resumo);
    renderSituacoesEscola(resumo, dados.alunos || []);
    renderMenoresMedias(dados.turmas || []);
    renderMenoresFrequencias(dados.turmas || []);
    alunosCoordenacaoTodos = Array.isArray(dados.alunos) ? dados.alunos : [];
    alunosFiltradosCoordenacao = alunosCoordenacaoTodos.slice();
    const filtroTurma = document.getElementById("filtro-turma-coord");
    if (filtroTurma) {
      filtroTurma.innerHTML = '<option value="">Todas as turmas</option>';
      const turmas = (dados.turmas || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
      turmas.forEach((turma) => {
        const opcao = document.createElement("option");
        opcao.value = String(turma.id);
        opcao.textContent = turma.nome;
        filtroTurma.appendChild(opcao);
      });
    }
    renderTabelaAlunosCoordenacao(alunosFiltradosCoordenacao);
    renderProfessores(dados.professores || []);
    renderTurmasCoordenacao(dados.turmas || []);
    renderEvolucaoEscola(dados.evolucao || []);
    renderAcompanhamentoCoordenacao(alunosCoordenacaoTodos);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao carregar o painel.";
    if (kpis) kpis.innerHTML = estadoErroHTML(mensagem);
    if (corpoAlunos) corpoAlunos.innerHTML = '<tr><td colspan="5">' + estadoErroHTML(mensagem) + "</td></tr>";
    console.error("EduWatch coordenação:", erro);
  }
}


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

async function carregarTurmasParaCadastro(campoTurma) {
  if (!campoTurma) return;
  campoTurma.disabled = true;
  campoTurma.innerHTML = '<option value="">Carregando turmas...</option>';
  try {
    const resposta = await fetch("api/usuarios/turmas-disponiveis.php", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    let dados;
    try { dados = await resposta.json(); }
    catch { throw new Error("O servidor retornou uma resposta inválida ao carregar turmas."); }
    if (!resposta.ok || dados.sucesso !== true) {
      throw new Error(dados.mensagem || "Não foi possível carregar as turmas.");
    }
    const turmas = Array.isArray(dados.turmas) ? dados.turmas : [];
    campoTurma.innerHTML = '<option value="">Selecione a turma...</option>';
    turmas.forEach((turma) => {
      const opcao = document.createElement("option");
      opcao.value = String(turma.id);
      opcao.textContent = String(turma.nome || "Turma");
      campoTurma.appendChild(opcao);
    });
    if (turmas.length === 0) {
      campoTurma.innerHTML = '<option value="">Nenhuma turma ativa encontrada</option>';
    }
  } catch (erro) {
    campoTurma.innerHTML = '<option value="">Falha ao carregar turmas</option>';
    console.error("EduWatch: falha ao carregar turmas para matrícula.", erro);
  } finally {
    campoTurma.disabled = false;
  }
}

function inicializarCadastroUsuarios(usuarioSessao) {
  const formulario = document.getElementById("form-cadastro-usuario");
  const campoTipo = document.getElementById("cadastro-tipo");
  const campoNome = document.getElementById("cadastro-nome");
  const campoEmail = document.getElementById("cadastro-email");
  const campoCpf = document.getElementById("cadastro-cpf");
  const campoSenha = document.getElementById("cadastro-senha");
  const campoConfirmarSenha = document.getElementById("cadastro-confirmar-senha");
  const campoTurmaGrupo = document.getElementById("cadastro-turma-grupo");
  const campoTurma = document.getElementById("cadastro-turma");

  const botao = document.getElementById("btn-cadastrar-usuario");

  if (!formulario || !campoTipo || !campoNome || !campoEmail || !campoSenha || !campoConfirmarSenha || !botao) {
    return;
  }

  if (campoTurma && campoTurmaGrupo) {
    const atualizarCampoTurma = function () {
      const ehAluno = campoTipo.value === "aluno";
      campoTurmaGrupo.hidden = !ehAluno;
      campoTurma.required = ehAluno;
      if (!ehAluno) campoTurma.value = "";
    };
    campoTipo.addEventListener("change", atualizarCampoTurma);
    atualizarCampoTurma();
    carregarTurmasParaCadastro(campoTurma);
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

    const turmaId = tipoUsuario === "aluno" ? Number(campoTurma?.value || 0) : null;
    if (tipoUsuario === "aluno" && (!Number.isInteger(turmaId) || turmaId <= 0)) {
      exibirMensagemCadastroUsuario("Selecione a turma do aluno antes de cadastrar.", "erro");
      if (campoTurma) campoTurma.focus();
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
          turmaId,
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
    kpiCardCoordenacaoHTML("Alunos", String(resumo.totalAlunos ?? 0)) +
    kpiCardCoordenacaoHTML("Professores", String(resumo.totalProfessores ?? 0)) +
    kpiCardCoordenacaoHTML("Turmas", String(resumo.totalTurmas ?? 0)) +
    kpiCardCoordenacaoHTML("Média geral", formatarMediaCoordenacao(resumo.mediaGeral)) +
    kpiCardCoordenacaoHTML("Frequência média", formatarFrequenciaCoordenacao(resumo.frequenciaMedia)) +
    kpiCardCoordenacaoHTML(
      "Alunos em atenção",
      String(resumo.alunosAtencao ?? 0),
      "kpi-card--warning",
    ) +
    kpiCardCoordenacaoHTML(
      "Alunos em situação crítica",
      String(resumo.alunosCritico ?? 0),
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

  const comMedia = turmas.filter((turma) => turma.media !== null && turma.media !== undefined);
  if (comMedia.length === 0) {
    corpo.innerHTML = '<tr><td colspan="2">' + estadoVazioHTML("Ainda não há notas suficientes para calcular médias por turma.") + "</td></tr>";
    return;
  }
  const menores = comMedia.slice().sort((a, b) => a.media - b.media).slice(0, 3);

  corpo.innerHTML = menores
    .map(function (turma) {
      return (
        "<tr>" +
        "<td>" +
        escaparHTMLCoordenacao(turma.nome) +
        "</td>" +
        "<td>" +
        formatarMediaCoordenacao(turma.media) +
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

  const comFrequencia = (turmas || []).filter((turma) => turma.frequencia !== null && turma.frequencia !== undefined);
  if (comFrequencia.length === 0) {
    corpo.innerHTML = '<tr><td colspan="2">' + estadoVazioHTML("Ainda não há dados de frequência registrados no banco.") + "</td></tr>";
    return;
  }
  const menores = comFrequencia.slice().sort((a, b) => a.frequencia - b.frequencia).slice(0, 3);
  corpo.innerHTML = menores.map((turma) => "<tr><td>" + escaparHTMLCoordenacao(turma.nome) + "</td><td>" + formatarFrequenciaCoordenacao(turma.frequencia) + "</td></tr>").join("");
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

  const termo = buscaEl ? (buscaEl.value || "").trim().toLocaleLowerCase("pt-BR") : "";
  const turmaId = turmaEl ? turmaEl.value : "";
  const situacao = situacaoEl ? situacaoEl.value : "";

  alunosFiltradosCoordenacao = alunosCoordenacaoTodos.filter((aluno) => {
    const correspondeBusca = !termo || String(aluno.nome || "").toLocaleLowerCase("pt-BR").includes(termo);
    const correspondeTurma = !turmaId || String(aluno.turmaId) === String(turmaId);
    const correspondeSituacao = !situacao || aluno.situacao === situacao;
    return correspondeBusca && correspondeTurma && correspondeSituacao;
  });
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
        Number(aluno.id) +
        '" tabindex="0">' +
        "<td>" +
        escaparHTMLCoordenacao(aluno.nome) +
        "</td>" +
        "<td>" +
        escaparHTMLCoordenacao(aluno.turma) +
        "</td>" +
        "<td>" +
        formatarMediaCoordenacao(aluno.media) +
        "</td>" +
        "<td>" +
        formatarFrequenciaCoordenacao(aluno.frequencia) +
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
        escaparHTMLCoordenacao(professor.nome) +
        "</td>" +
        "<td>" +
        professor.turmas +
        "</td>" +
        "<td>" +
        professor.alunos +
        "</td>" +
        "<td>" +
        formatarMediaCoordenacao(professor.mediaTurmas) +
        "</td>" +
        "<td>" +
        formatarFrequenciaCoordenacao(professor.frequenciaMedia) +
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
        escaparHTMLCoordenacao(turma.nome) +
        "</span>" +
        '<span class="class-card-meta">' +
        "<span>" +
        turma.totalAlunos +
        " alunos</span>" +
        "<span>Média " +
        formatarMediaCoordenacao(turma.media) +
        "</span>" +
        "</span>" +
        '<span class="class-card-footer">' +
        '<span class="class-card-meta">' +
        "<span>Frequência " +
        formatarFrequenciaCoordenacao(turma.frequencia) + "</span>" +
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

function renderSituacoesEscola(resumo, alunos = []) {
  const container = document.getElementById("kpi-situacao-escola");

  if (container) {
    container.innerHTML =
      kpiCardCoordenacaoHTML("Normal", String(resumo.alunosNormais ?? 0)) +
      kpiCardCoordenacaoHTML(
        "Atenção",
        String(resumo.alunosAtencao ?? 0),
        "kpi-card--warning",
      ) +
      kpiCardCoordenacaoHTML(
        "Crítico",
        String(resumo.alunosCritico ?? 0),
        "kpi-card--danger",
      );
  }

  renderGraficoSituacoesEscola(resumo, alunos);
}

function mostrarEstadoGrafico(canvas, mensagemElemento, mensagem) {
  if (canvas) canvas.hidden = true;
  if (mensagemElemento) {
    mensagemElemento.textContent = mensagem;
    mensagemElemento.hidden = false;
  }
}

function renderGraficoSituacoesEscola(resumo, alunos) {
  const canvas = document.getElementById("grafico-situacao-escola");
  const mensagem = document.getElementById("grafico-situacao-vazio");
  if (!canvas) return;

  if (typeof Chart === "undefined") {
    mostrarEstadoGrafico(canvas, mensagem, "Não foi possível carregar o Chart.js. Verifique a conexão com a internet e recarregue a página.");
    return;
  }

  const semDados = Array.isArray(alunos)
    ? alunos.filter((aluno) => aluno.situacao === "sem_dados").length
    : 0;
  const valores = [
    Number(resumo.alunosNormais) || 0,
    Number(resumo.alunosAtencao) || 0,
    Number(resumo.alunosCritico) || 0,
    semDados,
  ];

  if (valores.reduce((soma, valor) => soma + valor, 0) === 0) {
    if (graficoSituacaoEscola) {
      graficoSituacaoEscola.destroy();
      graficoSituacaoEscola = null;
    }
    mostrarEstadoGrafico(canvas, mensagem, "Ainda não há alunos suficientes para gerar este gráfico.");
    return;
  }

  canvas.hidden = false;
  if (mensagem) mensagem.hidden = true;

  const configuracao = {
    type: "doughnut",
    data: {
      labels: ["Normal", "Atenção", "Crítico", "Sem dados"],
      datasets: [{
        data: valores,
        backgroundColor: ["#16845b", "#d99a16", "#c83d4d", "#8a94a6"],
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, padding: 18 } },
        tooltip: {
          callbacks: {
            label(context) {
              const total = context.dataset.data.reduce((soma, valor) => soma + Number(valor || 0), 0);
              const valor = Number(context.raw || 0);
              const percentual = total > 0 ? (valor / total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0";
              return ` ${context.label}: ${valor} (${percentual}%)`;
            },
          },
        },
      },
    },
  };

  if (graficoSituacaoEscola) {
    graficoSituacaoEscola.data = configuracao.data;
    graficoSituacaoEscola.options = configuracao.options;
    graficoSituacaoEscola.update();
  } else {
    graficoSituacaoEscola = new Chart(canvas.getContext("2d"), configuracao);
  }
}

function renderEvolucaoEscola(evolucao) {
  const canvas = document.getElementById("grafico-evolucao-escola");
  const mensagem = document.getElementById("grafico-evolucao-vazio");
  if (!canvas) return;

  if (typeof Chart === "undefined") {
    mostrarEstadoGrafico(canvas, mensagem, "Não foi possível carregar o Chart.js. Verifique a conexão com a internet e recarregue a página.");
    return;
  }

  const pontos = (Array.isArray(evolucao) ? evolucao : [])
    .filter((item) => item && item.valor !== null && item.valor !== undefined && Number.isFinite(Number(item.valor)))
    .slice()
    .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));

  if (pontos.length === 0) {
    if (graficoEvolucaoEscola) {
      graficoEvolucaoEscola.destroy();
      graficoEvolucaoEscola = null;
    }
    mostrarEstadoGrafico(canvas, mensagem, "Ainda não há histórico de notas suficiente para exibir a evolução.");
    return;
  }

  canvas.hidden = false;
  if (mensagem) mensagem.hidden = true;

  const configuracao = {
    type: "line",
    data: {
      labels: pontos.map((item) => String(item.rotulo || "Período")),
      datasets: [{
        label: "Média da escola",
        data: pontos.map((item) => Number(item.valor)),
        borderColor: "#087f72",
        backgroundColor: "rgba(8, 127, 114, 0.13)",
        pointBackgroundColor: "#087f72",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 3,
        tension: 0.28,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return ` Média: ${Number(context.raw).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}/10`;
            },
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2 },
          title: { display: true, text: "Média (0 a 10)" },
          grid: { color: "rgba(120, 130, 145, 0.16)" },
        },
        x: { grid: { display: false } },
      },
    },
  };

  if (graficoEvolucaoEscola) {
    graficoEvolucaoEscola.data = configuracao.data;
    graficoEvolucaoEscola.options = configuracao.options;
    graficoEvolucaoEscola.update();
  } else {
    graficoEvolucaoEscola = new Chart(canvas.getContext("2d"), configuracao);
  }
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
    return aluno.situacao === "atencao" || aluno.situacao === "critico";
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
        escaparHTMLCoordenacao(aluno.nome) +
        "</strong> (" +
        escaparHTMLCoordenacao(aluno.turma) +
        ") — " +
        escaparHTMLCoordenacao(observacao) +
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

  const aluno = alunosCoordenacaoTodos.find((item) => Number(item.id) === Number(alunoId));
  if (!aluno) return;
  titulo.textContent = aluno.nome;
  corpo.replaceChildren();
  const detalhes = [
    ["Turma", aluno.turma],
    ["Média", formatarMediaCoordenacao(aluno.media)],
    ["Frequência", formatarFrequenciaCoordenacao(aluno.frequencia)],
    ["Situação", situacaoMeta(aluno.situacao).rotulo],
    ["Avaliações com nota", String(aluno.avaliacoesLancadas ?? 0)],
  ];
  detalhes.forEach(([rotulo, valor]) => {
    const secao = document.createElement("div");
    secao.className = "modal-section";
    const label = document.createElement("strong");
    label.textContent = rotulo + ": ";
    const texto = document.createElement("span");
    texto.textContent = valor;
    secao.append(label, texto);
    corpo.appendChild(secao);
  });
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
