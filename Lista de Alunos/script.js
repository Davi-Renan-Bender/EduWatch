const alunos = [
  {
    id: 1,
    nome: "João Silva",
    turma: "2º Informática A",
    media: 8.2,
    frequencia: 94,
    situacao: "Normal",
  },
  {
    id: 2,
    nome: "Pedro Santos",
    turma: "2º Informática A",
    media: 5.4,
    frequencia: 81,
    situacao: "Atenção",
  },
  {
    id: 3,
    nome: "Ana Costa",
    turma: "2º Informática B",
    media: 9.1,
    frequencia: 97,
    situacao: "Normal",
  },
  {
    id: 4,
    nome: "Marcos Ferreira",
    turma: "2º Informática B",
    media: 4.8,
    frequencia: 72,
    situacao: "Crítico",
  },
];

const lista = document.querySelector("#lista-alunos");

alunos.forEach(function (aluno) {
  const linha = document.createElement("tr");

  linha.innerHTML = `
        <td>${aluno.nome}</td>
        <td>${aluno.turma}</td>
        <td>${aluno.media}</td>
        <td>${aluno.frequencia}%</td>
        <td>${aluno.situacao}</td>
        <td>
            <button>Ver perfil</button>
        </td>
    `;

  lista.appendChild(linha);
});
