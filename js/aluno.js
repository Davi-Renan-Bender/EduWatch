// EduWatch — painel acadêmico do estudante, alimentado por dados publicados.
document.addEventListener("DOMContentLoaded", async () => {
  const usuarioSessao = await exigirPerfil("aluno");
  if (!usuarioSessao) return;

  const usuario = obterUsuarioVisualizacao(usuarioSessao, "aluno");
  preencherUsuarioNaSidebar(usuario, "Aluno");
  inicializarMenuMobile();
  inicializarNavegacaoPorSecao();
  inicializarNotificacoes();
  carregarNotificacoes();
  await carregarDadosAluno(usuario);
});

function criarElemento(tag, texto, classe) {
  const elemento = document.createElement(tag);
  if (texto !== undefined && texto !== null)
    elemento.textContent = String(texto);
  if (classe) elemento.className = classe;
  return elemento;
}

function statusMeta(situacao) {
  return (
    {
      normal: { rotulo: "Normal", classe: "status-badge--normal" },
      atencao: { rotulo: "Atenção", classe: "status-badge--atencao" },
      critico: { rotulo: "Crítico", classe: "status-badge--critico" },
      sem_dados: { rotulo: "Sem dados", classe: "status-badge--indefinido" },
    }[situacao] || { rotulo: "Sem dados", classe: "status-badge--indefinido" }
  );
}

function criarSeloSituacao(situacao) {
  const meta = statusMeta(situacao);
  const selo = criarElemento("span", undefined, `status-badge ${meta.classe}`);
  const ponto = criarElemento("span", undefined, "status-dot");
  ponto.setAttribute("aria-hidden", "true");
  selo.append(ponto, criarElemento("span", meta.rotulo));
  return selo;
}

function formatarMedia(valor) {
  return temNumero(valor)
    ? Number(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      })
    : "—";
}

function temNumero(valor) {
  return (
    valor !== null &&
    valor !== "" &&
    valor !== undefined &&
    Number.isFinite(Number(valor))
  );
}

function preencherEstadoTabela(corpo, colunas, mensagem) {
  if (!corpo) return;
  corpo.replaceChildren();
  const linha = document.createElement("tr");
  const celula = criarElemento("td", mensagem);
  celula.colSpan = colunas;
  linha.append(celula);
  corpo.append(linha);
}

