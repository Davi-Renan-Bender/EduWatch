/** Coordenação — alertas persistentes, observações e ações pedagógicas. */
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const section = document.getElementById("section-acompanhamento");
    if (!section) return;

    const root = document.createElement("div");
    root.id = "acompanhamento-pedagogico-app";
    root.className = "edu-followup-dashboard";

    const endpoint = new URL("api/academico/acompanhamento.php", document.baseURI).toString();
    const state = { alunos: [], atribuicoes: [], alertas: [], observacoes: [], acoes: [], resumo: {} };
    let feedbackNode;

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    };

    const option = (value, label) => {
      const node = el("option", "", label);
      node.value = value === null || value === undefined ? "" : String(value);
      return node;
    };

    const addField = (form, labelText, control) => {
      const label = el("label", "edu-followup-field");
      label.append(el("span", "edu-followup-field__label", labelText), control);
      form.append(label);
      return control;
    };

    const button = (text, className = "edu-followup-button") => {
      const node = el("button", className, text);
      node.type = "button";
      return node;
    };

    const panel = (title, description) => {
      const box = el("section", "panel section-block edu-followup-panel");
      const header = el("div", "panel-header");
      header.append(el("h2", "", title));
      box.append(header);
      if (description) box.append(el("p", "edu-followup-description", description));
      return box;
    };

    function setFeedback(message, type = "info") {
      feedbackNode.textContent = message;
      feedbackNode.dataset.type = type;
      feedbackNode.hidden = !message;
    }

    async function request(options = {}) {
      let response;
      try {
        response = await fetch(endpoint, {
          method: options.method || "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
          ...(options.body ? { body: options.body } : {}),
        });
      } catch {
        throw new Error("Não foi possível conectar ao EduWatch. Confira o Apache e a conexão com o Supabase.");
      }
      let data;
      try { data = await response.json(); }
      catch { throw new Error("O servidor retornou uma resposta inválida."); }
      if (!response.ok || data.sucesso === false) throw new Error(data.mensagem || "Não foi possível concluir a operação.");
      return data;
    }

    const formRequest = (acao, data) => request({ method: "POST", body: JSON.stringify({ acao, ...data }) });

    function makeTable(headers, aria) {
      const wrap = el("div", "table-wrapper edu-followup-table-wrap");
      const table = el("table", "data-table edu-followup-table");
      table.setAttribute("aria-label", aria);
      const thead = el("thead");
      const headerRow = el("tr");
      headers.forEach((label) => {
        const th = el("th", "", label);
        th.scope = "col";
        headerRow.append(th);
      });
      thead.append(headerRow);
      const tbody = el("tbody");
      table.append(thead, tbody);
      wrap.append(table);
      return { wrap, tbody };
    }

    function renderAlerts() {
      const tbody = root.querySelector("#edu-alertas-body");
      tbody.replaceChildren();
      if (!state.alertas.length) {
        const row = el("tr");
        const cell = el("td", "edu-followup-empty", "Nenhum alerta registrado. Configure e ative as regras na área administrativa e clique em Gerar/atualizar alertas.");
        cell.colSpan = 8;
        row.append(cell);
        tbody.append(row);
      }
      const labels = { aberto: "Aberto", em_andamento: "Em andamento", resolvido: "Resolvido", descartado: "Descartado" };
      state.alertas.forEach((alert) => {
        const row = el("tr");
        row.classList.add(`edu-followup-row--${alert.nivel}`);
        row.append(el("td", "", alert.aluno));
        row.append(el("td", "", alert.turma));
        row.append(el("td", "", `${alert.periodo}${alert.disciplina && alert.disciplina !== "Geral" ? ` · ${alert.disciplina}` : ""}`));
        row.append(el("td", "", alert.regra_nome));
        const level = el("span", `edu-followup-pill edu-followup-pill--${alert.nivel}`, alert.nivel === "critico" ? "Crítico" : "Atenção");
        const levelCell = el("td");
        levelCell.append(level);
        row.append(levelCell);
        let observed = Number(alert.valor_observado);
        let unit = "";
        if (alert.codigo_regra === "frequencia_baixa") unit = "%";
        else if (alert.codigo_regra === "media_baixa" || alert.codigo_regra === "queda_desempenho") unit = " pts";
        else unit = " resultado(s)";
        row.append(el("td", "", `${Number.isFinite(observed) ? observed.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}${unit}`));
        row.append(el("td", "edu-followup-justification", alert.justificativa));

        const statusCell = el("td");
        const statusSelect = el("select", "edu-followup-select edu-followup-select--compact");
        statusSelect.setAttribute("aria-label", `Status do alerta para ${alert.aluno}`);
        Object.entries(labels).forEach(([value, label]) => statusSelect.append(option(value, label)));
        statusSelect.value = alert.status;
        const save = button("Salvar", "edu-followup-button edu-followup-button--small");
        save.addEventListener("click", async () => {
          save.disabled = true;
          try {
            const result = await formRequest("atualizar_alerta", { alerta_id: Number(alert.id), status: statusSelect.value });
            setFeedback(result.mensagem, "success");
            await loadData();
          } catch (error) {
            setFeedback(error.message, "error");
          } finally {
            save.disabled = false;
          }
        });
        const control = el("div", "edu-followup-inline-controls");
        control.append(statusSelect, save);
        statusCell.append(control);
        row.append(statusCell);
        tbody.append(row);
      });

      const selectAlert = root.querySelector("#edu-acao-alerta");
      const previous = selectAlert.value;
      selectAlert.replaceChildren(option("", "Selecione um alerta aberto/em andamento"));
      state.alertas.filter((a) => ["aberto", "em_andamento"].includes(a.status)).forEach((alert) => {
        selectAlert.append(option(alert.id, `${alert.aluno} · ${alert.regra_nome} · ${alert.periodo}`));
      });
      if (Array.from(selectAlert.options).some((o) => o.value === previous)) selectAlert.value = previous;
      selectAlert.disabled = selectAlert.options.length <= 1;
    }

    function renderObservations() {
      const tbody = root.querySelector("#edu-observacoes-body");
      tbody.replaceChildren();
      if (!state.observacoes.length) {
        const row = el("tr");
        const cell = el("td", "edu-followup-empty", "Ainda não há observações pedagógicas registradas.");
        cell.colSpan = 5;
        row.append(cell);
        tbody.append(row);
        return;
      }
      const categoryLabels = {
        dificuldade_conteudo: "Dificuldade no conteúdo",
        participacao: "Participação",
        engajamento: "Engajamento",
        comportamento: "Comportamento",
        outro: "Outro",
      };
      state.observacoes.forEach((obs) => {
        const row = el("tr");
        row.append(el("td", "", formatDate(obs.data_registro, true)));
        row.append(el("td", "", obs.aluno));
        row.append(el("td", "", obs.turma));
        row.append(el("td", "", categoryLabels[obs.categoria] || obs.categoria));
        const description = el("td", "edu-followup-justification", obs.descricao);
        const visibility = el("span", obs.visivel_aluno ? "edu-followup-pill edu-followup-pill--visible" : "edu-followup-pill", obs.visivel_aluno ? "Visível ao aluno" : "Interna");
        description.append(el("br"), visibility);
        row.append(description);
        tbody.append(row);
      });
    }

    function renderActions() {
      const tbody = root.querySelector("#edu-acoes-body");
      tbody.replaceChildren();
      if (!state.acoes.length) {
        const row = el("tr");
        const cell = el("td", "edu-followup-empty", "Nenhuma ação de acompanhamento foi registrada.");
        cell.colSpan = 5;
        row.append(cell);
        tbody.append(row);
        return;
      }
      const statusLabels = { planejada: "Planejada", em_andamento: "Em andamento", concluida: "Concluída", cancelada: "Cancelada" };
      state.acoes.forEach((action) => {
        const row = el("tr");
        row.append(el("td", "", action.alerta_resumo || `Alerta #${action.alerta_id}`));
        row.append(el("td", "", action.tipo_acao));
        row.append(el("td", "edu-followup-justification", action.descricao));
        row.append(el("td", "", `${action.data_acao ? formatDate(action.data_acao) : "—"}${action.data_revisao ? ` · Revisão ${formatDate(action.data_revisao)}` : ""}`));
        row.append(el("td", "", statusLabels[action.status] || action.status));
        tbody.append(row);
      });
    }

    function formatDate(value, withTime = false) {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(date);
    }

    function populateStudents() {
      const select = root.querySelector("#edu-observacao-aluno");
      const current = select.value;
      select.replaceChildren(option("", "Selecione o aluno e a turma"));
      state.alunos.forEach((student) => {
        const item = option(student.matricula_id, `${student.nome} · ${student.turma}`);
        item.dataset.turmaId = String(student.turma_id);
        select.append(item);
      });
      if (Array.from(select.options).some((item) => item.value === current)) select.value = current;
      updateAssignmentOptions();
    }

    function populateAssignments() {
      const select = root.querySelector("#edu-observacao-atribuicao");
      const current = select.value;
      select.replaceChildren(option("", "Observação geral da turma"));
      state.atribuicoes.forEach((assignment) => {
        const item = option(assignment.id, `${assignment.turma} · ${assignment.disciplina}`);
        item.dataset.turmaId = String(assignment.turma_id);
        select.append(item);
      });
      if (Array.from(select.options).some((item) => item.value === current)) select.value = current;
      updateAssignmentOptions();
    }

    function updateAssignmentOptions() {
      const studentSelect = root.querySelector("#edu-observacao-aluno");
      const assignmentSelect = root.querySelector("#edu-observacao-atribuicao");
      const selected = studentSelect.selectedOptions[0];
      const classId = selected?.dataset.turmaId || "";
      const currentValue = assignmentSelect.value;
      Array.from(assignmentSelect.options).forEach((item) => {
        if (!item.value) {
          item.hidden = false;
          item.disabled = false;
          return;
        }
        const matches = classId !== "" && item.dataset.turmaId === classId;
        item.hidden = !matches;
        item.disabled = !matches;
      });
      if (!Array.from(assignmentSelect.options).some((item) => item.value === currentValue && !item.disabled)) assignmentSelect.value = "";
      assignmentSelect.disabled = classId === "";
    }

    async function loadData() {
      try {
        const data = await request();
        Object.assign(state, {
          alunos: Array.isArray(data.alunos) ? data.alunos : [],
          atribuicoes: Array.isArray(data.atribuicoes) ? data.atribuicoes : [],
          alertas: Array.isArray(data.alertas) ? data.alertas : [],
          observacoes: Array.isArray(data.observacoes) ? data.observacoes : [],
          acoes: Array.isArray(data.acoes) ? data.acoes : [],
          resumo: data.resumo || {},
        });
        populateStudents();
        populateAssignments();
        renderAlerts();
        renderObservations();
        renderActions();
      } catch (error) {
        setFeedback(error.message, "error");
      }
    }

    function buildUi() {
      const intro = panel("Monitoramento e acompanhamento pedagógico", "Regras determinísticas e configuráveis; alertas são pistas para análise humana, não diagnósticos automáticos.");
      const actionsBar = el("div", "edu-followup-toolbar");
      const refresh = button("Recarregar dados");
      refresh.addEventListener("click", loadData);
      const generate = button("Gerar / atualizar alertas", "edu-followup-button edu-followup-button--primary");
      generate.addEventListener("click", async () => {
        generate.disabled = true;
        setFeedback("Analisando notas e chamadas fechadas dos períodos atuais…", "info");
        try {
          const result = await formRequest("gerar_alertas", {});
          setFeedback(`${result.mensagem} Criados: ${Number(result.criados || 0)}; atualizados: ${Number(result.atualizados || 0)}.`, "success");
          await loadData();
        } catch (error) {
          setFeedback(error.message, "error");
        } finally {
          generate.disabled = false;
        }
      });
      actionsBar.append(generate, refresh);
      intro.append(actionsBar);

      feedbackNode = el("p", "edu-followup-feedback");
      feedbackNode.hidden = true;
      feedbackNode.setAttribute("role", "status");
      feedbackNode.setAttribute("aria-live", "polite");

      const alertPanel = panel("Alertas ativos e históricos", "Edite o status para indicar se um caso continua aberto, está em andamento, foi resolvido ou foi descartado. Os alertas sem ocorrência atual não são encerrados automaticamente.");
      const alertTable = makeTable(["Aluno", "Turma", "Período / escopo", "Regra", "Nível", "Valor", "Justificativa", "Status / ação"], "Alertas pedagógicos");
      alertTable.tbody.id = "edu-alertas-body";
      alertPanel.append(alertTable.wrap);

      const observationPanel = panel("Registrar observação pedagógica", "Registre dificuldades, participação, engajamento ou comportamento. Marque como visível ao aluno somente quando a observação tiver sido escrita para ser compartilhada.");
      const observationForm = el("form", "edu-followup-form");
      observationForm.id = "edu-observacao-form";
      const studentSelect = el("select", "edu-followup-select");
      studentSelect.id = "edu-observacao-aluno";
      studentSelect.required = true;
      addField(observationForm, "Aluno / matrícula", studentSelect);
      const assignmentSelect = el("select", "edu-followup-select");
      assignmentSelect.id = "edu-observacao-atribuicao";
      assignmentSelect.append(option("", "Observação geral da turma"));
      assignmentSelect.disabled = true;
      addField(observationForm, "Disciplina (opcional)", assignmentSelect);
      const categorySelect = el("select", "edu-followup-select");
      categorySelect.required = true;
      [
        ["dificuldade_conteudo", "Dificuldade no conteúdo"],
        ["participacao", "Participação"],
        ["engajamento", "Engajamento"],
        ["comportamento", "Comportamento"],
        ["outro", "Outro"],
      ].forEach(([value, text]) => categorySelect.append(option(value, text)));
      addField(observationForm, "Categoria", categorySelect);
      const description = el("textarea", "edu-followup-textarea");
      description.rows = 3;
      description.maxLength = 2000;
      description.required = true;
      description.placeholder = "Descreva fatos observáveis, contexto e apoio pedagógico necessário.";
      addField(observationForm, "Descrição (máximo 2.000 caracteres)", description);
      const visibilityLabel = el("label", "edu-followup-check");
      const visibility = el("input");
      visibility.type = "checkbox";
      visibility.id = "edu-observacao-visivel";
      visibilityLabel.append(visibility, el("span", "", "Visível na área do aluno"));
      observationForm.append(visibilityLabel);
      const saveObservation = button("Salvar observação", "edu-followup-button edu-followup-button--primary");
      saveObservation.type = "submit";
      observationForm.append(saveObservation);
      studentSelect.addEventListener("change", updateAssignmentOptions);
      observationForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!observationForm.reportValidity()) return;
        saveObservation.disabled = true;
        try {
          const result = await formRequest("criar_observacao", {
            matricula_id: Number(studentSelect.value),
            turma_disciplina_id: assignmentSelect.value ? Number(assignmentSelect.value) : null,
            categoria: categorySelect.value,
            descricao: description.value.trim(),
            visivel_aluno: visibility.checked,
          });
          setFeedback(result.mensagem, "success");
          observationForm.reset();
          updateAssignmentOptions();
          await loadData();
        } catch (error) {
          setFeedback(error.message, "error");
        } finally {
          saveObservation.disabled = false;
        }
      });
      observationPanel.append(observationForm);

      const actionPanel = panel("Registrar ação de acompanhamento", "Vincule uma intervenção ou contato a um alerta. As ações ficam registradas no banco para consulta posterior.");
      const actionForm = el("form", "edu-followup-form");
      actionForm.id = "edu-acao-form";
      const alertSelect = el("select", "edu-followup-select");
      alertSelect.id = "edu-acao-alerta";
      alertSelect.required = true;
      alertSelect.append(option("", "Carregando alertas…"));
      addField(actionForm, "Alerta vinculado", alertSelect);
      const actionType = el("input", "edu-followup-input");
      actionType.required = true;
      actionType.maxLength = 100;
      actionType.placeholder = "Ex.: conversa individual, contato com responsáveis";
      addField(actionForm, "Tipo de ação", actionType);
      const actionDescription = el("textarea", "edu-followup-textarea");
      actionDescription.rows = 3;
      actionDescription.maxLength = 2000;
      actionDescription.required = true;
      actionDescription.placeholder = "Descreva o que será feito, por quem e com qual objetivo.";
      addField(actionForm, "Descrição da ação", actionDescription);
      const dateRow = el("div", "edu-followup-form-grid");
      const dateAction = el("input", "edu-followup-input");
      dateAction.type = "date";
      const dateReview = el("input", "edu-followup-input");
      dateReview.type = "date";
      addField(dateRow, "Data da ação (opcional)", dateAction);
      addField(dateRow, "Data de revisão (opcional)", dateReview);
      actionForm.append(dateRow);
      const actionStatus = el("select", "edu-followup-select");
      [["planejada", "Planejada"], ["em_andamento", "Em andamento"], ["concluida", "Concluída"], ["cancelada", "Cancelada"]].forEach(([value, text]) => actionStatus.append(option(value, text)));
      addField(actionForm, "Situação", actionStatus);
      const saveAction = button("Salvar ação", "edu-followup-button edu-followup-button--primary");
      saveAction.type = "submit";
      actionForm.append(saveAction);
      actionForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!actionForm.reportValidity()) return;
        saveAction.disabled = true;
        try {
          const result = await formRequest("criar_acao", {
            alerta_id: Number(alertSelect.value),
            tipo_acao: actionType.value.trim(),
            descricao: actionDescription.value.trim(),
            data_acao: dateAction.value || null,
            data_revisao: dateReview.value || null,
            status: actionStatus.value,
          });
          setFeedback(result.mensagem, "success");
          actionForm.reset();
          await loadData();
        } catch (error) {
          setFeedback(error.message, "error");
        } finally {
          saveAction.disabled = false;
        }
      });
      actionPanel.append(actionForm);

      const observationsPanel = panel("Observações registradas", "A lista mostra as observações mais recentes. Observações visíveis ao aluno também aparecem na área de acompanhamento do próprio estudante.");
      const observationsTable = makeTable(["Registrada em", "Aluno", "Turma", "Categoria", "Descrição / visibilidade"], "Observações pedagógicas registradas");
      observationsTable.tbody.id = "edu-observacoes-body";
      observationsPanel.append(observationsTable.wrap);

      const actionsPanel = panel("Histórico de ações", "Ações registradas para alertas recentes.");
      const actionsTable = makeTable(["Alerta", "Tipo", "Descrição", "Datas", "Situação"], "Histórico de ações de acompanhamento");
      actionsTable.tbody.id = "edu-acoes-body";
      actionsPanel.append(actionsTable.wrap);

      root.append(intro, feedbackNode, alertPanel, observationPanel, actionPanel, observationsPanel, actionsPanel);

      // A página ainda conserva uma lista antiga de demonstração, preenchida por
      // coordenacao.js. Mantemos o elemento para compatibilidade com esse script,
      // mas escondemos o painel antigo para não exibir dados de demonstração junto
      // dos dados reais vindos do Supabase.
      const legacyList = section.querySelector("#lista-acompanhamento-coord");
      const legacyPanel = legacyList?.closest(".panel");
      if (legacyPanel) {
        legacyPanel.hidden = true;
        legacyPanel.setAttribute("aria-hidden", "true");
      }

      section.append(root);
    }

    buildUi();
    loadData();
  });
})();
