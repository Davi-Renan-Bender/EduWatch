/**
 * EduWatch — frequência do aluno.
 * Consome apenas a API PHP autenticada; não usa credenciais do Supabase no navegador.
 */
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const section = document.getElementById("section-frequencia");
    if (!section) return;

    const mensagemOriginal = section.querySelector(
      "#mensagem-frequencia-aluno",
    );
    const mensagem = mensagemOriginal || document.createElement("p");
    mensagem.id = "mensagem-frequencia-aluno";
    mensagem.classList.add("student-attendance-message");
    mensagem.setAttribute("role", "status");
    mensagem.setAttribute("aria-live", "polite");
    mensagem.textContent = "Carregando seus registros de frequência…";

    let chartDisciplina = null;
    let chartEvolucao = null;

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    };

    const statusLabel = (status) =>
      ({
        normal: "Normal",
        atencao: "Atenção",
        critico: "Crítico",
        sem_dados: "Sem dados",
        presente: "Presente",
        atraso: "Atraso",
        ausente: "Ausente",
        justificada: "Falta justificada",
      })[status] || "Não informado";

    const formatPercent = (value) => {
      if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
      )
        return "—";
      return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    };

    const formatDate = (value) => {
      if (!value) return "—";
      const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return String(value);
      return `${match[3]}/${match[2]}/${match[1]}`;
    };

    const statusBadge = (status) => {
      const badge = el(
        "span",
        `student-attendance-badge student-attendance-badge--${status || "sem_dados"}`,
        statusLabel(status),
      );
      return badge;
    };

    const appendCell = (row, value, className = "") => {
      const cell = el("td", className);
      if (value instanceof Node) cell.append(value);
      else
        cell.textContent =
          value === null || value === undefined || value === ""
            ? "—"
            : String(value);
      row.append(cell);
      return cell;
    };

    const makePanel = (title, description) => {
      const panel = el(
        "section",
        "panel section-block student-attendance-panel",
      );
      const header = el("div", "panel-header");
      header.append(el("h2", "", title));
      panel.append(header);
      if (description)
        panel.append(el("p", "student-attendance-description", description));
      return panel;
    };

    const makeKpi = (label, value, detail) => {
      const card = el("article", "student-attendance-kpi");
      card.append(el("p", "student-attendance-kpi__label", label));
      card.append(el("strong", "student-attendance-kpi__value", value));
      if (detail)
        card.append(el("p", "student-attendance-kpi__detail", detail));
      return card;
    };

    const makeTable = (labels, ariaLabel) => {
      const wrapper = el(
        "div",
        "table-wrapper student-attendance-table-wrapper",
      );
      const table = el("table", "data-table student-attendance-table");
      table.setAttribute("aria-label", ariaLabel);
      const thead = el("thead");
      const headerRow = el("tr");
      labels.forEach((label) => {
        const th = el("th", "", label);
        th.scope = "col";
        headerRow.append(th);
      });
      thead.append(headerRow);
      const tbody = el("tbody");
      table.append(thead, tbody);
      wrapper.append(table);
      return { wrapper, tbody };
    };

    function buildUi() {
      let root = section.querySelector("#frequencia-aluno-dados");
      if (root) {
        const existingKpis =
          root.querySelector("#kpi-frequencia-aluno") ||
          root.querySelector("#frequencia-aluno-kpis");
        const existingBody =
          root.querySelector("#tabela-frequencia-corpo") ||
          root.querySelector("#tabela-frequencia-disciplinas-corpo");
        return {
          root,
          kpis: existingKpis,
          chartDisciplinaCanvas: root.querySelector(
            "#grafico-frequencia-aluno",
          ),
          chartDisciplinaState: root.querySelector(
            "#estado-grafico-frequencia-aluno",
          ),
          chartEvolucaoCanvas: root.querySelector(
            "#grafico-evolucao-frequencia-aluno",
          ),
          chartEvolucaoState: root.querySelector(
            "#estado-grafico-evolucao-frequencia-aluno",
          ),
          disciplinasBody: existingBody,
          historicoBody: root.querySelector(
            "#tabela-historico-frequencia-corpo",
          ),
          observacoesBody: root.querySelector(
            "#tabela-observacoes-visiveis-corpo",
          ),
        };
      }

      root = el("div", "student-attendance-dashboard");
      root.id = "frequencia-aluno-dados";

      // A versão pública da página já possui uma área de KPIs e uma tabela de
      // frequência. Reutilizamos esses elementos e seus IDs para evitar que o
      // módulo novo duplique a interface ou que scripts antigos encontrem null.
      const existingKpis = section.querySelector("#kpi-frequencia-aluno");
      let kpis = existingKpis;
      if (kpis) {
        kpis.classList.add("student-attendance-kpis");
        const wrapper = kpis.closest(".section-block") || kpis;
        root.append(wrapper);
      } else {
        kpis = el("div", "student-attendance-kpis");
        kpis.id = "frequencia-aluno-kpis";
        root.append(kpis);
      }

      const charts = el("div", "student-attendance-charts");
      const chartDisciplinaPanel = makePanel(
        "Frequência por disciplina",
        "Percentual calculado a partir das chamadas de aulas realizadas e fechadas.",
      );
      const chartDisciplinaCanvas = el("canvas", "student-attendance-chart");
      chartDisciplinaCanvas.id = "grafico-frequencia-aluno";
      chartDisciplinaCanvas.setAttribute("role", "img");
      chartDisciplinaCanvas.setAttribute(
        "aria-label",
        "Gráfico de frequência percentual por disciplina",
      );
      const chartDisciplinaState = el(
        "p",
        "student-attendance-chart-state",
        "Aguardando dados…",
      );
      chartDisciplinaState.id = "estado-grafico-frequencia-aluno";
      chartDisciplinaPanel.append(chartDisciplinaCanvas, chartDisciplinaState);

      const chartEvolucaoPanel = makePanel(
        "Evolução da frequência",
        "Comparação da frequência entre períodos letivos com registros.",
      );
      const chartEvolucaoCanvas = el("canvas", "student-attendance-chart");
      chartEvolucaoCanvas.id = "grafico-evolucao-frequencia-aluno";
      chartEvolucaoCanvas.setAttribute("role", "img");
      chartEvolucaoCanvas.setAttribute(
        "aria-label",
        "Gráfico de evolução da frequência por período letivo",
      );
      const chartEvolucaoState = el(
        "p",
        "student-attendance-chart-state",
        "Aguardando dados…",
      );
      chartEvolucaoState.id = "estado-grafico-evolucao-frequencia-aluno";
      chartEvolucaoPanel.append(chartEvolucaoCanvas, chartEvolucaoState);
      charts.append(chartDisciplinaPanel, chartEvolucaoPanel);

      let existingBody =
        section.querySelector("#tabela-frequencia-corpo") ||
        section.querySelector("#tabela-frequencia-disciplinas-corpo");
      let disciplinePanel;
      let disciplineBody;
      if (existingBody && existingBody.closest(".panel")) {
        disciplinePanel = existingBody.closest(".panel");
        disciplinePanel.classList.add("student-attendance-panel");
        disciplineBody = existingBody;
        disciplineBody.id = "tabela-frequencia-corpo"; // Compatibilidade com aluno.js já presente.
        const heading = disciplinePanel.querySelector(".panel-header h2, h2");
        if (heading) heading.textContent = "Resumo por disciplina";
        if (!disciplinePanel.querySelector(".student-attendance-description")) {
          const description = el(
            "p",
            "student-attendance-description",
            "Atrasos contam como presença no percentual. Faltas justificadas são exibidas separadamente e permanecem no total de registros.",
          );
          const header = disciplinePanel.querySelector(".panel-header");
          (header || disciplinePanel).insertAdjacentElement(
            "afterend",
            description,
          );
        }
        const table = disciplineBody.closest("table");
        if (table) {
          table.classList.add("student-attendance-table");
          const wrapper = table.closest(".table-wrapper");
          if (wrapper)
            wrapper.classList.add("student-attendance-table-wrapper");
          const headRow = table.querySelector("thead tr");
          if (headRow) {
            headRow.replaceChildren();
            [
              "Disciplina",
              "Turma",
              "Aulas",
              "Presenças",
              "Atrasos",
              "Faltas",
              "Justificadas",
              "Frequência",
              "Situação",
            ].forEach((label) => {
              const th = el("th", "", label);
              th.scope = "col";
              headRow.append(th);
            });
          }
        }
        root.append(disciplinePanel);
      } else {
        const disciplineTable = makeTable(
          [
            "Disciplina",
            "Turma",
            "Aulas",
            "Presenças",
            "Atrasos",
            "Faltas",
            "Justificadas",
            "Frequência",
            "Situação",
          ],
          "Frequência por disciplina",
        );
        disciplineTable.tbody.id = "tabela-frequencia-disciplinas-corpo";
        disciplineBody = disciplineTable.tbody;
        disciplinePanel = makePanel(
          "Resumo por disciplina",
          "Atrasos contam como presença no percentual; faltas justificadas são apresentadas separadamente.",
        );
        disciplinePanel.append(disciplineTable.wrapper);
        root.append(disciplinePanel);
      }

      const historyPanel = makePanel(
        "Histórico de frequência",
        "Registros individuais das chamadas já fechadas pelos professores.",
      );
      const historyTable = makeTable(
        ["Data", "Período", "Disciplina", "Tema da aula", "Situação"],
        "Histórico de frequência",
      );
      historyTable.tbody.id = "tabela-historico-frequencia-corpo";
      historyPanel.append(historyTable.wrapper);

      const observationsPanel = makePanel(
        "Observações pedagógicas",
        "Observações que a equipe pedagógica marcou como visíveis para você.",
      );
      const observationsTable = makeTable(
        ["Data", "Categoria", "Observação"],
        "Observações pedagógicas visíveis ao aluno",
      );
      observationsTable.tbody.id = "tabela-observacoes-visiveis-corpo";
      observationsPanel.append(observationsTable.wrapper);

      root.append(charts, historyPanel, observationsPanel);
      return {
        root,
        kpis,
        chartDisciplinaCanvas,
        chartDisciplinaState,
        chartEvolucaoCanvas,
        chartEvolucaoState,
        disciplinasBody: disciplineBody,
        historicoBody: historyTable.tbody,
        observacoesBody: observationsTable.tbody,
      };
    }

    const ui = buildUi();
    section.replaceChildren(mensagem, ui.root);

    function showEmptyRow(body, colSpan, text) {
      const row = el("tr");
      const cell = el("td", "student-attendance-empty", text);
      cell.colSpan = colSpan;
      row.append(cell);
      body.replaceChildren(row);
    }

    function renderKpis(resumo) {
      const percentage = resumo.frequencia_percentual;
      const total = Number(resumo.aulas_registradas || 0);
      const presence =
        Number(resumo.presencas || 0) + Number(resumo.atrasos || 0);
      ui.kpis.replaceChildren(
        makeKpi(
          "Frequência geral",
          formatPercent(percentage),
          statusLabel(resumo.situacao),
        ),
        makeKpi(
          "Aulas registradas",
          total,
          "Chamadas fechadas consideradas no cálculo",
        ),
        makeKpi(
          "Presenças e atrasos",
          presence,
          `${Number(resumo.presencas || 0)} presença(s) · ${Number(resumo.atrasos || 0)} atraso(s)`,
        ),
        makeKpi("Faltas", Number(resumo.faltas || 0), "Registros de ausência"),
        makeKpi(
          "Faltas justificadas",
          Number(resumo.justificadas || 0),
          "Exibidas separadamente no histórico",
        ),
      );
    }

    function renderDisciplinas(items) {
      const body = ui.disciplinasBody;
      body.replaceChildren();
      if (!items.length) {
        showEmptyRow(
          body,
          9,
          "Ainda não há registros de frequência fechados para suas disciplinas.",
        );
        return;
      }
      items.forEach((item) => {
        const row = el("tr");
        appendCell(row, item.disciplina);
        appendCell(row, item.turma);
        appendCell(row, item.total_aulas);
        appendCell(row, item.presencas);
        appendCell(row, item.atrasos);
        appendCell(row, item.faltas);
        appendCell(row, item.justificadas);
        appendCell(row, formatPercent(item.frequencia_percentual));
        appendCell(row, statusBadge(item.situacao));
        body.append(row);
      });
    }

    function renderHistorico(items) {
      const body = ui.historicoBody;
      body.replaceChildren();
      if (!items.length) {
        showEmptyRow(
          body,
          5,
          "Seu histórico aparecerá aqui quando houver chamadas fechadas.",
        );
        return;
      }
      items.forEach((item) => {
        const row = el("tr");
        appendCell(row, formatDate(item.data_aula));
        appendCell(row, item.periodo);
        appendCell(row, item.disciplina);
        appendCell(row, item.tema || "Sem tema informado");
        appendCell(row, statusBadge(item.status));
        body.append(row);
      });
    }

    function renderObservacoes(items) {
      const body = ui.observacoesBody;
      if (!body) return;
      body.replaceChildren();
      if (!items.length) {
        showEmptyRow(
          body,
          3,
          "Não há observações pedagógicas marcadas como visíveis para você.",
        );
        return;
      }
      const categorias = {
        dificuldade_conteudo: "Dificuldade no conteúdo",
        participacao: "Participação",
        engajamento: "Engajamento",
        comportamento: "Comportamento",
        outro: "Outro",
      };
      items.forEach((item) => {
        const row = el("tr");
        appendCell(row, formatDate(item.data_registro));
        appendCell(
          row,
          categorias[item.categoria] || item.categoria || "Outro",
        );
        appendCell(row, item.descricao || "");
        body.append(row);
      });
    }

    function renderChart(
      canvas,
      state,
      rows,
      labelKey,
      labelText,
      chartType,
      currentChart,
    ) {
      if (currentChart) currentChart.destroy();
      const panel = canvas.parentElement;
      panel
        ?.querySelectorAll(".student-attendance-svg-chart")
        .forEach((chart) => chart.remove());
      const validRows = rows.filter(
        (item) =>
          item.frequencia_percentual !== null &&
          item.frequencia_percentual !== undefined &&
          Number.isFinite(Number(item.frequencia_percentual)),
      );
      if (!validRows.length) {
        canvas.hidden = true;
        state.hidden = false;
        state.textContent =
          "Ainda não há dados suficientes para gerar este gráfico.";
        return null;
      }

      const color =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          .trim() || "#2f80ed";
      if (!window.Chart) {
        // Fallback SVG: os gráficos continuam visíveis mesmo se a página não
        // carregar uma biblioteca externa. Os mesmos dados seguem disponíveis
        // também nas tabelas acessíveis.
        canvas.hidden = true;
        state.hidden = true;
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.classList.add("student-attendance-svg-chart");
        svg.setAttribute("viewBox", "0 0 720 310");
        svg.setAttribute("role", "img");
        svg.setAttribute(
          "aria-label",
          `${labelText} por ${labelKey === "nome" ? "período letivo" : "disciplina"}`,
        );
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        const createSvgNode = (tag, attrs, text) => {
          const node = document.createElementNS(ns, tag);
          Object.entries(attrs || {}).forEach(([key, value]) =>
            node.setAttribute(key, String(value)),
          );
          if (text !== undefined) node.textContent = String(text);
          return node;
        };
        const left = 48,
          right = 18,
          top = 18,
          bottom = 62;
        const plotWidth = 720 - left - right,
          plotHeight = 310 - top - bottom;
        [0, 25, 50, 75, 100].forEach((tick) => {
          const y = top + plotHeight - (tick / 100) * plotHeight;
          svg.append(
            createSvgNode("line", {
              x1: left,
              y1: y,
              x2: left + plotWidth,
              y2: y,
              stroke: "currentColor",
              "stroke-opacity": "0.16",
              "stroke-width": 1,
            }),
          );
          svg.append(
            createSvgNode(
              "text",
              {
                x: left - 9,
                y: y + 4,
                "text-anchor": "end",
                fill: "currentColor",
                "font-size": 11,
              },
              `${tick}%`,
            ),
          );
        });
        const step = plotWidth / validRows.length;
        const points = [];
        validRows.forEach((item, index) => {
          const value = Math.max(
            0,
            Math.min(100, Number(item.frequencia_percentual)),
          );
          const x = left + step * (index + 0.5);
          const y = top + plotHeight - (value / 100) * plotHeight;
          const rawLabel = String(item[labelKey] || "");
          const shortLabel =
            rawLabel.length > 13 ? `${rawLabel.slice(0, 12)}…` : rawLabel;
          if (chartType === "bar") {
            const barWidth = Math.max(5, Math.min(54, step * 0.58));
            svg.append(
              createSvgNode("rect", {
                x: x - barWidth / 2,
                y,
                width: barWidth,
                height: Math.max(0, top + plotHeight - y),
                rx: 5,
                fill: color,
                "fill-opacity": 0.78,
              }),
            );
            svg.append(
              createSvgNode(
                "text",
                {
                  x,
                  y: Math.max(top + 11, y - 7),
                  "text-anchor": "middle",
                  fill: "currentColor",
                  "font-size": 11,
                },
                `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
              ),
            );
          } else {
            points.push(`${x},${y}`);
          }
          svg.append(
            createSvgNode(
              "text",
              {
                x,
                y: top + plotHeight + 22,
                "text-anchor": "middle",
                fill: "currentColor",
                "font-size": 11,
              },
              shortLabel,
            ),
          );
        });
        if (chartType === "line") {
          if (points.length > 1)
            svg.append(
              createSvgNode("polyline", {
                points: points.join(" "),
                fill: "none",
                stroke: color,
                "stroke-width": 3,
                "stroke-linejoin": "round",
                "stroke-linecap": "round",
              }),
            );
          points.forEach((point, index) => {
            const [x, y] = point.split(",").map(Number);
            const value = Number(validRows[index].frequencia_percentual);
            svg.append(
              createSvgNode("circle", {
                cx: x,
                cy: y,
                r: 5,
                fill: color,
                stroke: "white",
                "stroke-width": 2,
              }),
            );
            svg.append(
              createSvgNode(
                "text",
                {
                  x,
                  y: Math.max(top + 11, y - 10),
                  "text-anchor": "middle",
                  fill: "currentColor",
                  "font-size": 11,
                },
                `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
              ),
            );
          });
        }
        canvas.insertAdjacentElement("beforebegin", svg);
        return null;
      }

      canvas.hidden = false;
      state.hidden = true;
      return new window.Chart(canvas.getContext("2d"), {
        type: chartType,
        data: {
          labels: validRows.map((item) => item[labelKey]),
          datasets: [
            {
              label: labelText,
              data: validRows.map((item) => Number(item.frequencia_percentual)),
              borderColor: color,
              backgroundColor:
                chartType === "line" ? `${color}33` : `${color}b8`,
              borderWidth: 2,
              borderRadius: chartType === "bar" ? 5 : 0,
              tension: 0.25,
              fill: chartType === "line",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { callback: (value) => `${value}%` },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) =>
                  `${context.dataset.label}: ${formatPercent(context.parsed.y)}`,
              },
            },
          },
        },
      });
    }

    function render(data) {
      const resumo = data.resumo || {};
      renderKpis(resumo);
      renderDisciplinas(
        Array.isArray(data.disciplinas) ? data.disciplinas : [],
      );
      renderHistorico(Array.isArray(data.historico) ? data.historico : []);
      renderObservacoes(
        Array.isArray(data.observacoes) ? data.observacoes : [],
      );
      chartDisciplina = renderChart(
        ui.chartDisciplinaCanvas,
        ui.chartDisciplinaState,
        Array.isArray(data.disciplinas) ? data.disciplinas : [],
        "disciplina",
        "Frequência (%)",
        "bar",
        chartDisciplina,
      );
      chartEvolucao = renderChart(
        ui.chartEvolucaoCanvas,
        ui.chartEvolucaoState,
        Array.isArray(data.evolucao) ? data.evolucao : [],
        "nome",
        "Frequência (%)",
        "line",
        chartEvolucao,
      );
      mensagem.hidden = true;
    }

    async function carregar() {
      try {
        const endpoint = new URL(
          "api/academico/frequencia-aluno.php",
          document.baseURI,
        ).toString();
        const response = await fetch(endpoint, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        let data;
        try {
          data = await response.json();
        } catch {
          throw new Error(
            "O servidor retornou uma resposta inválida ao consultar a frequência.",
          );
        }
        if (!response.ok || data.sucesso === false) {
          throw new Error(
            data.mensagem || "Não foi possível carregar sua frequência.",
          );
        }
        render(data);
      } catch (error) {
        mensagem.hidden = false;
        mensagem.textContent =
          error instanceof Error
            ? error.message
            : "Não foi possível carregar sua frequência.";
        mensagem.dataset.type = "error";
      }
    }

    carregar();
  });
})();
