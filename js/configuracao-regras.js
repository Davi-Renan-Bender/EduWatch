/** Administração — configuração explícita das regras pedagógicas do EduWatch. */
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const main = document.querySelector("main.admin-main");
    const anchor = main?.querySelector(".admin-area-grid");
    if (!main || !anchor || document.getElementById("edu-regra-configuracao-app")) return;

    const endpoint = new URL("api/academico/acompanhamento.php", document.baseURI).toString();
    const defaults = {
      media_baixa: { attention: 7, critical: 5, minimum: 1, direction: "abaixo" },
      frequencia_baixa: { attention: 90, critical: 75, minimum: 1, direction: "abaixo" },
      queda_desempenho: { attention: 1, critical: 2, minimum: 2, direction: "queda" },
      resultados_consecutivos_baixos: { attention: 2, critical: 3, minimum: 2, direction: "acima", notaLimite: 5 },
    };
    let rules = [];
    let feedbackNode;

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    };

    function button(text, className = "edu-rule-button") {
      const node = el("button", className, text);
      node.type = "button";
      return node;
    }

    function field(labelText, control, helpText = "") {
      const wrapper = el("label", "edu-rule-field");
      wrapper.append(el("span", "edu-rule-field__label", labelText), control);
      if (helpText) wrapper.append(el("small", "edu-rule-field__help", helpText));
      return wrapper;
    }

    async function request(options = {}) {
      let response;
      try {
        response = await fetch(options.url || endpoint, {
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
        throw new Error("Não foi possível conectar ao EduWatch. Confira o Apache e tente novamente.");
      }
      let data;
      try { data = await response.json(); }
      catch { throw new Error("O servidor retornou uma resposta inválida."); }
      if (!response.ok || data.sucesso === false) {
        throw new Error(data.mensagem || "Não foi possível carregar ou salvar as regras.");
      }
      return data;
    }

    function feedback(message, type = "info") {
      feedbackNode.textContent = message;
      feedbackNode.dataset.type = type;
      feedbackNode.hidden = !message;
    }

    function numInput(value, min, max, step = "1") {
      const node = el("input", "edu-rule-input");
      node.type = "number";
      node.min = String(min);
      if (max !== null) node.max = String(max);
      node.step = step;
      node.value = value === null || value === undefined || value === "" ? "" : String(value);
      node.required = true;
      return node;
    }

    function renderRules() {
      const cards = root.querySelector("#edu-rule-cards");
      cards.replaceChildren();
      if (!rules.length) {
        cards.append(el("p", "edu-rule-empty", "Nenhuma configuração de acompanhamento foi encontrada. Confirme se configuracoes_acompanhamento contém as quatro regras iniciais do EduWatch."));
        return;
      }

      rules.forEach((rule) => {
        const defaultsForRule = defaults[rule.codigo] || { attention: 7, critical: 5, minimum: 1, direction: "abaixo" };
        let params = rule.parametros || {};
        if (typeof params === "string") {
          try { params = JSON.parse(params); } catch { params = {}; }
        }
        if (!params || typeof params !== "object" || Array.isArray(params)) params = {};

        const card = el("article", "edu-rule-card");
        const heading = el("div", "edu-rule-card__heading");
        const titleGroup = el("div", "edu-rule-card__title-group");
        titleGroup.append(el("h3", "edu-rule-card__title", rule.nome || rule.codigo));
        titleGroup.append(el("p", "edu-rule-card__description", rule.descricao || "Configure quando esta regra pode gerar um alerta para análise humana."));
        const status = el("span", `edu-rule-status${rule.ativo ? " edu-rule-status--active" : ""}`, rule.ativo ? "Ativa" : "Inativa");
        heading.append(titleGroup, status);
        card.append(heading);

        const form = el("form", "edu-rule-form");
        const enabledLabel = el("label", "edu-rule-switch");
        const enabled = el("input");
        enabled.type = "checkbox";
        enabled.checked = rule.ativo === true || rule.ativo === "true";
        enabledLabel.append(enabled, el("span", "", "Ativar esta regra"));
        form.append(enabledLabel);

        const direction = rule.codigo === "queda_desempenho" ? "queda" :
          rule.codigo === "resultados_consecutivos_baixos" ? "acima" : "abaixo";
        const attMax = rule.codigo === "frequencia_baixa" ? 100 :
          (rule.codigo === "media_baixa" || rule.codigo === "queda_desempenho") ? 10 : 100;
        const attStep = rule.codigo === "resultados_consecutivos_baixos" ? "1" : "0.1";
        const attVal = rule.valor_atencao ?? defaultsForRule.attention;
        const criticalVal = rule.valor_critico ?? defaultsForRule.critical;
        const attention = numInput(attVal, 0, attMax, attStep);
        const critical = numInput(criticalVal, 0, attMax, attStep);
        const minimum = numInput(rule.minimo_registros ?? defaultsForRule.minimum, 1, 100, "1");
        const labels = rule.codigo === "media_baixa" ? ["Limite de Atenção (nota de 0 a 10)", "Limite Crítico (nota de 0 a 10)"] :
          rule.codigo === "frequencia_baixa" ? ["Limite de Atenção (%)", "Limite Crítico (%)"] :
          rule.codigo === "queda_desempenho" ? ["Queda para Atenção (pontos)", "Queda para Crítico (pontos)"] :
          ["Quantidade para Atenção", "Quantidade para Crítico"];
        const grid = el("div", "edu-rule-grid");
        grid.append(field(labels[0], attention), field(labels[1], critical));
        grid.append(field("Mínimo de registros necessários", minimum, "O EduWatch não calcula um indicador sem a quantidade mínima de dados definida aqui."));
        form.append(grid);

        let noteLimit = null;
        if (rule.codigo === "resultados_consecutivos_baixos") {
          noteLimit = numInput(params.nota_limite ?? defaultsForRule.notaLimite ?? 5, 0, 10, "0.1");
          form.append(field("Nota considerada baixa (escala de 0 a 10)", noteLimit, "Cada nota é normalizada para uma escala de 0 a 10 antes da comparação."));
        }

        const explanation = el("p", "edu-rule-explanation", rule.codigo === "media_baixa"
          ? "Calcula uma média ponderada das avaliações publicadas, normalizada para 0–10."
          : rule.codigo === "frequencia_baixa"
            ? "Considera somente chamadas de aulas realizadas e fechadas. Atrasos contam como presença; faltas justificadas são exibidas separadamente."
            : rule.codigo === "queda_desempenho"
              ? "Compara a média ponderada do período letivo atual com a do período anterior do mesmo ano."
              : "Analisa, por disciplina, a sequência mais recente de notas publicadas abaixo do limite configurado.");
        form.append(explanation);

        const save = button("Salvar regra", "edu-rule-button edu-rule-button--primary");
        save.type = "submit";
        form.append(save);
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          save.disabled = true;
          save.textContent = "Salvando…";
          const paramsToSave = { ...params };
          if (noteLimit) paramsToSave.nota_limite = Number(noteLimit.value);
          try {
            const result = await request({
              method: "POST",
              body: JSON.stringify({
                acao: "salvar_regra",
                codigo: rule.codigo,
                ativo: enabled.checked,
                direcao,
                valor_atencao: Number(attention.value),
                valor_critico: Number(critical.value),
                minimo_registros: Number(minimum.value),
                parametros: paramsToSave,
              }),
            });
            feedback(result.mensagem || "Regra salva.", "success");
            await loadRules();
          } catch (error) {
            feedback(error.message, "error");
          } finally {
            save.disabled = false;
            save.textContent = "Salvar regra";
          }
        });

        card.append(form);
        cards.append(card);
      });
    }

    async function loadRules() {
      try {
        const url = new URL(endpoint);
        url.searchParams.set("apenas", "regras");
        const data = await request({ url: url.toString() });
        rules = Array.isArray(data.regras) ? data.regras : [];
        renderRules();
        if (!rules.length) feedback("Não há regras cadastradas. O módulo não cria regras no banco automaticamente.", "warning");
      } catch (error) {
        feedback(error.message, "error");
      }
    }

    const root = el("section", "edu-rule-dashboard");
    root.id = "edu-regra-configuracao-app";
    root.setAttribute("aria-labelledby", "edu-rule-heading");
    const header = el("div", "edu-rule-header");
    const intro = el("div");
    intro.append(el("span", "edu-rule-eyebrow", "CONFIGURAÇÃO DO SISTEMA"));
    intro.append(el("h2", "edu-rule-heading", "Regras de acompanhamento pedagógico"));
    intro.querySelector("h2").id = "edu-rule-heading";
    intro.append(el("p", "edu-rule-description", "Defina limites transparentes para gerar alertas que orientam a análise da equipe pedagógica. Os valores sugeridos são apenas ponto de partida e precisam ser aprovados pela escola."));
    const reload = button("Atualizar regras");
    reload.addEventListener("click", loadRules);
    header.append(intro, reload);
    feedbackNode = el("p", "edu-rule-feedback");
    feedbackNode.hidden = true;
    feedbackNode.setAttribute("role", "status");
    feedbackNode.setAttribute("aria-live", "polite");
    const disclaimer = el("p", "edu-rule-disclaimer", "As regras começam inativas. Ativar uma regra não gera alerta automaticamente: a coordenação precisa abrir o Acompanhamento e clicar em “Gerar / atualizar alertas”. Um alerta é um sinal para investigação humana, não um diagnóstico do estudante.");
    const cards = el("div", "edu-rule-cards");
    cards.id = "edu-rule-cards";
    root.append(header, feedbackNode, disclaimer, cards);
    anchor.insertAdjacentElement("afterend", root);

    loadRules();
  });
})();
