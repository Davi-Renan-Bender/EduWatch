// ==========================================================================
// EduWatch — components.js
//
// Funções de UI reutilizadas por aluno.js, professor.js e coordenacao.js.
// Nenhuma regra de negócio deve ser adicionada aqui: este arquivo apenas
// transforma dados (que futuramente virão da API) em HTML.
// ==========================================================================

/** Ícones SVG usados em conteúdo gerado dinamicamente. */
const EDUWATCH_ICONS = {
  alerta:
    '<path d="M12 4 21 19H3Z"></path><path d="M12 10v4"></path><path d="M12 16.5h.01"></path>',
  info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path>',
  caixaVazia:
    '<path d="M4 8 12 4l8 4"></path><path d="M4 8v9l8 4 8-4V8"></path><path d="M4 8l8 4 8-4"></path>',
  carregando: '<path d="M12 3a9 9 0 1 0 9 9"></path>',
};

/**
 * Monta um <svg> a partir de uma chave de EDUWATCH_ICONS.
 * @param {keyof typeof EDUWATCH_ICONS} nome
 */
function iconeSvg(nome) {
  const caminho = EDUWATCH_ICONS[nome] || "";
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    caminho +
    "</svg>"
  );
}

/**
 * Normaliza um valor de situação vindo dos dados (mock ou, futuramente, API)
 * para um rótulo e uma classe CSS visual.
 * Situações esperadas da API: "normal" | "atencao" | "critico".
 * @param {string} situacao
 */
function situacaoMeta(situacao) {
  const chave = String(situacao || "").toLowerCase();

  const mapa = {
    normal: { rotulo: "Normal", classe: "status-badge--normal" },
    atencao: { rotulo: "Atenção", classe: "status-badge--atencao" },
    critico: { rotulo: "Crítico", classe: "status-badge--critico" },
  };

  return (
    mapa[chave] || { rotulo: "Sem dados", classe: "status-badge--indefinido" }
  );
}

/**
 * Gera o HTML do selo de situação (nunca depende só de cor: sempre inclui texto).
 * @param {string} situacao
 */
function selosituacaoHTML(situacao) {
  const meta = situacaoMeta(situacao);
  return (
    '<span class="status-badge ' +
    meta.classe +
    '"><span class="status-dot" aria-hidden="true"></span>' +
    meta.rotulo +
    "</span>"
  );
}

/** HTML do estado de carregamento, para injetar em qualquer container. */
function estadoCarregandoHTML(mensagem) {
  return (
    '<div class="state-block state-block--loading">' +
    iconeSvg("carregando") +
    "<span>" +
    (mensagem || "Carregando dados...") +
    "</span></div>"
  );
}

/** HTML do estado vazio ("Nenhum registro encontrado", etc.). */
function estadoVazioHTML(mensagem) {
  return (
    '<div class="state-block state-block--vazio">' +
    iconeSvg("caixaVazia") +
    "<span>" +
    (mensagem || "Nenhum dado encontrado.") +
    "</span></div>"
  );
}

/** HTML do estado de erro (ex.: falha ao consultar a API). */
function estadoErroHTML(mensagem) {
  return (
    '<div class="state-block state-block--error">' +
    iconeSvg("alerta") +
    "<span>" +
    (mensagem || "Não foi possível carregar os dados agora.") +
    "</span></div>"
  );
}

/**
 * Liga a navegação por seções da sidebar: clicar em um item com
 * data-section="x" mostra #section-x e esconde as demais, e atualiza o
 * título/subtítulo do topbar a partir de data-title/data-subtitle do link.
 */
function inicializarNavegacaoPorSecao() {
  const links = document.querySelectorAll(".sidebar-link[data-section]");
  const titulo = document.getElementById("page-title");
  const subtitulo = document.getElementById("page-subtitle");

  links.forEach(function (link) {
    link.addEventListener("click", function (evento) {
      evento.preventDefault();

      const alvo = link.getAttribute("data-section");

      links.forEach(function (l) {
        l.classList.toggle("is-active", l === link);
      });

      document.querySelectorAll(".dashboard-section").forEach(function (secao) {
        secao.hidden = secao.id !== "section-" + alvo;
      });

      if (titulo && link.dataset.title) {
        titulo.textContent = link.dataset.title;
      }

      if (subtitulo && link.dataset.subtitle) {
        subtitulo.textContent = link.dataset.subtitle;
      }

      fecharSidebarMobile();
    });
  });
}

/** Liga o menu hambúrguer do topbar ao comportamento de sidebar em telas pequenas. */
function inicializarMenuMobile() {
  const botao = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");

  if (!botao || !sidebar || !backdrop) {
    return;
  }

  botao.addEventListener("click", function () {
    const abrindo = !sidebar.classList.contains("is-open");
    sidebar.classList.toggle("is-open", abrindo);
    backdrop.hidden = !abrindo;
    botao.setAttribute("aria-expanded", String(abrindo));
  });

  backdrop.addEventListener("click", fecharSidebarMobile);
}

function fecharSidebarMobile() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const botao = document.getElementById("sidebar-toggle");

  if (sidebar) sidebar.classList.remove("is-open");
  if (backdrop) backdrop.hidden = true;
  if (botao) botao.setAttribute("aria-expanded", "false");
}

/** Liga o sino de notificações do topbar (abre/fecha o painel). */
function inicializarNotificacoes() {
  const botao = document.getElementById("btn-notifications");
  const painel = document.getElementById("notification-panel");

  if (!botao || !painel) {
    return;
  }

  botao.addEventListener("click", function (evento) {
    evento.stopPropagation();
    const abrindo = painel.hidden;
    painel.hidden = !abrindo;
    botao.setAttribute("aria-expanded", String(abrindo));
  });

  document.addEventListener("click", function (evento) {
    if (
      !painel.hidden &&
      !painel.contains(evento.target) &&
      evento.target !== botao
    ) {
      painel.hidden = true;
      botao.setAttribute("aria-expanded", "false");
    }
  });
}

/** Abre um modal (elemento .modal-backdrop) e move o foco para o botão de fechar. */
function abrirModal(idModal) {
  const modal = document.getElementById(idModal);
  if (!modal) return;
  modal.hidden = false;
  const botaoFechar = modal.querySelector("[data-modal-fechar]");
  if (botaoFechar) botaoFechar.focus();
}

/** Fecha um modal e devolve o foco ao elemento que abriu (quando informado). */
function fecharModal(idModal) {
  const modal = document.getElementById(idModal);
  if (!modal) return;
  modal.hidden = true;
}

// Fecha modais visíveis ao pressionar Esc.
document.addEventListener("keydown", function (evento) {
  if (evento.key === "Escape") {
    document
      .querySelectorAll(".modal-backdrop:not([hidden])")
      .forEach(function (modal) {
        modal.hidden = true;
      });
  }
});
