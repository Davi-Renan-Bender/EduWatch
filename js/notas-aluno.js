/* EduWatch — notas publicadas do estudante autenticado. */
document.addEventListener("DOMContentLoaded", async () => {
  const secao = document.getElementById("section-notas");
  if (!secao) return;

  const painel = document.createElement("div");
  painel.className = "panel section-block student-assessment-panel";
  painel.innerHTML = `
    <div class="panel-header">
      <div><h2>Minhas avaliações</h2><p>Notas publicadas pelos professores.</p></div>
    </div>
    <p class="academic-feedback" id="mensagem-notas-aluno" role="status">Carregando suas notas…</p>
    <div class="table-wrapper">
      <table class="data-table" aria-label="Notas das avaliações publicadas">
        <thead><tr><th>Disciplina</th><th>Período</th><th>Avaliação</th><th>Data</th><th>Nota</th><th>Situação</th><th>Feedback</th></tr></thead>
        <tbody id="tabela-minhas-avaliacoes"><tr><td colspan="7">Carregando…</td></tr></tbody>
      </table>
    </div>`;
  secao.append(painel);

  const tbody = painel.querySelector("#tabela-minhas-avaliacoes");
  const message = painel.querySelector("#mensagem-notas-aluno");
  const setMessage = (text, type = "info") => {
    message.textContent = text;
    message.dataset.type = type;
    message.hidden = !text;
  };
  const addCell = (row, text) => {
    const cell = document.createElement("td");
    cell.textContent = text == null || text === "" ? "—" : String(text);
    row.append(cell);
  };
  const datePt = (value) => {
    if (!value) return "—";
    const bits = value.split("-");
    return bits.length === 3 ? `${bits[2]}/${bits[1]}/${bits[0]}` : value;
  };
  const statusLabel = (status) => ({
    lancada: "Lançada", pendente: "Aguardando lançamento", ausente: "Ausente", dispensada: "Dispensada",
  }[status] || status || "—");

  try {
    const response = await fetch("api/academico/notas-aluno.php", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const data = await response.json();
    if (!response.ok || data.sucesso === false) throw new Error(data.mensagem || "Não foi possível carregar suas notas.");
    const notas = Array.isArray(data.notas) ? data.notas : [];
    tbody.replaceChildren();
    if (notas.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.textContent = "Nenhuma avaliação publicada para suas matrículas ativas.";
      row.append(cell);
      tbody.append(row);
      setMessage("Suas avaliações aparecerão aqui quando os professores publicarem as notas.");
      return;
    }
    notas.forEach((nota) => {
      const row = document.createElement("tr");
      addCell(row, nota.disciplina);
      addCell(row, nota.periodo);
      addCell(row, nota.avaliacao);
      addCell(row, datePt(nota.data_aplicacao));
      const score = nota.nota_obtida === null ? "—" : `${Number(nota.nota_obtida).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} / ${Number(nota.nota_maxima).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
      addCell(row, score);
      addCell(row, statusLabel(nota.situacao));
      addCell(row, nota.feedback);
      tbody.append(row);
    });
    setMessage(`${notas.length} registro(s) de avaliação carregado(s) do banco.`, "success");
  } catch (error) {
    tbody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "Não foi possível carregar as notas. Atualize a página ou tente novamente mais tarde.";
    row.append(cell);
    tbody.append(row);
    setMessage(error.message || "Erro ao carregar notas.", "error");
  }
});
