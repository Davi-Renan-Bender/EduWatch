/* EduWatch — integração inicial de avaliações e lançamento de notas.
 * Depende de professor.html já carregar auth.js, components.js e professor.js.
 */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-avaliacao");
  if (!form) return;

  const turmaSelect = document.getElementById("avaliacao-turma");
  const disciplinaSelect = document.getElementById("avaliacao-disciplina");
  const periodoSelect = document.getElementById("avaliacao-periodo");
  const tituloInput = document.getElementById("avaliacao-titulo");
  const dataInput = document.getElementById("avaliacao-data");
  const valorInput = document.getElementById("avaliacao-valor");
  const btnContinuar = form.querySelector(
    ".assessment-form-actions .btn-primary",
  );
  const btnSalvar = document.querySelector(
    "#section-avaliacoes .assessment-footer .btn-primary",
  );
  const tbody = document.getElementById("tabela-notas-corpo");
  const emptyState = document.querySelector(
    "#section-avaliacoes .assessment-empty-state",
  );
  const scaleValue = document.querySelector(
    "#section-avaliacoes .grade-scale strong",
  );
  const gradeHeading = document.querySelector(
    "#section-avaliacoes .grade-info strong",
  );
  const gradeDescription = document.querySelector(
    "#section-avaliacoes .grade-info div span",
  );
  const footerHeading = document.querySelector(
    "#section-avaliacoes .assessment-footer-info strong",
  );
  const footerDescription = document.querySelector(
    "#section-avaliacoes .assessment-footer-info span",
  );
  const statusBadge = document.querySelector(
    "#section-avaliacoes .assessment-status",
  );

  const tbodyAbertas = document.getElementById("tabela-avaliacoes-abertas");

  const btnAtualizarAbertas = document.getElementById(
    "btn-atualizar-avaliacoes-abertas",
  );
  const filtroDataInicialAbertas = document.getElementById(
    "filtro-avaliacoes-data-inicial",
  );
  const filtroDataFinalAbertas = document.getElementById(
    "filtro-avaliacoes-data-final",
  );
  const btnLimparFiltrosAbertas = document.getElementById(
    "btn-limpar-filtros-avaliacoes",
  );
  const resumoAvaliacoesAbertas = document.getElementById(
    "resumo-avaliacoes-abertas",
  );
  const btnMostrarMaisAbertas = document.getElementById(
    "btn-mostrar-mais-avaliacoes",
  );
  const btnMostrarMenosAbertas = document.getElementById(
    "btn-mostrar-menos-avaliacoes",
  );
  const btnVoltarTopoAbertas = document.getElementById(
    "btn-voltar-topo-avaliacoes",
  );

  let avaliacoesAbertas = [];
  const LIMITE_AVALIACOES_INICIAL = 5;
  let mostrarTodasAvaliacoesAbertas = false;
  let atribuicoes = [];
  let periodos = [];
  let avaliacaoAtual = null;
  let maximoAtual = 0;
  let mensagemEl = null;

  if (!btnContinuar || !btnSalvar || !tbody) return;

  function feedback(message, type = "info") {
    if (!mensagemEl) {
      mensagemEl = document.createElement("p");
      mensagemEl.id = "mensagem-avaliacao-banco";
      mensagemEl.className = "academic-feedback";
      mensagemEl.setAttribute("role", "status");
      form.insertAdjacentElement("afterend", mensagemEl);
    }
    mensagemEl.textContent = message;
    mensagemEl.dataset.type = type;
    mensagemEl.hidden = !message;
  }

  async function request(url, options = {}) {
    let response;
    try {
      response = await fetch(url, {
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {}),
        },
        ...options,
      });
    } catch (_error) {
      throw new Error(
        "Não foi possível conectar ao EduWatch. Confira o Apache e tente novamente.",
      );
    }
    let data;
    try {
      data = await response.json();
    } catch (_error) {
      throw new Error(
        "O servidor retornou uma resposta inválida. Confira os logs do PHP.",
      );
    }
    if (!response.ok || data.sucesso === false) {
      let message = data.mensagem || "Não foi possível concluir a operação.";
      const hostname = window.location.hostname.toLowerCase();
      const isLocal = ["localhost", "127.0.0.1", "::1"].includes(hostname);
      if (isLocal && data.diagnostico && typeof data.diagnostico === "object") {
        const etapa = data.diagnostico.etapa || "etapa desconhecida";
        const detalhe = data.diagnostico.erro || "sem detalhes adicionais";
        message += `\nDiagnóstico local: ${etapa}. ${detalhe}`;
      }
      throw new Error(message);
    }
    return data;
  }

  function option(value, label) {
    const element = document.createElement("option");
    element.value = String(value);
    element.textContent = label;
    return element;
  }

  function resetSelect(select, placeholder) {
    select.replaceChildren(option("", placeholder));
  }

  function renderTurmas() {
    resetSelect(turmaSelect, "Selecione uma turma");

    const turmas = new Map();
    atribuicoes.forEach((item) => {
      turmas.set(String(item.turma_id), item.turma);
    });

    [...turmas.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
      .forEach(([id, nome]) => turmaSelect.append(option(id, nome)));

    // A turma só fica desabilitada quando a API não retorna nenhuma.
    turmaSelect.disabled = turmas.size === 0;
    renderDisciplinas();
  }

  function renderDisciplinas() {
    const turmaId = turmaSelect.value;
    resetSelect(disciplinaSelect, "Selecione uma disciplina");

    const items = atribuicoes
      .filter((item) => String(item.turma_id) === turmaId)
      .sort((a, b) => a.disciplina.localeCompare(b.disciplina, "pt-BR"));

    items.forEach((item) => {
      const el = option(item.turma_disciplina_id, item.disciplina);
      el.dataset.turmaId = String(item.turma_id);
      el.dataset.anoLetivoId = String(item.ano_letivo_id);
      disciplinaSelect.append(el);
    });

    // O campo fica habilitado após escolher uma turma com disciplinas.
    disciplinaSelect.disabled = items.length === 0;
    renderPeriodos();
  }

  function renderPeriodos() {
    const selected = disciplinaSelect.selectedOptions[0];
    const anoId = selected?.dataset.anoLetivoId || "";
    resetSelect(periodoSelect, "Selecione o período");

    const disponiveis = periodos
      .filter(
        (item) => String(item.ano_letivo_id) === String(anoId) && anoId !== "",
      )
      .sort((a, b) => Number(a.ordem) - Number(b.ordem));

    disponiveis.forEach((item) => {
      periodoSelect.append(option(item.id, item.nome));
    });

    // O período só é habilitado quando uma disciplina válida foi escolhida
    // e existem períodos para o mesmo ano letivo.
    periodoSelect.disabled = disponiveis.length === 0;
  }

  function formatarDataBR(valor) {
    const partes = String(valor || "").split("-");

    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : "—";
  }

  function celula(texto) {
    const td = document.createElement("td");
    td.textContent = String(texto ?? "—");
    return td;
  }

  function renderAvaliacoesAbertas() {
    if (!tbodyAbertas) return;

    tbodyAbertas.replaceChildren();

    const dataInicial = filtroDataInicialAbertas?.value || "";
    const dataFinal = filtroDataFinalAbertas?.value || "";

    function mostrarMensagemTabela(mensagem) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 7;
      cell.textContent = mensagem;

      row.append(cell);
      tbodyAbertas.append(row);
    }

    if (dataInicial && dataFinal && dataInicial > dataFinal) {
      if (resumoAvaliacoesAbertas) {
        resumoAvaliacoesAbertas.textContent =
          "A data inicial deve ser anterior à data final.";
      }

      mostrarMensagemTabela("Corrija o intervalo de datas.");

      if (btnMostrarMaisAbertas) btnMostrarMaisAbertas.hidden = true;
      if (btnMostrarMenosAbertas) btnMostrarMenosAbertas.hidden = true;
      if (btnVoltarTopoAbertas) btnVoltarTopoAbertas.hidden = true;

      return;
    }

    const filtradas = avaliacoesAbertas.filter((avaliacao) => {
      const data = String(avaliacao.data_aplicacao || "").slice(0, 10);

      if (dataInicial && (!data || data < dataInicial)) return false;
      if (dataFinal && (!data || data > dataFinal)) return false;

      return true;
    });

    const total = filtradas.length;
    const limite = mostrarTodasAvaliacoesAbertas
      ? total
      : LIMITE_AVALIACOES_INICIAL;

    const visiveis = filtradas.slice(0, limite);

    if (resumoAvaliacoesAbertas) {
      if (total === 0) {
        resumoAvaliacoesAbertas.textContent =
          avaliacoesAbertas.length === 0
            ? "Nenhuma avaliação cadastrada."
            : "Nenhuma avaliação encontrada nesse intervalo de datas.";
      } else {
        resumoAvaliacoesAbertas.textContent =
          `Exibindo ${visiveis.length} de ${total} ` +
          (total === 1 ? "avaliação." : "avaliações.");
      }
    }

    if (btnMostrarMaisAbertas) {
      btnMostrarMaisAbertas.hidden =
        total <= LIMITE_AVALIACOES_INICIAL || mostrarTodasAvaliacoesAbertas;
    }

    if (btnMostrarMenosAbertas) {
      btnMostrarMenosAbertas.hidden =
        total <= LIMITE_AVALIACOES_INICIAL || !mostrarTodasAvaliacoesAbertas;
    }

    if (btnVoltarTopoAbertas) {
      btnVoltarTopoAbertas.hidden =
        total <= LIMITE_AVALIACOES_INICIAL || !mostrarTodasAvaliacoesAbertas;
    }

    if (total === 0) {
      mostrarMensagemTabela(
        avaliacoesAbertas.length === 0
          ? "Nenhuma avaliação cadastrada."
          : "Nenhuma avaliação corresponde aos filtros selecionados.",
      );
      return;
    }

    visiveis.forEach((avaliacao) => {
      const atribuicao = atribuicoes.find(
        (item) =>
          String(item.turma_disciplina_id) ===
          String(avaliacao.turma_disciplina_id),
      );

      const periodo = periodos.find(
        (item) => String(item.id) === String(avaliacao.periodo_letivo_id),
      );

      const row = document.createElement("tr");

      const valores = [
        avaliacao.titulo,
        atribuicao
          ? `${atribuicao.turma} — ${atribuicao.disciplina}`
          : "Atribuição indisponível",
        periodo?.nome || "—",
        formatarDataRascunho(avaliacao.data_aplicacao),
        avaliacao.nota_maxima,
      ];

      valores.forEach((valor) => {
        const cell = document.createElement("td");
        cell.textContent = String(valor ?? "—");
        row.append(cell);
      });

      const statusCell = document.createElement("td");

      const statusLabels = {
        rascunho: "Rascunho",
        publicada: "Publicada",
        encerrada: "Encerrada",
        cancelada: "Cancelada",
      };

      statusCell.textContent =
        statusLabels[avaliacao.status] || avaliacao.status || "—";

      row.append(statusCell);

      const actionCell = document.createElement("td");

      if (["rascunho", "publicada"].includes(avaliacao.status)) {
        const btnRetomar = document.createElement("button");

        btnRetomar.type = "button";
        btnRetomar.className = "btn btn-primary";
        btnRetomar.textContent = "Retomar";

        btnRetomar.addEventListener("click", () => {
          retomarAvaliacao(avaliacao);
        });

        actionCell.append(btnRetomar);
      }

      const btnExcluir = document.createElement("button");

      btnExcluir.type = "button";
      btnExcluir.className = "btn btn-danger";
      btnExcluir.textContent = "Excluir";

      btnExcluir.addEventListener("click", () => {
        excluirAvaliacao(avaliacao, btnExcluir);
      });

      actionCell.append(btnExcluir);
      row.append(actionCell);
      tbodyAbertas.append(row);
    });
  }

  async function carregarOpcoes() {
    turmaSelect.disabled = true;
    disciplinaSelect.disabled = true;
    periodoSelect.disabled = true;
    try {
      const endpoint = new URL(
        "api/academico/opcoes-avaliacao.php",
        document.baseURI,
      ).toString();
      const data = await request(endpoint, { cache: "no-store" });
      atribuicoes = Array.isArray(data.atribuicoes) ? data.atribuicoes : [];
      periodos = Array.isArray(data.periodos) ? data.periodos : [];
      renderTurmas();
      if (atribuicoes.length === 0) {
        feedback(
          "Você ainda não tem turmas e disciplinas atribuídas. Peça à coordenação para configurar essa relação.",
          "warning",
        );
      } else {
        feedback(
          "Turmas e disciplinas carregadas. Selecione uma turma e uma disciplina para ver os períodos disponíveis.",
          "success",
        );
      }
    } catch (error) {
      feedback(error.message, "error");
    }
  }

  function renderAlunos(alunos) {
    tbody.replaceChildren();
    if (emptyState) emptyState.hidden = alunos.length > 0;
    if (alunos.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Não há alunos com matrícula ativa nesta turma.";
      row.append(cell);
      tbody.append(row);
      return;
    }

    alunos.forEach((aluno) => {
      const row = document.createElement("tr");
      row.dataset.matriculaId = String(aluno.matricula_id);
      const name = document.createElement("td");
      name.textContent = aluno.nome;
      const registration = document.createElement("td");
      registration.textContent = String(aluno.matricula_id);
      const gradeCell = document.createElement("td");
      const grade = document.createElement("input");
      grade.type = "number";
      grade.className = "academic-grade-input";
      grade.min = "0";
      grade.max = String(maximoAtual);
      grade.step = "0.01";
      grade.inputMode = "decimal";
      grade.placeholder = "—";
      grade.setAttribute("aria-label", "Nota de " + aluno.nome);
      grade.value =
        aluno.nota === null || aluno.nota === undefined
          ? ""
          : String(aluno.nota);
      gradeCell.append(grade);

      const statusCell = document.createElement("td");
      const status = document.createElement("select");
      status.className = "academic-grade-status";
      status.setAttribute("aria-label", "Situação da nota de " + aluno.nome);
      [
        ["pendente", "Pendente"],
        ["lancada", "Lançada"],
        ["ausente", "Ausente"],
        ["dispensada", "Dispensada"],
      ].forEach(([value, label]) => status.append(option(value, label)));
      status.value =
        aluno.situacao || (grade.value !== "" ? "lancada" : "pendente");
      if (grade.value !== "") status.value = "lancada";
      grade.disabled = ["ausente", "dispensada"].includes(status.value);

      grade.addEventListener("input", () => {
        if (grade.value !== "") status.value = "lancada";
        else if (status.value === "lancada") status.value = "pendente";
      });
      status.addEventListener("change", () => {
        if (status.value !== "lancada") grade.value = "";
        grade.disabled = ["ausente", "dispensada"].includes(status.value);
        if (status.value === "lancada") grade.focus();
      });
      statusCell.append(status);
      row.append(name, registration, gradeCell, statusCell);
      tbody.append(row);
    });
  }

  async function retomarAvaliacao(resumo) {
    const atribuicao = atribuicoes.find(
      (item) =>
        String(item.turma_disciplina_id) === String(resumo.turma_disciplina_id),
    );

    if (!atribuicao) {
      feedback(
        "A turma e a disciplina não estão mais atribuídas à sua conta.",
        "error",
      );
      return;
    }

    turmaSelect.value = String(atribuicao.turma_id);
    renderDisciplinas();

    disciplinaSelect.value = String(resumo.turma_disciplina_id);
    renderPeriodos();

    periodoSelect.value = String(resumo.periodo_letivo_id);
    tituloInput.value = String(resumo.titulo || "");
    dataInput.value = String(resumo.data_aplicacao || "");
    valorInput.value = String(resumo.nota_maxima ?? "");

    btnContinuar.disabled = true;
    btnContinuar.textContent = "Carregando rascunho...";
    btnSalvar.disabled = true;

    try {
      const endpoint = new URL(
        "api/academico/alunos-avaliacao.php",
        document.baseURI,
      );

      endpoint.searchParams.set("avaliacao_id", String(resumo.id));

      const data = await request(endpoint.toString(), {
        cache: "no-store",
      });

      avaliacaoAtual = data.avaliacao;
      maximoAtual = Number(avaliacaoAtual.nota_maxima);

      renderAlunos(data.alunos || []);

      if (scaleValue) {
        scaleValue.textContent = String(maximoAtual);
      }

      if (statusBadge) {
        statusBadge.textContent = "Rascunho recuperado";
      }

      if (gradeHeading) {
        gradeHeading.textContent = "Retomada do lançamento das notas";
      }

      if (gradeDescription) {
        gradeDescription.textContent =
          "Continue preenchendo as notas e clique em Salvar notas.";
      }

      if (footerHeading) {
        footerHeading.textContent = "Rascunho recuperado do Supabase";
      }

      if (footerDescription) {
        footerDescription.textContent =
          "As informações foram recuperadas. Salve as notas para publicar.";
      }

      btnContinuar.textContent = "Avaliação já criada";
      btnContinuar.disabled = true;
      btnSalvar.disabled = false;

      feedback(
        "Rascunho recuperado! Continue o lançamento das notas.",
        "success",
      );

      form.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (error) {
      avaliacaoAtual = null;
      btnContinuar.disabled = false;
      btnContinuar.textContent = "Continuar para as notas";
      btnSalvar.disabled = true;

      feedback(error.message, "error");
    }
  }

  function formatarDataRascunho(data) {
    const partes = String(data || "").split("-");

    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : "—";
  }

  function renderAvaliacoesAbertas() {
    if (!tbodyAbertas) return;

    tbodyAbertas.replaceChildren();

    const dataInicial =
      document.getElementById("filtro-avaliacoes-data-inicial")?.value || "";

    const dataFinal =
      document.getElementById("filtro-avaliacoes-data-final")?.value || "";

    const resumo = document.getElementById("resumo-avaliacoes-abertas");
    const btnMais = document.getElementById("btn-mostrar-mais-avaliacoes");
    const btnMenos = document.getElementById("btn-mostrar-menos-avaliacoes");
    const btnTopo = document.getElementById("btn-voltar-topo-avaliacoes");

    const limiteInicial = 5;

    function exibirMensagem(mensagem) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 7;
      cell.textContent = mensagem;

      row.appendChild(cell);
      tbodyAbertas.appendChild(row);
    }

    if (dataInicial && dataFinal && dataInicial > dataFinal) {
      if (resumo) {
        resumo.textContent =
          "A data inicial não pode ser posterior à data final.";
      }

      exibirMensagem("Corrija o intervalo de datas.");

      if (btnMais) btnMais.hidden = true;
      if (btnMenos) btnMenos.hidden = true;
      if (btnTopo) btnTopo.hidden = true;

      return;
    }

    const filtradas = avaliacoesAbertas.filter((avaliacao) => {
      const data = String(avaliacao.data_aplicacao || "").slice(0, 10);

      if (dataInicial && (!data || data < dataInicial)) return false;
      if (dataFinal && (!data || data > dataFinal)) return false;

      return true;
    });

    const total = filtradas.length;
    const mostrarTodas = mostrarTodasAvaliacoesAbertas;
    const visiveis = mostrarTodas
      ? filtradas
      : filtradas.slice(0, limiteInicial);

    if (resumo) {
      resumo.textContent = `Exibindo ${visiveis.length} de ${total} avaliações.`;
    }

    if (btnMais) {
      btnMais.hidden = total <= limiteInicial || mostrarTodas;
    }

    if (btnMenos) {
      btnMenos.hidden = total <= limiteInicial || !mostrarTodas;
    }

    if (btnTopo) {
      btnTopo.hidden = total <= limiteInicial || !mostrarTodas;
    }

    if (total === 0) {
      exibirMensagem(
        avaliacoesAbertas.length === 0
          ? "Nenhuma avaliação cadastrada."
          : "Nenhuma avaliação encontrada para as datas selecionadas.",
      );
      return;
    }

    visiveis.forEach((avaliacao) => {
      const atribuicao = atribuicoes.find(
        (item) =>
          String(item.turma_disciplina_id) ===
          String(avaliacao.turma_disciplina_id),
      );

      const periodo = periodos.find(
        (item) => String(item.id) === String(avaliacao.periodo_letivo_id),
      );

      const row = document.createElement("tr");

      const valores = [
        avaliacao.titulo,
        atribuicao
          ? `${atribuicao.turma} — ${atribuicao.disciplina}`
          : "Atribuição indisponível",
        periodo?.nome || "—",
        formatarDataRascunho(avaliacao.data_aplicacao),
        avaliacao.nota_maxima,
      ];

      valores.forEach((valor) => {
        const cell = document.createElement("td");
        cell.textContent = String(valor ?? "—");
        row.appendChild(cell);
      });

      const statusCell = document.createElement("td");

      const statusLabels = {
        rascunho: "Rascunho",
        publicada: "Publicada",
        encerrada: "Encerrada",
        cancelada: "Cancelada",
      };

      statusCell.textContent =
        statusLabels[avaliacao.status] || avaliacao.status || "—";

      row.appendChild(statusCell);

      const actionCell = document.createElement("td");

      if (["rascunho", "publicada"].includes(avaliacao.status)) {
        const btnRetomar = document.createElement("button");

        btnRetomar.type = "button";
        btnRetomar.className = "btn btn-primary";
        btnRetomar.textContent = "Retomar";

        btnRetomar.addEventListener("click", () => {
          retomarAvaliacao(avaliacao);
        });

        actionCell.appendChild(btnRetomar);
      }

      const btnExcluir = document.createElement("button");

      btnExcluir.type = "button";
      btnExcluir.className = "btn btn-danger";
      btnExcluir.textContent = "Excluir";

      btnExcluir.addEventListener("click", () => {
        excluirAvaliacao(avaliacao, btnExcluir);
      });

      actionCell.appendChild(btnExcluir);
      row.appendChild(actionCell);
      tbodyAbertas.appendChild(row);
    });
  }

  async function excluirAvaliacao(avaliacao, botao) {
    const confirmado = window.confirm(
      `Deseja excluir permanentemente a avaliação "${avaliacao.titulo}"?\n\n` +
        "Todas as notas, os resultados dos itens e as notificações " +
        "relacionadas serão apagados. Essa ação não pode ser desfeita.",
    );

    if (!confirmado) return;

    botao.disabled = true;
    botao.textContent = "Excluindo...";

    try {
      const endpoint = new URL(
        "api/academico/excluir-avaliacao.php",
        document.baseURI,
      ).toString();

      await request(endpoint, {
        method: "POST",
        body: JSON.stringify({
          avaliacao_id: Number(avaliacao.id),
        }),
      });

      // Se era a avaliação aberta no formulário, limpa a tela.
      if (
        avaliacaoAtual &&
        String(avaliacaoAtual.id) === String(avaliacao.id)
      ) {
        form.reset();
      }

      await carregarAvaliacoesAbertas();

      feedback("Avaliação excluída com sucesso.", "success");
    } catch (error) {
      feedback(error.message, "error");
      botao.disabled = false;
      botao.textContent = "Excluir";
    }
  }

  async function carregarAvaliacoesAbertas() {
    if (!tbodyAbertas) return;

    tbodyAbertas.replaceChildren();

    const loadingRow = document.createElement("tr");
    const loadingCell = document.createElement("td");

    loadingCell.colSpan = 6;
    loadingCell.textContent = "Carregando avaliações...";

    loadingRow.append(loadingCell);
    tbodyAbertas.append(loadingRow);

    if (btnAtualizarAbertas) {
      btnAtualizarAbertas.disabled = true;
    }

    try {
      const endpoint = new URL(
        "api/academico/avaliacoes-abertas.php",
        document.baseURI,
      ).toString();

      const data = await request(endpoint, {
        cache: "no-store",
      });

      avaliacoesAbertas = Array.isArray(data.avaliacoes) ? data.avaliacoes : [];

      renderAvaliacoesAbertas();
    } catch (error) {
      tbodyAbertas.replaceChildren();

      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 6;
      cell.textContent =
        "Erro ao carregar. Clique em Atualizar para tentar novamente.";

      row.append(cell);
      tbodyAbertas.append(row);

      feedback(error.message, "error");
    } finally {
      if (btnAtualizarAbertas) {
        btnAtualizarAbertas.disabled = false;
      }
    }
  }

  async function retomarAvaliacao(resumo) {
    if (
      avaliacaoAtual &&
      String(avaliacaoAtual.id) !== String(resumo.id) &&
      String(avaliacaoAtual.status || "rascunho") === "rascunho"
    ) {
      feedback(
        "Você já está trabalhando em outro rascunho. Termine-o ou clique em Limpar antes de trocar.",
        "warning",
      );
      return;
    }

    const atribuicao = atribuicoes.find(
      (item) =>
        String(item.turma_disciplina_id) === String(resumo.turma_disciplina_id),
    );

    if (!atribuicao) {
      feedback(
        "A turma e a disciplina desta avaliação não estão mais atribuídas à sua conta.",
        "error",
      );
      return;
    }

    turmaSelect.value = String(atribuicao.turma_id);
    renderDisciplinas();

    disciplinaSelect.value = String(atribuicao.turma_disciplina_id);

    renderPeriodos();

    periodoSelect.value = String(resumo.periodo_letivo_id);
    tituloInput.value = String(resumo.titulo || "");
    dataInput.value = String(resumo.data_aplicacao || "");
    valorInput.value = String(resumo.nota_maxima ?? "");

    btnContinuar.disabled = true;
    btnContinuar.textContent = "Carregando rascunho...";
    btnSalvar.disabled = true;

    try {
      const endpoint = new URL(
        "api/academico/alunos-avaliacao.php",
        document.baseURI,
      );

      endpoint.searchParams.set("avaliacao_id", String(resumo.id));

      const data = await request(endpoint.toString(), {
        cache: "no-store",
      });

      avaliacaoAtual = data.avaliacao;
      maximoAtual = Number(avaliacaoAtual.nota_maxima);

      renderAlunos(data.alunos || []);

      if (scaleValue) {
        scaleValue.textContent = String(maximoAtual);
      }

      if (statusBadge) {
        statusBadge.textContent = "Rascunho recuperado";
      }

      if (gradeHeading) {
        gradeHeading.textContent = "Lançamento das notas";
      }

      if (gradeDescription) {
        gradeDescription.textContent =
          "Continue preenchendo as notas e clique em Salvar notas.";
      }

      if (footerHeading) {
        footerHeading.textContent = "Rascunho recuperado";
      }

      if (footerDescription) {
        footerDescription.textContent =
          "Depois de salvar, a avaliação será publicada para os alunos.";
      }

      btnContinuar.disabled = true;
      btnContinuar.textContent = "Avaliação recuperada";
      btnSalvar.disabled = false;

      feedback(
        "Rascunho recuperado. Continue o lançamento das notas.",
        "success",
      );

      document.getElementById("section-avaliacoes")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (error) {
      btnContinuar.disabled = true;
      btnContinuar.textContent = "Falha ao recuperar rascunho";
      btnSalvar.disabled = true;

      feedback(error.message, "error");
    }
  }

  async function continuarParaNotas() {
    if (avaliacaoAtual) {
      feedback(
        "Esta avaliação já foi criada. Lance as notas na tabela abaixo e clique em Salvar notas.",
        "info",
      );
      return;
    }
    if (!form.reportValidity()) return;
    const assignmentOption = disciplinaSelect.selectedOptions[0];
    if (
      !assignmentOption ||
      assignmentOption.dataset.turmaId !== turmaSelect.value
    ) {
      feedback(
        "Selecione uma disciplina válida para a turma escolhida.",
        "error",
      );
      return;
    }
    const payload = {
      turma_id: Number(turmaSelect.value),
      turma_disciplina_id: Number(disciplinaSelect.value),
      periodo_letivo_id: Number(periodoSelect.value),
      titulo: tituloInput.value.trim(),
      data_aplicacao: dataInput.value,
      nota_maxima: Number(valorInput.value),
    };
    btnContinuar.disabled = true;
    btnContinuar.textContent = "Criando avaliação…";
    try {
      const criarEndpoint = new URL(
        "api/academico/criar-avaliacao.php",
        document.baseURI,
      ).toString();
      const result = await request(criarEndpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      avaliacaoAtual = result.avaliacao;
      maximoAtual = Number(avaliacaoAtual.nota_maxima);
      btnContinuar.textContent = "Avaliação criada";
      btnContinuar.disabled = true;
      btnSalvar.disabled = false;
      scaleValue && (scaleValue.textContent = String(maximoAtual));
      statusBadge && (statusBadge.textContent = "Rascunho");
      gradeHeading && (gradeHeading.textContent = "Lançamento das notas");
      gradeDescription &&
        (gradeDescription.textContent =
          "Preencha a nota de cada aluno. Deixe pendente ou escolha ausente/dispensada quando necessário.");
      footerHeading &&
        (footerHeading.textContent = "Avaliação criada como rascunho");
      footerDescription &&
        (footerDescription.textContent =
          "As notas serão salvas e a avaliação publicada quando você clicar em Salvar notas.");
      const alunosEndpoint = new URL(
        "api/academico/alunos-avaliacao.php",
        document.baseURI,
      );
      alunosEndpoint.searchParams.set(
        "avaliacao_id",
        String(avaliacaoAtual.id),
      );
      const rosterData = await request(alunosEndpoint.toString(), {
        cache: "no-store",
      });
      renderAlunos(rosterData.alunos || []);
      await carregarAvaliacoesAbertas();
      feedback(
        "Avaliação criada. Agora lance as notas e salve para disponibilizá-las ao aluno.",
        "success",
      );
    } catch (error) {
      feedback(error.message, "error");
      btnContinuar.disabled = false;
      btnContinuar.textContent = "Continuar para as notas";
    }
  }

  async function salvarNotas() {
    if (!avaliacaoAtual) {
      feedback(
        "Primeiro preencha os dados e clique em Continuar para as notas.",
        "warning",
      );
      return;
    }
    const rows = [...tbody.querySelectorAll("tr[data-matricula-id]")];
    if (rows.length === 0) {
      feedback("Não há alunos para salvar nesta avaliação.", "warning");
      return;
    }
    const notas = [];
    for (const row of rows) {
      const gradeInput = row.querySelector(".academic-grade-input");
      const statusSelect = row.querySelector(".academic-grade-status");
      const raw = gradeInput.value.trim();
      if (raw !== "") {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0 || value > maximoAtual) {
          gradeInput.focus();
          feedback(
            "Todas as notas devem estar entre 0 e " + maximoAtual + ".",
            "error",
          );
          return;
        }
      }
      const status = raw !== "" ? "lancada" : statusSelect.value;
      if (status === "lancada" && raw === "") {
        statusSelect.focus();
        feedback(
          "Informe a nota ou escolha Pendente, Ausente ou Dispensada.",
          "error",
        );
        return;
      }
      notas.push({
        matricula_id: Number(row.dataset.matriculaId),
        nota_obtida: raw === "" ? null : Number(raw),
        situacao: status,
      });
    }

    btnSalvar.disabled = true;
    const original = btnSalvar.textContent;
    btnSalvar.textContent = "Salvando notas…";
    try {
      const salvarEndpoint = new URL(
        "api/academico/salvar-notas.php",
        document.baseURI,
      ).toString();
      await request(salvarEndpoint, {
        method: "POST",
        body: JSON.stringify({
          avaliacao_id: Number(avaliacaoAtual.id),
          notas,
        }),
      });

      if (avaliacaoAtual) {
        avaliacaoAtual.status = "publicada";
      }

      await carregarAvaliacoesAbertas();

      statusBadge && (statusBadge.textContent = "Publicada");
      footerHeading && (footerHeading.textContent = "Notas salvas com sucesso");
      footerDescription &&
        (footerDescription.textContent =
          "A avaliação está publicada e os alunos poderão consultar os resultados na área Minhas notas.");
      feedback(
        "Notas salvas no Supabase e avaliação publicada. O aluno já pode consultar os resultados.",
        "success",
      );
    } catch (error) {
      feedback(error.message, "error");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = original;
    }
  }

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      avaliacaoAtual = null;
      maximoAtual = 0;
      tbody.replaceChildren();
      if (emptyState) emptyState.hidden = false;
      btnContinuar.disabled = false;
      btnContinuar.textContent = "Continuar para as notas";
      btnSalvar.disabled = true;
      btnSalvar.textContent = "Salvar notas";
      scaleValue && (scaleValue.textContent = "—");
      statusBadge && (statusBadge.textContent = "Nova avaliação");
      footerHeading &&
        (footerHeading.textContent = "Avaliação ainda não registrada");
      footerDescription &&
        (footerDescription.textContent =
          "Preencha as informações e continue para carregar os alunos.");
      feedback("", "info");
      renderDisciplinas();
    }, 0);
  });

  turmaSelect.addEventListener("change", renderDisciplinas);
  disciplinaSelect.addEventListener("change", renderPeriodos);
  btnContinuar.addEventListener("click", continuarParaNotas);
  btnSalvar.addEventListener("click", salvarNotas);
  btnSalvar.disabled = true;

  if (btnAtualizarAbertas) {
    btnAtualizarAbertas.addEventListener("click", carregarAvaliacoesAbertas);
  }

  function voltarAoTopoAvaliacoes() {
    document
      .querySelector("#panel-avaliacoes-abertas .panel-header")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  function aplicarFiltrosAvaliacoes() {
    mostrarTodasAvaliacoesAbertas = false;
    renderAvaliacoesAbertas();
  }

  filtroDataInicialAbertas?.addEventListener(
    "change",
    aplicarFiltrosAvaliacoes,
  );

  filtroDataFinalAbertas?.addEventListener("change", aplicarFiltrosAvaliacoes);

  btnLimparFiltrosAbertas?.addEventListener("click", () => {
    if (filtroDataInicialAbertas) filtroDataInicialAbertas.value = "";
    if (filtroDataFinalAbertas) filtroDataFinalAbertas.value = "";

    mostrarTodasAvaliacoesAbertas = false;
    renderAvaliacoesAbertas();
  });

  btnMostrarMaisAbertas?.addEventListener("click", () => {
    mostrarTodasAvaliacoesAbertas = true;
    renderAvaliacoesAbertas();
  });

  btnMostrarMenosAbertas?.addEventListener("click", () => {
    mostrarTodasAvaliacoesAbertas = false;
    renderAvaliacoesAbertas();
    voltarAoTopoAvaliacoes();
  });

  btnVoltarTopoAbertas?.addEventListener("click", voltarAoTopoAvaliacoes);

  carregarOpcoes().then(() => {
    carregarAvaliacoesAbertas();
  });
});
