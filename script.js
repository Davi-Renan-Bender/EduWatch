// ========================================
// USUÁRIOS TEMPORÁRIOS DO EDUWATCH
// ========================================

const usuarios = [
  {
    nome: "Davi",
    cpf: "11111111111",
    senha: "1234",
    nivel: "aluno",
    pagina: "aluno.html",
  },

  {
    nome: "Carlos",
    cpf: "22222222222",
    senha: "1234",
    nivel: "professor",
    pagina: "professor.html",
  },

  {
    nome: "Mariana",
    cpf: "33333333333",
    senha: "1234",
    nivel: "coordenacao",
    pagina: "coordenacao.html",
  },

  {
    nome: "Administrador",
    cpf: "44444444444",
    senha: "1234",
    nivel: "admin",
    pagina: "admin.html",
  },
];

// ========================================
// MOSTRAR / OCULTAR SENHA
// ========================================

const campoSenha = document.getElementById("senha");
const botaoMostrarSenha = document.getElementById("mostrar-senha");

botaoMostrarSenha.addEventListener("click", function () {
  if (campoSenha.type === "password") {
    // Mostra a senha
    campoSenha.type = "text";

    botaoMostrarSenha.setAttribute("aria-label", "Ocultar senha");
    botaoMostrarSenha.setAttribute("title", "Ocultar senha");

    // Olho com risco
    botaoMostrarSenha.innerHTML = `
            <svg
                class="icone-olho"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
                <line x1="3" y1="3" x2="21" y2="21"></line>
            </svg>
        `;
  } else {
    // Oculta a senha
    campoSenha.type = "password";

    botaoMostrarSenha.setAttribute("aria-label", "Mostrar senha");
    botaoMostrarSenha.setAttribute("title", "Mostrar senha");

    // Olho normal
    botaoMostrarSenha.innerHTML = `
            <svg
                class="icone-olho"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
  }
});

// ========================================
// MÁSCARA DO CPF
// ========================================

const campoCPF = document.getElementById("cpf");

campoCPF.addEventListener("input", function () {
  // Remove tudo que não for número
  let cpf = this.value.replace(/\D/g, "");

  // Limita o CPF a 11 números
  cpf = cpf.substring(0, 11);

  // 123.456.789-01
  if (cpf.length > 9) {
    cpf = cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, "$1.$2.$3-$4");

    // 123.456.789
  } else if (cpf.length > 6) {
    cpf = cpf.replace(/^(\d{3})(\d{3})(\d{1,3})$/, "$1.$2.$3");

    // 123.456
  } else if (cpf.length > 3) {
    cpf = cpf.replace(/^(\d{3})(\d{1,3})$/, "$1.$2");
  }

  // Coloca o CPF formatado de volta no campo
  this.value = cpf;
});

// ========================================
// LOGIN
// ========================================

const formulario = document.getElementById("form-login");

formulario.addEventListener("submit", function (event) {
  // Impede o navegador de recarregar a página
  event.preventDefault();

  const cpfDigitado = document.getElementById("cpf").value;
  const senhaDigitada = document.getElementById("senha").value;

  // Remove pontos e hífen antes de comparar
  const cpfLimpo = cpfDigitado.replace(/\D/g, "");

  // Procura o usuário
  const usuarioEncontrado = usuarios.find(function (usuario) {
    return usuario.cpf === cpfLimpo && usuario.senha === senhaDigitada;
  });

  // ========================================
  // USUÁRIO ENCONTRADO
  // ========================================

  if (usuarioEncontrado) {
    // Guarda os dados do usuário temporariamente
    sessionStorage.setItem(
      "usuarioLogado",
      JSON.stringify({
        nome: usuarioEncontrado.nome,
        cpf: usuarioEncontrado.cpf,
        nivel: usuarioEncontrado.nivel,
      }),
    );

    // Redireciona para a página correspondente
    window.location.href = usuarioEncontrado.pagina;
  } else {
    alert("CPF ou senha incorretos.");
  }
});
