// EduWatch — chamada e frequência do professor.
(function () {
  const estado = {
    atribuicoes: [],
    periodos: [],
    alunos: [],
    aula: null,
    aulas: [],
  };
  const $ = (id) => document.getElementById(id);
  const statusRotulos = {
    presente: "Presente",
    ausente: "Ausente",
    atraso: "Atraso",
    justificada: "Falta justificada",
  };

  function elemento(tag, texto, classe) {
    const node = document.createElement(tag);
    if (texto !== undefined && texto !== null) node.textContent = String(texto);
    if (classe) node.className = classe;
    return node;
  }
  function mensagem(texto, tipo = "info") {
    const box = $("frequencia-mensagem");
    if (!box) return;
    box.textContent = texto || "";
    box.hidden = !texto;
    box.className = `attendance-message attendance-message--${tipo}`;
  }
  async function requisitar(url, options = {}) {
    let response;
    try {
      response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
        headers: { Accept: "application/json", ...(options.headers || {}) },
      });
    } catch {
      throw new Error(
        "Não foi possível conectar ao EduWatch. Confira o Apache e tente novamente.",
      );
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("O servidor retornou uma resposta inválida.");
    }
    if (!response.ok || data.sucesso !== true)
      throw new Error(data.mensagem || "Não foi possível concluir a operação.");
    return data;
  }
  function setOptions(select, options, placeholder, labelFn, valueFn) {
    select.replaceChildren(elemento("option", placeholder));
    select.options[0].value = "";
    options.forEach((item) => {
      const option = elemento("option", labelFn(item));
      option.value = String(valueFn(item));
      select.append(option);
    });
  }
  function atribuicaoAtual() {
    return (
      estado.atribuicoes.find(
        (item) => String(item.id) === $("frequencia-atribuicao").value,
      ) || null
    );
  }
  function periodoAtual() {
    return (
      estado.periodos.find(
        (item) => String(item.id) === $("frequencia-periodo").value,
      ) || null
    );
  }
  function travarChamada(travada) {
    $("frequencia-salvar").disabled = travada || !estado.alunos.length;
    $("frequencia-fechar").disabled = travada || !estado.alunos.length;
    document.querySelectorAll(".attendance-status-select").forEach((select) => {
      select.disabled = travada;
    });
  }
  async function carregarOpcoes() {
    const data = await requisitar("api/academico/frequencia.php");
    estado.atribuicoes = data.atribuicoes || [];
    estado.periodos = data.periodos || [];
    setOptions(
      $("frequencia-atribuicao"),
      estado.atribuicoes,
      "Selecione turma e disciplina",
      (item) => `${item.turma} — ${item.disciplina}`,
      (item) => item.id,
    );
    atualizarPeriodos();
    await carregarAulas();
  }
  function atualizarPeriodos() {
    const assignment = atribuicaoAtual();
    const periods = assignment
      ? estado.periodos.filter(
          (item) =>
            Number(item.ano_letivo_id) === Number(assignment.ano_letivo_id),
        )
      : [];
    setOptions(
      $("frequencia-periodo"),
      periods,
      assignment ? "Selecione o período" : "Selecione a turma primeiro",
      (item) => item.nome,
      (item) => item.id,
    );
    $("frequencia-periodo").disabled = !assignment;
  }
  async function carregarAulas() {
    const assignment = atribuicaoAtual();
    const period = periodoAtual();
    estado.aulas = [];
    setOptions(
      $("frequencia-aula"),
      [],
      "Selecione uma aula",
      (item) => item.label,
      (item) => item.id,
    );
    $("frequencia-aula").disabled = true;
    limparChamada();
    if (!assignment || !period) return;
    try {
      const params = new URLSearchParams({
        turma_disciplina_id: assignment.id,
        periodo_letivo_id: period.id,
      });
      const data = await requisitar(`api/academico/frequencia.php?${params}`);
      estado.aulas = data.aulas || [];
      setOptions(
        $("frequencia-aula"),
        estado.aulas,
        estado.aulas.length
          ? "Selecione uma aula"
          : "Nenhuma aula cadastrada neste período",
        (aula) =>
          `${aula.data_aula} — ${aula.tema || "Aula sem tema"} (${aula.status === "realizada" ? "realizada" : aula.status === "cancelada" ? "cancelada" : "planejada"}${aula.frequencia_fechada ? ", chamada fechada" : ""})`,
        (aula) => aula.id,
      );
      $("frequencia-aula").disabled = !estado.aulas.length;
    } catch (error) {
      mensagem(error.message, "erro");
    }
  }
  function limparChamada() {
    estado.alunos = [];
    estado.aula = null;
    $("frequencia-resumo-aula").hidden = true;
    $("frequencia-resumo-aula").replaceChildren();
    $("frequencia-alunos-corpo").replaceChildren();
    const row = document.createElement("tr");
    const cell = elemento("td", "Selecione uma aula para carregar os alunos.");
    cell.colSpan = 2;
    row.append(cell);
    $("frequencia-alunos-corpo").append(row);
    travarChamada(true);
  }
  async function carregarChamada() {
    const aulaId = $("frequencia-aula").value;
    limparChamada();
    if (!aulaId) return;
    try {
      const data = await requisitar(
        `api/academico/frequencia.php?aula_id=${encodeURIComponent(aulaId)}`,
      );
      estado.aula = data.aula;
      estado.alunos = data.alunos || [];
      renderizarChamada();
      mensagem(
        "Chamada carregada. Revise os status e salve antes de fechar a frequência.",
        "info",
      );
    } catch (error) {
      mensagem(error.message, "erro");
    }
  }
  function renderizarChamada() {
    const aula = estado.aula;
    const resumo = $("frequencia-resumo-aula");
    resumo.hidden = false;
    resumo.replaceChildren(
      elemento("strong", `${aula.data_aula} — ${aula.tema || "Aula sem tema"}`),
      elemento(
        "span",
        aula.frequencia_fechada
          ? "Chamada fechada"
          : aula.status === "realizada"
            ? "Aula realizada · chamada aberta"
            : "Aula planejada",
      ),
    );
    const body = $("frequencia-alunos-corpo");
    body.replaceChildren();
    if (!estado.alunos.length) {
      const row = document.createElement("tr");
      const cell = elemento(
        "td",
        "Não há alunos com matrícula ativa nesta turma.",
      );
      cell.colSpan = 2;
      row.append(cell);
      body.append(row);
    } else {
      estado.alunos.forEach((aluno) => {
        const row = document.createElement("tr");
        row.append(elemento("td", aluno.nome));
        const cell = document.createElement("td");
        const select = document.createElement("select");
        select.className = "attendance-status-select";
        select.dataset.matriculaId = String(aluno.matricula_id);
        select.setAttribute("aria-label", `Situação de ${aluno.nome}`);
        Object.entries(statusRotulos).forEach(([value, label]) => {
          const option = elemento("option", label);
          option.value = value;
          select.append(option);
        });
        select.value = aluno.status || "presente";
        cell.append(select);
        row.append(cell);
        body.append(row);
      });
    }
    travarChamada(Boolean(aula.frequencia_fechada) || !estado.alunos.length);
  }
  async function criarAula() {
    const assignment = atribuicaoAtual();
    const period = periodoAtual();
    if (!assignment || !period) {
      mensagem("Selecione a turma/disciplina e o período letivo.", "erro");
      return;
    }
    const data = $("frequencia-data").value;
    if (!data) {
      mensagem("Informe a data da aula.", "erro");
      return;
    }
    const button = $("frequencia-criar-aula");
    button.disabled = true;
    try {
      const result = await requisitar("api/academico/frequencia.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "criar_aula",
          turma_disciplina_id: Number(assignment.id),
          periodo_letivo_id: Number(period.id),
          data_aula: data,
          tema: $("frequencia-tema").value.trim(),
        }),
      });
      mensagem(result.mensagem, "sucesso");
      await carregarAulas();
      $("frequencia-aula").value = String(result.aula.id);
      await carregarChamada();
    } catch (error) {
      mensagem(error.message, "erro");
    } finally {
      button.disabled = false;
    }
  }
  function payloadFrequencias() {
    return Array.from(
      document.querySelectorAll(".attendance-status-select"),
    ).map((select) => ({
      matricula_id: Number(select.dataset.matriculaId),
      status: select.value,
    }));
  }
  async function salvarChamada() {
    if (!estado.aula || !estado.alunos.length) return;
    const button = $("frequencia-salvar");
    button.disabled = true;
    try {
      const result = await requisitar("api/academico/frequencia.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "salvar_chamada",
          aula_id: Number(estado.aula.id),
          frequencias: payloadFrequencias(),
        }),
      });
      mensagem(result.mensagem, "sucesso");
    } catch (error) {
      mensagem(error.message, "erro");
    } finally {
      travarChamada(Boolean(estado.aula?.frequencia_fechada));
    }
  }
  async function fecharChamada() {
    if (!estado.aula || !estado.alunos.length) return;
    if (
      !window.confirm(
        "Fechar a frequência desta aula? Depois disso, os status não poderão ser alterados.",
      )
    )
      return;
    const button = $("frequencia-fechar");
    button.disabled = true;
    try {
      const aulaId = Number(estado.aula.id);
      const result = await requisitar("api/academico/frequencia.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "fechar_chamada", aula_id: aulaId }),
      });
      mensagem(result.mensagem, "sucesso");
      await carregarAulas();
      $("frequencia-aula").value = String(aulaId);
      await carregarChamada();
    } catch (error) {
      mensagem(error.message, "erro");
    } finally {
      button.disabled = false;
    }
  }
  async function inicializar() {
    if (!($("frequencia-atribuicao") && $("frequencia-aula"))) return;
    const hoje = new Date();
    $("frequencia-data").value =
      `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    $("frequencia-atribuicao").addEventListener("change", () => {
      atualizarPeriodos();
      carregarAulas();
    });
    $("frequencia-periodo").addEventListener("change", carregarAulas);
    $("frequencia-aula").addEventListener("change", carregarChamada);
    $("frequencia-criar-aula").addEventListener("click", criarAula);
    $("frequencia-salvar").addEventListener("click", salvarChamada);
    $("frequencia-fechar").addEventListener("click", fecharChamada);
    try {
      await carregarOpcoes();
    } catch (error) {
      mensagem(error.message, "erro");
    }
  }
  window.EduWatchFrequencia = { inicializar };
})();