async function requisitarPainelAluno() {
  let resposta;
  try {
    resposta = await fetch("api/academico/painel-aluno.php", {
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
      dados.mensagem || "Não foi possível carregar seu painel acadêmico.",
    );
  }
  return dados;
}

async function carregarDadosAluno(usuario) {
  try {
    const dados = await requisitarPainelAluno();
    renderCabecalho(usuario, dados);
    renderResumo(dados.resumo || {});
    renderDisciplinas(dados.disciplinas || []);
    renderEvolucao(dados.evolucao || []);
    renderAcompanhamento(dados.disciplinas || []);
    renderPerfil(usuario, dados.turmas || []);
  } catch (erro) {
    renderErroPainel(
      erro.message || "Não foi possível carregar seus dados acadêmicos.",
    );
  }
}

function renderCabecalho(usuario, dados) {
  const container = document.getElementById("cabecalho-aluno");
  if (!container) return;
  const turmas = Array.isArray(dados.turmas) ? dados.turmas : [];
  const resumo = dados.resumo || {};
  const resumoBloco = criarElemento("div", undefined, "student-summary");
  const avatar = criarElemento(
    "span",
    (usuario.nome || "A").charAt(0).toUpperCase(),
    "avatar",
  );
  avatar.setAttribute("aria-hidden", "true");
  const informacoes = criarElemento("div", undefined, "student-summary-info");
  informacoes.append(criarElemento("h2", usuario.nome || "Aluno"));
  const meta = criarElemento("div", undefined, "student-summary-meta");
  meta.append(
    criarElemento(
      "span",
      turmas.length
        ? turmas.map((turma) => turma.nome).join(" • ")
        : "Nenhuma matrícula ativa",
    ),
  );
  informacoes.append(meta);
  resumoBloco.append(avatar, informacoes, criarSeloSituacao(resumo.situacao));
  container.replaceChildren(resumoBloco);
}

function criarKpi(rotulo, valor, detalhe, classe) {
  const card = criarElemento(
    "article",
    undefined,
    `kpi-card${classe ? ` ${classe}` : ""}`,
  );
  card.append(
    criarElemento("span", rotulo, "kpi-label"),
    criarElemento("strong", valor, "kpi-value"),
  );
  if (detalhe) card.append(criarElemento("span", detalhe, "kpi-trend"));
  return card;
}

function renderResumo(resumo) {
  const container = document.getElementById("kpi-resumo-aluno");
  if (!container) return;
  const evolucao = resumo.evolucao_recente;
  const evolucaoTexto = temNumero(evolucao)
    ? `${Number(evolucao) >= 0 ? "+" : ""}${formatarMedia(evolucao)}`
    : "—";
  const evolucaoDetalhe = temNumero(evolucao)
    ? "comparada ao período anterior"
    : "ainda sem dois períodos com notas";
  container.replaceChildren(
    criarKpi(
      "Média geral",
      formatarMedia(resumo.media_geral),
      "em escala de 0 a 10",
    ),
    criarKpi(
      "Disciplinas",
      String(resumo.disciplinas_com_notas || 0),
      "com notas publicadas",
    ),
    criarKpi(
      "Evolução recente",
      evolucaoTexto,
      evolucaoDetalhe,
      temNumero(evolucao) && Number(evolucao) < 0 ? "kpi-card--warning" : "",
    ),
    criarKpi(
      "Situação",
      statusMeta(resumo.situacao).rotulo,
      "regra: média 7,0 ou mais é normal",
    ),
  );
}

function renderDisciplinas(disciplinas) {
  const corpo = document.getElementById("tabela-disciplinas-corpo");
  if (!corpo) return;
  if (!disciplinas.length) {
    preencherEstadoTabela(
      corpo,
      4,
      "Nenhuma nota publicada foi encontrada para suas matrículas ativas.",
    );
    window.EduWatchCharts?.renderBar(
      "grafico-disciplinas",
      [],
      "Média por disciplina",
    );
    return;
  }
  corpo.replaceChildren();
  disciplinas.forEach((disciplina) => {
    const linha = document.createElement("tr");
    linha.append(
      criarElemento("td", disciplina.nome),
      criarElemento("td", formatarMedia(disciplina.media)),
      criarElemento("td", disciplina.avaliacoes_lancadas),
    );
    const situacao = document.createElement("td");
    situacao.append(criarSeloSituacao(disciplina.situacao));
    linha.append(situacao);
    corpo.append(linha);
  });
  window.EduWatchCharts?.renderBar(
    "grafico-disciplinas",
    disciplinas,
    "Média por disciplina",
  );
}

function renderEvolucao(evolucao) {
  window.EduWatchCharts?.renderLine(
    "grafico-evolucao",
    evolucao,
    "Média geral",
  );
}

function renderAcompanhamento(disciplinas) {
  const lista = document.getElementById("lista-acompanhamento");
  if (!lista) return;
  const atencao = disciplinas.filter((disciplina) =>
    ["atencao", "critico"].includes(disciplina.situacao),
  );
  lista.replaceChildren();
  if (!atencao.length) {
    lista.append(
      criarElemento(
        "li",
        "Nenhum ponto de atenção foi identificado nas notas publicadas.",
      ),
    );
    return;
  }
  atencao.forEach((disciplina) => {
    const item = criarElemento("li", undefined, "note-item");
    item.append(
      criarElemento("strong", disciplina.nome),
      criarElemento(
        "span",
        `: média ${formatarMedia(disciplina.media)}. Este sinal é calculado pelas notas publicadas; converse com seu professor se precisar de apoio.`,
      ),
    );
    lista.append(item);
  });
}

function renderPerfil(usuario, turmas) {
  const campos = document.getElementById("perfil-campos");
  if (!campos) return;
  const cpf = String(usuario.cpf || "");
  const cpfFormatado = cpf.match(/^\d{11}$/)
    ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : "Não informado";
  const pares = [
    ["Nome completo", usuario.nome || "—"],
    ["CPF", cpfFormatado],
    [
      "Turmas ativas",
      turmas.length ? turmas.map((turma) => turma.nome).join(", ") : "Nenhuma",
    ],
    ["Fonte dos indicadores", "Avaliações publicadas"],
  ];
  campos.replaceChildren();
  pares.forEach(([rotulo, valor]) => {
    const item = document.createElement("div");
    item.append(criarElemento("dt", rotulo), criarElemento("dd", valor));
    campos.append(item);
  });
}

function renderErroPainel(mensagem) {
  const cabecalho = document.getElementById("cabecalho-aluno");
  const resumo = document.getElementById("kpi-resumo-aluno");
  if (cabecalho)
    cabecalho.replaceChildren(
      criarElemento("p", mensagem, "academic-feedback"),
    );
  if (resumo)
    resumo.replaceChildren(
      criarKpi(
        "Dados acadêmicos",
        "Indisponíveis",
        "Atualize a página para tentar novamente.",
        "kpi-card--warning",
      ),
    );
  preencherEstadoTabela(
    document.getElementById("tabela-disciplinas-corpo"),
    4,
    "Não foi possível carregar as disciplinas.",
  );
  window.EduWatchCharts?.showMessage(
    "grafico-disciplinas",
    "O gráfico será exibido quando os dados puderem ser carregados.",
  );
  window.EduWatchCharts?.showMessage(
    "grafico-evolucao",
    "O gráfico será exibido quando os dados puderem ser carregados.",
  );
}

function carregarNotificacoes() {
  const lista = document.getElementById("notification-list");
  const marcador = document.getElementById("notification-dot");
  if (lista)
    lista.replaceChildren(
      criarElemento("p", "Nenhuma notificação no momento."),
    );
  if (marcador) marcador.hidden = true;
}
