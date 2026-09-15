const formulario = document.querySelector("form");

formulario.addEventListener("submit", function(event) {

    event.preventDefault();

    const cpf = document.getElementById("cpf").value;
    const senha = document.getElementById("senha").value;

    if (cpf === "" || senha === "") {
        alert("Preencha o CPF e a senha.");
    } else {
        alert("Login realizado com sucesso!");
    }

});