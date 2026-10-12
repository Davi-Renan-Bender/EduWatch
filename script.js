// =====================================================================
// EduWatch — tela de login
// A autenticação é processada pelo PHP; nenhuma chave do Supabase fica
// disponível neste JavaScript.
// =====================================================================

const campoSenha = document.getElementById("senha");
const botaoMostrarSenha = document.getElementById("mostrar-senha");
const campoEmail = document.getElementById("email");
const formularioLogin = document.getElementById("form-login");
const mensagemLogin = document.getElementById("mensagem-login");
const botaoEntrar = formularioLogin.querySelector('button[type="submit"]');

// Mostrar / ocultar senha.
botaoMostrarSenha.addEventListener("click", function () {
  const mostrar = campoSenha.type === "password";
  campoSenha.type = mostrar ? "text" : "password";
  botaoMostrarSenha.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
  botaoMostrarSenha.setAttribute("title", mostrar ? "Ocultar senha" : "Mostrar senha");

  botaoMostrarSenha.innerHTML = mostrar
    ? `<svg class="icone-olho" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle><line x1="3" y1="3" x2="21" y2="21"></line></svg>`
    : `<svg class="icone-olho" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
});

function exibirMensagemLogin(mensagem, erro = true) {
  mensagemLogin.textContent = mensagem;
  mensagemLogin.hidden = !mensagem;
  mensagemLogin.classList.toggle("mensagem-login--erro", erro);
  mensagemLogin.classList.toggle("mensagem-login--info", !erro);
}

// Envio seguro para o backend PHP, que autentica o e-mail no Supabase.
formularioLogin.addEventListener("submit", async function (evento) {
  evento.preventDefault();
  exibirMensagemLogin("");

  const email = campoEmail.value.trim().toLowerCase();
  const senha = campoSenha.value;

  if (!email || !campoEmail.validity.valid || senha.length === 0) {
    exibirMensagemLogin("Informe um e-mail válido e sua senha.");
    return;
  }

  botaoEntrar.disabled = true;
  const textoOriginal = botaoEntrar.textContent;
  botaoEntrar.textContent = "Entrando...";

  try {
    const resposta = await fetch("api/auth/login.php", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, senha }),
    });

    let resultado;
    try {
      resultado = await resposta.json();
    } catch {
      throw new Error("O servidor retornou uma resposta inesperada. Confira se abriu o EduWatch pelo Apache do XAMPP.");
    }

    if (!resposta.ok || resultado.sucesso !== true || !resultado.redirecionar) {
      throw new Error(resultado.mensagem || "Não foi possível entrar. Confira suas credenciais.");
    }

    window.location.assign(resultado.redirecionar);
  } catch (erro) {
    exibirMensagemLogin(erro instanceof Error ? erro.message : "Não foi possível realizar o login.");
  } finally {
    botaoEntrar.disabled = false;
    botaoEntrar.textContent = textoOriginal;
  }
});

// A recuperação por e-mail não está disponível, pois o projeto usa e-mails fictícios.
const linkEsqueciSenha = document.getElementById("esqueci_senha");
linkEsqueciSenha.addEventListener("click", function (evento) {
  evento.preventDefault();
  exibirMensagemLogin("A recuperação de senha ainda não está disponível no protótipo.", false);
});
