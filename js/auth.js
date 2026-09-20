// ==========================================================================
// EduWatch — auth.js
//
// Funções compartilhadas de sessão, usadas pelas páginas internas
// (aluno.html, professor.html, coordenacao.html).
//
// IMPORTANTE: este arquivo NÃO reimplementa o login. Ele apenas lê o que
// script.js já gravou em sessionStorage após o formulário de login.
//
// AVISO DE SEGURANÇA: a verificação de perfil feita aqui é apenas uma
// conveniência de interface (evita que um aluno veja, por acidente, a tela
// de professor no mesmo navegador). Ela NÃO é um mecanismo de segurança.
// Quando existir backend/API, toda rota sensível deverá validar o token e a
// permissão do usuário no servidor — o front-end nunca deve ser a única
// barreira de autorização.
// ==========================================================================

const EDUWATCH_AUTH_KEY = "usuarioLogado";

/**
 * Lê o usuário logado gravado pelo script.js na tela de login.
 * @returns {{nome: string, cpf: string, nivel: string} | null}
 */
function obterUsuarioLogado() {
  const bruto = sessionStorage.getItem(EDUWATCH_AUTH_KEY);

  if (!bruto) {
    return null;
  }

  try {
    return JSON.parse(bruto);
  } catch (erro) {
    console.error("EduWatch: sessão inválida em sessionStorage.", erro);
    return null;
  }
}

/**
 * Garante que a página atual só seja exibida para o perfil esperado.
 * Caso não haja sessão, ou o perfil não corresponda, redireciona para o
 * login. Deve ser chamada no início do script de cada página interna.
 *
 * @param {string} perfilEsperado - "aluno" | "professor" | "coordenacao"
 * @returns {{nome: string, cpf: string, nivel: string} | null}
 */
function exigirPerfil(perfilEsperado) {
  const usuario = obterUsuarioLogado();

  if (!usuario) {
    window.location.href = "index.html";
    return null;
  }

  // Usuário normal: precisa possuir exatamente o perfil da página.
  if (usuario.nivel === perfilEsperado) {
    return usuario;
  }

  // Administrador só pode abrir outras áreas através
  // do modo de visualização iniciado pelo painel administrativo.
  const parametros = new URLSearchParams(window.location.search);
  const modoVisualizacao = parametros.get("modo") === "visualizacao";

  if (usuario.nivel === "admin" && modoVisualizacao) {
    return {
      ...usuario,
      modoVisualizacaoAdmin: true,
      perfilVisualizacao: perfilEsperado,
    };
  }

  window.location.href = "index.html";
  return null;
}
function obterUsuarioVisualizacao(usuario, perfil) {
  if (!usuario) {
    return null;
  }

  if (!usuario.modoVisualizacaoAdmin) {
    return usuario;
  }

  const dadosDemo = {
    aluno: {
      nome: "Aluno de demonstração",
      cpf: "00000000000",
    },
    professor: {
      nome: "Professor de demonstração",
      cpf: "00000000000",
    },
    coordenacao: {
      nome: "Coordenador de demonstração",
      cpf: "00000000000",
    },
  };

  return {
    ...usuario,
    ...dadosDemo[perfil],
  };
}
/**
 * Encerra a sessão local e volta para a tela de login.
 * Ponto único de logout: todas as páginas devem chamar esta função,
 * em vez de reimplementar a limpeza da sessão cada uma à sua maneira.
 */
function encerrarSessao() {
  sessionStorage.removeItem(EDUWATCH_AUTH_KEY);
  window.location.href = "index.html";
}

/**
 * Preenche o nome/perfil/avatar do usuário logado na sidebar.
 * @param {{nome: string}} usuario
 * @param {string} rotuloPerfil - rótulo de exibição, ex.: "Aluno"
 */
function preencherUsuarioNaSidebar(usuario, rotuloPerfil) {
  const nomeEl = document.getElementById("sidebar-user-name");
  const perfilEl = document.getElementById("sidebar-user-role");
  const avatarEl = document.getElementById("sidebar-user-avatar");

  if (nomeEl) {
    nomeEl.textContent = usuario.nome;
  }

  if (perfilEl) {
    perfilEl.textContent =
      usuario.nivel === "admin" ? "Administrador" : rotuloPerfil;
  }

  if (avatarEl) {
    avatarEl.textContent = usuario.nome.charAt(0).toUpperCase();
  }
}

// Liga o botão "Sair" (presente em todas as páginas internas) ao logout.
document.addEventListener("DOMContentLoaded", function () {
  const botaoSair = document.getElementById("btn-logout");

  if (botaoSair) {
    botaoSair.addEventListener("click", encerrarSessao);
  }
});
