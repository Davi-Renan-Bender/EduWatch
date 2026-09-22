// ==========================================================================
// EduWatch — admin.js
//
// A área administrativa funciona como uma tela de seleção de ambientes.
//
// O administrador pode acessar:
// - aluno.html
// - professor.html
// - coordenacao.html
//
// A autorização real continuará sendo responsabilidade do backend quando
// a API existir. Aqui fazemos apenas a proteção da interface no navegador.
// ==========================================================================

document.addEventListener("DOMContentLoaded", function () {
  // ------------------------------------------------------------------------
  // Verificação do perfil
  // ------------------------------------------------------------------------

  const usuario = exigirPerfil("admin");

  if (!usuario) {
    return;
  }

  // ------------------------------------------------------------------------
  // Identificação do administrador na sidebar
  // ------------------------------------------------------------------------

  preencherUsuarioNaSidebar(usuario, "Administrador");

  // ------------------------------------------------------------------------
  // Menu mobile
  // ------------------------------------------------------------------------

  inicializarMenuMobile();
});
