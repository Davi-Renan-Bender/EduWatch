const formulario = document.querySelector("form");

const cpf = document.getElementById("cpf");
const senha = document.getElementById("senha");


// Deixa o CPF somente com números
cpf.addEventListener("input", function() {

    cpf.value = cpf.value.replace(/\D/g, "");

    if (cpf.value.length > 11) {
        cpf.value = cpf.value.slice(0, 11);
    }

});


// Verificação do login
formulario.addEventListener("submit", function(event) {

    event.preventDefault();

    if (cpf.value === "") {
        alert("Digite seu CPF para continuar.");
        cpf.focus();
        return;
    }

    if (cpf.value.length !== 11) {
        alert("O CPF deve ter 11 números.");
        cpf.focus();
        return;
    }

    if (senha.value === "") {
        alert("Digite sua senha para entrar.");
        senha.focus();
        return;
    }

    if (senha.value.length < 6) {
        alert("A senha deve ter pelo menos 6 caracteres.");
        senha.focus();
        return;
    }

    alert("Login realizado com sucesso!");

});