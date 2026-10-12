// =====================================================================
// EduWatch — autenticação da interface
// A sessão autoritativa fica no servidor PHP (cookie HttpOnly). Este
// arquivo consulta api/auth/me.php e serve apenas para montar a interface.
// Os endpoints que acessam dados também devem validar a sessão no servidor.
// =====================================================================

async function obterUsuarioLogado() {
  try {
    const resposta = await fetch("api/auth/me.php", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!resposta.ok) return null;
    const resultado = await resposta.json();
    return resultado.autenticado === true ? resultado.usuario : null;
  } catch (erro) {
    console.error("EduWatch: não foi possível validar a sessão no servidor.", erro);
    return null;
  }
}

async function exigirPerfil(perfilEsperado) {
  const usuario = await obterUsuarioLogado();

  if (!usuario) {
    window.location.replace("index.html");
    return null;
  }

  if (usuario.nivel === perfilEsperado) {
    return usuario;
  }

  const parametros = new URLSearchParams(window.location.search);
  const modo = parametros.get("modo");
  const modoVisualizacao = modo === "visualizacao";

  // A administração possui um caminho explícito para gerenciar usuários pela
  // tela de cadastros da coordenação. O endpoint PHP valida o papel real no
  // banco; este modo só libera a interface correspondente.
  if (usuario.nivel === "admin" && perfilEsperado === "coordenacao" && modo === "gestao") {
    return { ...usuario, modoGestaoUsuariosAdmin: true };
  }

  if (usuario.nivel === "admin" && modoVisualizacao && ["aluno", "professor", "coordenacao"].includes(perfilEsperado)) {
    return { ...usuario, modoVisualizacaoAdmin: true };
  }

  // Se um usuário tentar abrir o ambiente de outro perfil, encaminha-o para
  // sua área. Esta verificação melhora o fluxo da interface; dados sensíveis
  // continuam dependendo das políticas RLS e das validações do servidor.
  const destinos = {
    aluno: "aluno.html",
    professor: "professor.html",
    coordenacao: "coordenacao.html",
    admin: "admin.html",
  };
  window.location.replace(destinos[usuario.nivel] || "index.html");
  return null;
}

function obterUsuarioVisualizacao(usuario, perfil) {
  if (!usuario || !usuario.modoVisualizacaoAdmin) return usuario;

  const rotulos = {
    aluno: "Visualização: Aluno",
    professor: "Visualização: Professor",
    coordenacao: "Visualização: Coordenação",
  };

  return { ...usuario, nome: rotulos[perfil] || "Visualização" };
}

async function encerrarSessao() {
  try {
    await fetch("api/auth/logout.php", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  } catch (erro) {
    console.error("EduWatch: não foi possível confirmar o encerramento no servidor.", erro);
  } finally {
    window.location.replace("index.html");
  }
}

function preencherUsuarioNaSidebar(usuario, rotuloPerfil) {
  const nomeEl = document.getElementById("sidebar-user-name");
  const perfilEl = document.getElementById("sidebar-user-role");
  const avatarEl = document.getElementById("sidebar-user-avatar");

  if (nomeEl) nomeEl.textContent = usuario.nome;
  if (perfilEl) perfilEl.textContent = usuario.nivel === "admin" ? "Administrador" : rotuloPerfil;
  if (avatarEl) avatarEl.textContent = (usuario.nome || "U").charAt(0).toUpperCase();
}

document.addEventListener("DOMContentLoaded", function () {
  const botaoSair = document.getElementById("btn-logout");
  if (botaoSair) botaoSair.addEventListener("click", encerrarSessao);
});
