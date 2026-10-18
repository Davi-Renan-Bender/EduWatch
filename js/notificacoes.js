/** Notificações reais do EduWatch, com dados obtidos pela API PHP autenticada. */
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const lista = document.getElementById("notification-list");
    const marcador = document.getElementById("notification-dot");
    const botao = document.getElementById("btn-notifications");
    const painel = document.getElementById("notification-panel");
    if (!lista || !marcador) return;

    let carregando = false;
    let dadosAtuais = [];
    let naoLidasAtual = 0;

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    };

    const formatDate = (value) => {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
    };

    const getEndpoint = () => new URL("api/academico/notificacoes.php", document.baseURI).toString();

    async function requisitar(url, options = {}) {
      let response;
      try {
        response = await fetch(url, {
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {}),
          },
          ...options,
        });
      } catch {
        throw new Error("Não foi possível conectar ao EduWatch para carregar as notificações.");
      }
      let data;
      try { data = await response.json(); }
      catch { throw new Error("O servidor retornou uma resposta inválida para as notificações."); }
      if (!response.ok || data.sucesso === false) {
        throw new Error(data.mensagem || "Não foi possível atualizar as notificações.");
      }
      return data;
    }

    function linkInterno(raw) {
      if (!raw || typeof raw !== "string") return null;
      try {
        const url = new URL(raw, document.baseURI);
        if (!(["http:", "https:"].includes(url.protocol) && url.origin === window.location.origin)) return null;
        return url;
      } catch {
        return null;
      }
    }

    function abrirSecaoPorHash(hash) {
      const mapa = {
        "#notas": "section-notas",
        "#frequencia": "section-frequencia",
        "#evolucao": "section-evolucao",
      };
      const id = mapa[hash];
      const target = id ? document.getElementById(id) : null;
      if (!target) return false;

      const candidatos = Array.from(document.querySelectorAll("a, button, [role='button']"));
      const nav = candidatos.find((item) => {
        const href = item.getAttribute("href");
        const dataTarget = item.getAttribute("data-target") || item.getAttribute("data-section-target");
        const dataSection = item.getAttribute("data-section");
        return href === hash || dataTarget === id || dataSection === id || dataSection === id.replace(/^section-/, "");
      });
      if (nav) {
        nav.click();
        return true;
      }
      document.querySelectorAll(".dashboard-section").forEach((section) => {
        const active = section === target;
        section.hidden = !active;
        section.classList.toggle("is-active", active);
      });
      return true;
    }

    function definirEstadoBadge() {
      marcador.hidden = naoLidasAtual < 1;
      if (botao) {
        botao.setAttribute("aria-label", naoLidasAtual > 0
          ? `Notificações, ${naoLidasAtual} não lida(s)`
          : "Notificações");
      }
      marcador.setAttribute("aria-hidden", naoLidasAtual < 1 ? "true" : "false");
      marcador.title = naoLidasAtual > 0 ? `${naoLidasAtual} notificação(ões) não lida(s)` : "";
    }

    function garantirBarraAcoes() {
      let toolbar = painel?.querySelector(".edu-notification-toolbar");
      if (!toolbar && painel) {
        toolbar = el("div", "edu-notification-toolbar");
        lista.insertAdjacentElement("beforebegin", toolbar);
      }
      return toolbar;
    }

    function render() {
      lista.replaceChildren();
      const toolbar = garantirBarraAcoes();
      if (toolbar) toolbar.replaceChildren();

      if (naoLidasAtual > 0 && toolbar) {
        const allButton = el("button", "edu-notification-mark-all", "Marcar todas como lidas");
        allButton.type = "button";
        allButton.addEventListener("click", async () => {
          allButton.disabled = true;
          try {
            await requisitar(getEndpoint(), {
              method: "POST",
              body: JSON.stringify({ acao: "marcar_todas" }),
            });
            await carregar();
          } catch (error) {
            mostrarErro(error.message);
          } finally {
            allButton.disabled = false;
          }
        });
        toolbar.append(allButton);
      }

      if (!dadosAtuais.length) {
        lista.append(el("p", "edu-notification-empty", "Você não tem notificações no momento."));
        return;
      }

      dadosAtuais.forEach((item) => {
        const unread = !item.lida_em;
        const card = el("article", `edu-notification${unread ? " edu-notification--unread" : ""}`);
        card.dataset.notificationId = String(item.id);
        const header = el("div", "edu-notification__header");
        header.append(el("h3", "edu-notification__title", item.titulo || "Notificação"));
        if (unread) header.append(el("span", "edu-notification__unread-label", "Nova"));
        card.append(header);
        card.append(el("p", "edu-notification__message", item.mensagem || ""));

        const dateText = formatDate(item.created_at);
        if (dateText) {
          const time = el("time", "edu-notification__date", dateText);
          if (item.created_at) time.dateTime = String(item.created_at);
          card.append(time);
        }

        const actions = el("div", "edu-notification__actions");
        const destination = linkInterno(item.link_destino);
        if (destination) {
          const link = el("a", "edu-notification__link", "Abrir");
          link.href = destination.href;
          link.addEventListener("click", async (event) => {
            event.preventDefault();
            if (unread) {
              try {
                await marcarLida(item.id);
              } catch (error) {
                mostrarErro(error.message);
              }
            }
            if (destination.pathname === window.location.pathname && destination.hash) {
              abrirSecaoPorHash(destination.hash);
              window.history.replaceState(null, "", destination.pathname + destination.search + destination.hash);
            } else {
              window.location.href = destination.href;
            }
          });
          actions.append(link);
        }
        if (unread) {
          const button = el("button", "edu-notification__mark", "Marcar como lida");
          button.type = "button";
          button.addEventListener("click", async () => {
            button.disabled = true;
            try { await marcarLida(item.id); }
            catch (error) { mostrarErro(error.message); }
            finally { button.disabled = false; }
          });
          actions.append(button);
        } else {
          actions.append(el("span", "edu-notification__read-label", "Lida"));
        }
        card.append(actions);
        lista.append(card);
      });
    }

    function mostrarErro(message) {
      lista.replaceChildren(el("p", "edu-notification-error", message));
    }

    async function carregar() {
      if (carregando) return;
      carregando = true;
      if (!dadosAtuais.length) lista.replaceChildren(el("p", "edu-notification-empty", "Carregando notificações…"));
      try {
        const data = await requisitar(getEndpoint());
        dadosAtuais = Array.isArray(data.notificacoes) ? data.notificacoes : [];
        naoLidasAtual = Number.isFinite(Number(data.nao_lidas)) ? Number(data.nao_lidas) : dadosAtuais.filter((item) => !item.lida_em).length;
        definirEstadoBadge();
        render();
      } catch (error) {
        definirEstadoBadge();
        mostrarErro(error.message);
      } finally {
        carregando = false;
      }
    }

    async function marcarLida(id) {
      await requisitar(getEndpoint(), {
        method: "POST",
        body: JSON.stringify({ acao: "marcar_lida", id: Number(id) }),
      });
      await carregar();
    }

    // Atualiza ao abrir o menu para trazer avisos recentes sem recarregar a página.
    if (botao) botao.addEventListener("click", () => { void carregar(); });

    // Abre a seção apontada por links como aluno.html#notas, quando possível.
    if (window.location.hash) window.setTimeout(() => abrirSecaoPorHash(window.location.hash), 0);
    carregar();
  });
})();
