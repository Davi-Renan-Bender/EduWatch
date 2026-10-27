/** Coordenação — alertas persistentes, observações e ações pedagógicas. */
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    const section = document.getElementById("section-acompanhamento");
    if (!section) return;

    const usuarioAtual = await obterUsuarioLogado();

    const somenteLeituraAdmin =
      usuarioAtual?.nivel === "admin" &&
      new URLSearchParams(window.location.search).get("modo") ===
        "visualizacao";

    const root = document.createElement("div");
    root.id = "acompanhamento-pedagogico-app";
    root.className = "edu-followup-dashboard";

    const endpoint = new URL(
      "api/academico/acompanhamento.php",
      document.baseURI,
    ).toString();
    const state = {
      alunos: [],
      atribuicoes: [],
      alertas: [],
      observacoes: [],
      acoes: [],
      resumo: {},
    };
    let feedbackNode;
    let alertFilterControls = null;
    let alertasExpandidos = false;

    const LIMITE_ALERTAS_INICIAL = 5;

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
      if (description)
        box.append(el("p", "edu-followup-description", description));
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
          headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
          },
          ...(options.body ? { body: options.body } : {}),
        });
      } catch {
        throw new Error(
          "Não foi possível conectar ao EduWatch. Confira o Apache e a conexão com o Supabase.",
        );
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("O servidor retornou uma resposta inválida.");
      }
      if (!response.ok || data.sucesso === false)
        throw new Error(
          data.mensagem || "Não foi possível concluir a operação.",
        );
      return data;
    }

    const formRequest = (acao, data) =>
      request({ method: "POST", body: JSON.stringify({ acao, ...data }) });

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
      if (!tbody) return;

      tbody.replaceChildren();

      const filtros = alertFilterControls;

      const normalizar = (valor) =>
        String(valor ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();

      const busca = normalizar(filtros?.search.value);
      const dataInicial = filtros?.dateStart.value || "";
      const dataFinal = filtros?.dateEnd.value || "";
      const statusSelecionado = filtros?.status.value || "";
      const nivelSelecionado = filtros?.level.value || "";

      const esconderBotoes = () => {
        if (filtros?.showMore) filtros.showMore.hidden = true;
        if (filtros?.showLess) filtros.showLess.hidden = true;
        if (filtros?.backToTop) filtros.backToTop.hidden = true;
      };

      const mostrarMensagemTabela = (mensagem) => {
        const row = el("tr");
        const cell = el("td", "edu-followup-empty", mensagem);
        cell.colSpan = 8;
        row.append(cell);
        tbody.append(row);
      };

      if (dataInicial && dataFinal && dataInicial > dataFinal) {
        if (filtros?.summary) {
          filtros.summary.textContent =
            "A data inicial não pode ser posterior à data final.";
        }

        mostrarMensagemTabela("Corrija o intervalo de datas.");
        esconderBotoes();
        return;
      }

      const filtrados = state.alertas.filter((alert) => {
        const data = String(alert.created_at || "").slice(0, 10);

        if (dataInicial && (!data || data < dataInicial)) return false;
        if (dataFinal && (!data || data > dataFinal)) return false;

        if (statusSelecionado && alert.status !== statusSelecionado) {
          return false;
        }

        if (nivelSelecionado && alert.nivel !== nivelSelecionado) {
          return false;
        }

        if (busca) {
          const texto = normalizar(
            [
              alert.aluno,
              alert.turma,
              alert.regra_nome,
              alert.justificativa,
              alert.periodo,
              alert.disciplina,
            ].join(" "),
          );

          if (!texto.includes(busca)) return false;
        }

        return true;
      });

      const total = filtrados.length;
      const limite = LIMITE_ALERTAS_INICIAL;

      const visiveis = alertasExpandidos
        ? filtrados
        : filtrados.slice(0, limite);

      if (filtros?.summary) {
        filtros.summary.textContent = total
          ? `Exibindo ${visiveis.length} de ${total} alertas.`
          : state.alertas.length
            ? "Nenhum alerta corresponde aos filtros."
            : "Nenhum alerta registrado.";
      }

      // Os botões só aparecem quando há mais de cinco resultados.
      if (filtros?.showMore) {
        filtros.showMore.hidden = total <= limite || alertasExpandidos;
      }

      if (filtros?.showLess) {
        filtros.showLess.hidden = total <= limite || !alertasExpandidos;
      }

      if (filtros?.backToTop) {
        filtros.backToTop.hidden = total <= limite || !alertasExpandidos;
      }

      if (total === 0) {
        mostrarMensagemTabela(
          state.alertas.length
            ? "Nenhum alerta corresponde aos filtros selecionados."
            : "Nenhum alerta registrado. Configure e ative as regras na área administrativa e clique em Gerar/atualizar alertas.",
        );
      } else {
        const labels = {
          aberto: "Aberto",
          em_andamento: "Em andamento",
          resolvido: "Resolvido",
          descartado: "Descartado",
        };

        visiveis.forEach((alert) => {
          const row = el("tr");
          row.classList.add(`edu-followup-row--${alert.nivel}`);

          row.append(el("td", "", alert.aluno));
          row.append(el("td", "", alert.turma));

          row.append(
            el(
              "td",
              "",
              `${alert.periodo}${
                alert.disciplina && alert.disciplina !== "Geral"
                  ? ` · ${alert.disciplina}`
                  : ""
              }`,
            ),
          );

          row.append(el("td", "", alert.regra_nome));

          const levelCell = el("td");
          levelCell.append(
            el(
              "span",
              `edu-followup-pill edu-followup-pill--${alert.nivel}`,
              alert.nivel === "critico" ? "Crítico" : "Atenção",
            ),
          );
          row.append(levelCell);

          const observed = Number(alert.valor_observado);
          const unit =
            alert.codigo_regra === "frequencia_baixa"
              ? "%"
              : ["media_baixa", "queda_desempenho"].includes(alert.codigo_regra)
                ? " pts"
                : " resultado(s)";

          row.append(
            el(
              "td",
              "",
              `${
                Number.isFinite(observed)
                  ? observed.toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })
                  : "—"
              }${unit}`,
            ),
          );

          row.append(
            el("td", "edu-followup-justification", alert.justificativa),
          );

          const statusCell = el("td");
          const statusSelect = el(
            "select",
            "edu-followup-select edu-followup-select--compact",
          );

          statusSelect.setAttribute(
            "aria-label",
            `Status do alerta para ${alert.aluno}`,
          );

          Object.entries(labels).forEach(([value, label]) => {
            statusSelect.append(option(value, label));
          });

          statusSelect.value = alert.status;

          const save = button(
            "Salvar",
            "edu-followup-button edu-followup-button--small",
          );

          save.addEventListener("click", async () => {
            save.disabled = true;

            try {
              const result = await formRequest("atualizar_alerta", {
                alerta_id: Number(alert.id),
                status: statusSelect.value,
              });

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
      }

      // Mantém o formulário de ações vinculado aos alertas ativos.
      const selectAlert = root.querySelector("#edu-acao-alerta");

      if (selectAlert) {
        const previous = selectAlert.value;

        selectAlert.replaceChildren(
          option("", "Selecione um alerta aberto/em andamento"),
        );

        state.alertas
          .filter((alert) => ["aberto", "em_andamento"].includes(alert.status))
          .forEach((alert) => {
            selectAlert.append(
              option(
                alert.id,
                `${alert.aluno} · ${alert.regra_nome} · ${alert.periodo}`,
              ),
            );
          });

        if (
          Array.from(selectAlert.options).some(
            (item) => item.value === previous,
          )
        ) {
          selectAlert.value = previous;
        }

        selectAlert.disabled = selectAlert.options.length <= 1;
      }
    }

    function renderObservations() {
      const tbody = root.querySelector("#edu-observacoes-body");
      tbody.replaceChildren();

      if (!state.observacoes.length) {
        const row = el("tr");
        const cell = el(
          "td",
          "edu-followup-empty",
          "Ainda não há observações pedagógicas registradas.",
        );

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

        row.append(
          el("td", "", categoryLabels[obs.categoria] || obs.categoria),
        );

        const description = el(
          "td",
          "edu-followup-justification",
          obs.descricao,
        );

        const visibility = el(
          "span",
          obs.visivel_aluno
            ? "edu-followup-pill edu-followup-pill--visible"
            : "edu-followup-pill",
          obs.visivel_aluno ? "Visível ao aluno" : "Interna",
        );

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
        const cell = el(
          "td",
          "edu-followup-empty",
          "Nenhuma ação de acompanhamento foi registrada.",
        );
        cell.colSpan = 5;
        row.append(cell);
        tbody.append(row);
        return;
      }
      const statusLabels = {
        planejada: "Planejada",
        em_andamento: "Em andamento",
        concluida: "Concluída",
        cancelada: "Cancelada",
      };
      state.acoes.forEach((action) => {
        const row = el("tr");
        row.append(
          el("td", "", action.alerta_resumo || `Alerta #${action.alerta_id}`),
        );
        row.append(el("td", "", action.tipo_acao));
        row.append(el("td", "edu-followup-justification", action.descricao));
        row.append(
          el(
            "td",
            "",
            `${action.data_acao ? formatDate(action.data_acao) : "—"}${action.data_revisao ? ` · Revisão ${formatDate(action.data_revisao)}` : ""}`,
          ),
        );
        row.append(el("td", "", statusLabels[action.status] || action.status));
        tbody.append(row);
      });
    }

    function formatDate(value, withTime = false) {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat(
        "pt-BR",
        withTime
          ? { dateStyle: "short", timeStyle: "short" }
          : { dateStyle: "short" },
      ).format(date);
    }

    function populateStudents() {
      const select = root.querySelector("#edu-observacao-aluno");
      const current = select.value;
      select.replaceChildren(option("", "Selecione o aluno e a turma"));
      state.alunos.forEach((student) => {
        const item = option(
          student.matricula_id,
          `${student.nome} · ${student.turma}`,
        );
        item.dataset.turmaId = String(student.turma_id);
        select.append(item);
      });
      if (Array.from(select.options).some((item) => item.value === current))
        select.value = current;
      updateAssignmentOptions();
    }

    function populateAssignments() {
      const select = root.querySelector("#edu-observacao-atribuicao");
      const current = select.value;
      select.replaceChildren(option("", "Observação geral da turma"));
      state.atribuicoes.forEach((assignment) => {
        const item = option(
          assignment.id,
          `${assignment.turma} · ${assignment.disciplina}`,
        );
        item.dataset.turmaId = String(assignment.turma_id);
        select.append(item);
      });
      if (Array.from(select.options).some((item) => item.value === current))
        select.value = current;
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
      if (
        !Array.from(assignmentSelect.options).some(
          (item) => item.value === currentValue && !item.disabled,
        )
      )
        assignmentSelect.value = "";
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
      const intro = panel(
        "Monitoramento e acompanhamento pedagógico",
        "Regras determinísticas e configuráveis; alertas são pistas para análise humana, não diagnósticos automáticos.",
      );
      const actionsBar = el("div", "edu-followup-toolbar");
      const refresh = button("Recarregar dados");
      refresh.addEventListener("click", loadData);
      const generate = button(
        "Gerar / atualizar alertas",
        "edu-followup-button edu-followup-button--primary",
      );
      generate.addEventListener("click", async () => {
        generate.disabled = true;
        setFeedback(
          "Analisando notas e chamadas fechadas dos períodos atuais…",
          "info",
        );
        try {
          const result = await formRequest("gerar_alertas", {});
          setFeedback(
            `${result.mensagem} Criados: ${Number(result.criados || 0)}; atualizados: ${Number(result.atualizados || 0)}.`,
            "success",
          );
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

      const alertPanel = panel(
        "Alertas ativos e históricos",
        "Edite o status para indicar se um caso continua aberto, está em andamento, foi resolvido ou foi descartado. Os alertas sem ocorrência atual não são encerrados automaticamente.",
      );

      // Área de filtros
      const alertToolbar = el("div", "edu-followup-alert-filters");

      // Busca por aluno, turma, regra ou justificativa
      const alertSearch = el("input", "edu-followup-input");
      alertSearch.type = "search";
      alertSearch.placeholder = "Aluno, turma, regra ou justificativa";
      alertSearch.setAttribute(
        "aria-label",
        "Buscar alertas por aluno, turma, regra ou justificativa",
      );
      addField(alertToolbar, "Buscar", alertSearch);

      // Data inicial
      const alertDateStart = el("input", "edu-followup-input");
      alertDateStart.type = "date";
      alertDateStart.setAttribute("aria-label", "Data inicial dos alertas");
      addField(alertToolbar, "Data inicial", alertDateStart);

      // Data final
      const alertDateEnd = el("input", "edu-followup-input");
      alertDateEnd.type = "date";
      alertDateEnd.setAttribute("aria-label", "Data final dos alertas");
      addField(alertToolbar, "Data final", alertDateEnd);

      // Filtro de status
      const alertStatusFilter = el("select", "edu-followup-select");

      [
        ["", "Todos os status"],
        ["aberto", "Aberto"],
        ["em_andamento", "Em andamento"],
        ["resolvido", "Resolvido"],
        ["descartado", "Descartado"],
      ].forEach(([value, label]) => {
        alertStatusFilter.append(option(value, label));
      });

      addField(alertToolbar, "Status", alertStatusFilter);

      // Filtro de nível
      const alertLevelFilter = el("select", "edu-followup-select");

      [
        ["", "Todos os níveis"],
        ["atencao", "Atenção"],
        ["critico", "Crítico"],
      ].forEach(([value, label]) => {
        alertLevelFilter.append(option(value, label));
      });

      addField(alertToolbar, "Nível", alertLevelFilter);

      // Limpar filtros
      const clearAlertFilters = button(
        "Limpar filtros",
        "edu-followup-button edu-followup-button--small",
      );

      alertToolbar.append(clearAlertFilters);

      // Resumo dos registros encontrados
      const alertSummary = el(
        "p",
        "edu-followup-alert-summary",
        "Carregando alertas...",
      );

      alertSummary.setAttribute("role", "status");
      alertSummary.setAttribute("aria-live", "polite");

      // Tabela existente
      const alertTable = makeTable(
        [
          "Aluno",
          "Turma",
          "Período / escopo",
          "Regra",
          "Nível",
          "Valor",
          "Justificativa",
          "Status / ação",
        ],
        "Alertas pedagógicos",
      );

      alertTable.tbody.id = "edu-alertas-body";

      // Botões de navegação da lista
      const alertActions = el("div", "edu-followup-alert-actions");

      const showMoreAlerts = button(
        "Mostrar mais",
        "edu-followup-button edu-followup-button--primary",
      );

      const showLessAlerts = button("Mostrar menos", "edu-followup-button");

      const backToAlertTop = button("Voltar ao início", "edu-followup-button");

      showMoreAlerts.hidden = true;
      showLessAlerts.hidden = true;
      backToAlertTop.hidden = true;

      alertActions.append(showMoreAlerts, showLessAlerts, backToAlertTop);

      // Guarda as referências para a próxima etapa
      alertFilterControls = {
        search: alertSearch,
        dateStart: alertDateStart,
        dateEnd: alertDateEnd,
        status: alertStatusFilter,
        level: alertLevelFilter,
        clear: clearAlertFilters,
        summary: alertSummary,
        showMore: showMoreAlerts,
        showLess: showLessAlerts,
        backToTop: backToAlertTop,
        panel: alertPanel,
      };

      alertPanel.append(
        alertToolbar,
        alertSummary,
        alertTable.wrap,
        alertActions,
      );

      const observationPanel = panel(
        "Registrar observação pedagógica",
        "Registre dificuldades, participação, engajamento ou comportamento. Marque como visível ao aluno somente quando a observação tiver sido escrita para ser compartilhada.",
      );
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
      description.placeholder =
        "Descreva fatos observáveis, contexto e apoio pedagógico necessário.";
      addField(
        observationForm,
        "Descrição (máximo 2.000 caracteres)",
        description,
      );
      const visibilityLabel = el("label", "edu-followup-check");
      const visibility = el("input");
      visibility.type = "checkbox";
      visibility.id = "edu-observacao-visivel";
      visibilityLabel.append(
        visibility,
        el("span", "", "Visível na área do aluno"),
      );
      observationForm.append(visibilityLabel);
      const saveObservation = button(
        "Salvar observação",
        "edu-followup-button edu-followup-button--primary",
      );
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
            turma_disciplina_id: assignmentSelect.value
              ? Number(assignmentSelect.value)
              : null,
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

      const actionPanel = panel(
        "Registrar ação de acompanhamento",
        "Vincule uma intervenção ou contato a um alerta. As ações ficam registradas no banco para consulta posterior.",
      );
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
      actionType.placeholder =
        "Ex.: conversa individual, contato com responsáveis";
      addField(actionForm, "Tipo de ação", actionType);
      const actionDescription = el("textarea", "edu-followup-textarea");
      actionDescription.rows = 3;
      actionDescription.maxLength = 2000;
      actionDescription.required = true;
      actionDescription.placeholder =
        "Descreva o que será feito, por quem e com qual objetivo.";
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
      [
        ["planejada", "Planejada"],
        ["em_andamento", "Em andamento"],
        ["concluida", "Concluída"],
        ["cancelada", "Cancelada"],
      ].forEach(([value, text]) => actionStatus.append(option(value, text)));
      addField(actionForm, "Situação", actionStatus);
      const saveAction = button(
        "Salvar ação",
        "edu-followup-button edu-followup-button--primary",
      );
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

      const observationsPanel = panel(
        "Observações registradas",
        "A lista mostra as observações mais recentes. Observações visíveis ao aluno também aparecem na área de acompanhamento do próprio estudante.",
      );
      const observationsTable = makeTable(
        [
          "Registrada em",
          "Aluno",
          "Turma",
          "Categoria",
          "Descrição / visibilidade",
        ],
        "Observações pedagógicas registradas",
      );
      observationsTable.tbody.id = "edu-observacoes-body";
      observationsPanel.append(observationsTable.wrap);

      const actionsPanel = panel(
        "Histórico de ações",
        "Ações registradas para alertas recentes.",
      );
      const actionsTable = makeTable(
        ["Alerta", "Tipo", "Descrição", "Datas", "Situação"],
        "Histórico de ações de acompanhamento",
      );
      actionsTable.tbody.id = "edu-acoes-body";
      actionsPanel.append(actionsTable.wrap);

      root.append(
        intro,
        feedbackNode,
        alertPanel,
        observationPanel,
        actionPanel,
        observationsPanel,
        actionsPanel,
      );

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
    // Filtros: reinicia a lista recolhida ao mudar qualquer critério.
    function aplicarFiltrosAlertas() {
      alertasExpandidos = false;
      renderAlerts();
    }

    alertFilterControls.search.addEventListener("input", aplicarFiltrosAlertas);

    [
      alertFilterControls.dateStart,
      alertFilterControls.dateEnd,
      alertFilterControls.status,
      alertFilterControls.level,
    ].forEach((controle) => {
      controle.addEventListener("change", aplicarFiltrosAlertas);
    });

    alertFilterControls.clear.addEventListener("click", () => {
      alertFilterControls.search.value = "";
      alertFilterControls.dateStart.value = "";
      alertFilterControls.dateEnd.value = "";
      alertFilterControls.status.value = "";
      alertFilterControls.level.value = "";

      alertasExpandidos = false;
      renderAlerts();
    });

    alertFilterControls.showMore.addEventListener("click", () => {
      alertasExpandidos = true;
      renderAlerts();
    });

    alertFilterControls.showLess.addEventListener("click", () => {
      alertasExpandidos = false;
      renderAlerts();

      alertFilterControls.panel.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    alertFilterControls.backToTop.addEventListener("click", () => {
      alertFilterControls.panel.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    if (somenteLeituraAdmin) {
      root.querySelectorAll("input, select, textarea").forEach((controle) => {
        controle.disabled = true;
      });

      root.querySelectorAll("button").forEach((botao) => {
        if (botao.textContent.trim() !== "Recarregar dados") {
          botao.disabled = true;
        }
      });

      const aviso = el(
        "p",
        "edu-followup-feedback",
        "Modo de visualização: somente a coordenação pode alterar regras, alertas e registros de acompanhamento.",
      );

      root.prepend(aviso);
    }

    loadData();
  });
})();
