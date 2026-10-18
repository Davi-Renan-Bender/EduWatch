<?php
declare(strict_types=1);

require_once __DIR__ . '/../academico/comum.php';

eduwatch_exigir_metodo('GET');
ew_acad_require_role(['coordenacao', 'administrador']);

try {
    $turmas = ew_acad_rows(
        '/rest/v1/turmas?select=id,nome,status&status=eq.ativa&order=nome.asc',
        'as turmas disponíveis para atribuição de professores'
    );
    $disciplinas = ew_acad_rows(
        '/rest/v1/disciplinas?select=id,nome,ativo&ativo=eq.true&order=nome.asc',
        'as disciplinas disponíveis para atribuição de professores'
    );

    ew_acad_json(200, [
        'sucesso' => true,
        'turmas' => array_map(static fn($row) => [
            'id' => (int) $row['id'],
            'nome' => (string) $row['nome'],
        ], $turmas),
        'disciplinas' => array_map(static fn($row) => [
            'id' => (int) $row['id'],
            'nome' => (string) $row['nome'],
        ], $disciplinas),
    ]);
} catch (Throwable $error) {
    error_log('EduWatch teacher assignment options error: ' . $error->getMessage());
    ew_acad_json(500, [
        'sucesso' => false,
        'mensagem' => $error instanceof RuntimeException
            ? $error->getMessage()
            : 'Não foi possível carregar turmas e disciplinas para o professor.',
    ]);
}
