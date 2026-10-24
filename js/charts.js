/* EduWatch — base reutilizável para gráficos Chart.js.
 * Os gráficos recebem somente valores já autorizados pelos endpoints PHP.
 */
window.EduWatchCharts = (() => {
  const charts = new Map();
  const palette = {
    primary: "#3b82f6",
    primarySoft: "rgba(59, 130, 246, 0.18)",
    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",
    grid: "rgba(148, 163, 184, 0.28)",
    text: "#475569",
  };

  function destroy(canvasId) {
    const existing = charts.get(canvasId);
    if (existing) {
      existing.destroy();
      charts.delete(canvasId);
    }
  }

  function showMessage(canvasId, message) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    const wrapper = canvas?.closest(".chart-canvas-wrap");
    if (!canvas || !wrapper) return;
    canvas.hidden = true;
    let state = wrapper.querySelector(".chart-state");
    if (!state) {
      state = document.createElement("p");
      state.className = "chart-state";
      state.setAttribute("role", "status");
      wrapper.append(state);
    }
    state.textContent = message;
    state.hidden = false;
  }

  function create(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof window.Chart !== "function") {
      showMessage(
        canvasId,
        "Não foi possível carregar o componente de gráfico.",
      );
      return null;
    }
    const wrapper = canvas.closest(".chart-canvas-wrap");
    const state = wrapper?.querySelector(".chart-state");
    if (state) state.hidden = true;
    canvas.hidden = false;
    destroy(canvasId);
    const chart = new window.Chart(canvas, config);
    charts.set(canvasId, chart);
    return chart;
  }

  function baseOptions(max = 10) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 220 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          padding: 10,
          displayColors: false,
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: palette.text } },
        y: {
          beginAtZero: true,
          suggestedMax: max,
          grid: { color: palette.grid },
          ticks: { color: palette.text, precision: 1 },
        },
      },
    };
  }

  function renderLine(canvasId, points, label) {
    if (!Array.isArray(points) || points.length === 0) {
      showMessage(
        canvasId,
        "Ainda não há notas publicadas suficientes para mostrar a evolução.",
      );
      return null;
    }
    return create(canvasId, {
      type: "line",
      data: {
        labels: points.map((point) => point.rotulo),
        datasets: [
          {
            label,
            data: points.map((point) => point.media),
            borderColor: palette.primary,
            backgroundColor: palette.primarySoft,
            borderWidth: 3,
            pointBackgroundColor: palette.primary,
            pointRadius: 4,
            tension: 0.28,
            fill: true,
          },
        ],
      },
      options: baseOptions(10),
    });
  }

  function renderBar(
    canvasId,
    entries,
    label,
    emptyMessage = "Ainda não há dados publicados para exibir neste gráfico.",
  ) {
    const validEntries = Array.isArray(entries)
      ? entries.filter(
          (entry) =>
            entry &&
            entry.media !== null &&
            entry.media !== "" &&
            Number.isFinite(Number(entry.media)),
        )
      : [];
    if (!validEntries.length) {
      showMessage(canvasId, emptyMessage);
      return null;
    }
    return create(canvasId, {
      type: "bar",
      data: {
        labels: validEntries.map((entry) => entry.nome),
        datasets: [
          {
            label,
            data: validEntries.map((entry) => entry.media),
            backgroundColor: validEntries.map(
              (entry) =>
                ({
                  normal: palette.success,
                  atencao: palette.warning,
                  critico: palette.danger,
                })[entry.situacao] || palette.primary,
            ),
            borderRadius: 6,
            maxBarThickness: 48,
          },
        ],
      },
      options: baseOptions(10),
    });
  }

  return { destroy, renderLine, renderBar, showMessage };
})();
