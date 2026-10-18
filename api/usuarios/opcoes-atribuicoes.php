<?php
declare(strict_types=1);
require_once __DIR__ . '/atribuicoes-comum.php';

$config = ew_multi_require_gestao('GET');

try {
    $tipoProfessor = ew_multi_rows(
        $config,
        '/rest/v1/tipos_usuario?select=id&codigo=eq.professor&limit=1',
        'o tipo de usuário professor'
    );
    if (empty($tipoProfessor[0]['id'])) {
        ew_multi_fail(500, ['sucesso' => false, 'mensagem' => 'O tipo de usuário professor não foi encontrado no banco.']);
    }
    $tipoProfessorId = (int) $tipoProfessor[0]['id'];

    $professores = ew_multi_rows(
        $config,
        '/rest/v1/usuarios?select=id,nome_completo,email,ativo&tipo_usuario_id=eq.' . $tipoProfessorId . '&ativo=eq.true&order=nome_completo.asc',
        'os professores ativos'
    );
    $turmas = ew_multi_rows(
        $config,
        '/rest/v1/turmas?select=id,nome,status&status=eq.ativa&order=nome.asc',
        'as turmas ativas'
    );
    $disciplinas = ew_multi_rows(
        $config,
        '/rest/v1/disciplinas?select=id,nome,ativo&ativo=eq.true&order=nome.asc',
        'as disciplinas ativas'
    );
    $atribuicoes = ew_multi_rows(
        $config,
        '/rest/v1/turma_disciplinas?select=id,turma_id,disciplina_id,professor_id&order=id.asc',
        'as atribuições atuais'
    );

    // Busca também os nomes de professores já vinculados, mesmo se uma conta ficou inativa.
    $todosProfessores = ew_multi_rows(
        $config,
        '/rest/v1/usuarios?select=id,nome_completo,email,ativo&tipo_usuario_id=eq.' . $tipoProfessorId . '&order=nome_completo.asc',
        'os nomes dos professores vinculados'
    );

    ew_multi_fail(200, [
        'sucesso' => true,
        'professores' => array_map(static fn($row) => [
            'id' => (string) $row['id'],
            'nome' => (string) ($row['nome_completo'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
        ], $professores),
        'turmas' => array_map(static fn($row) => [
            'id' => (int) $row['id'],
            'nome' => (string) $row['nome'],
        ], $turmas),
        'disciplinas' => array_map(static fn($row) => [
            'id' => (int) $row['id'],
            'nome' => (string) $row['nome'],
        ], $disciplinas),
        'atribuicoes' => array_map(static fn($row) => [
            'id' => (int) $row['id'],
            'turmaId' => (int) $row['turma_id'],
            'disciplinaId' => (int) $row['disciplina_id'],
            'professorId' => (string) $row['professor_id'],
        ], $atribuicoes),
        'todosProfessores' => array_map(static fn($row) => [
            'id' => (string) $row['id'],
            'nome' => (string) ($row['nome_completo'] ?? ''),
            'ativo' => (bool) ($row['ativo'] ?? false),
        ], $todosProfessores),
    ]);
} catch (Throwable $error) {
    error_log('EduWatch assignment options error: ' . $error->getMessage());
    ew_multi_fail(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar os dados para atribuição.']);
}
