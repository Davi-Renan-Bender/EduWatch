<?php
declare(strict_types=1);

require_once __DIR__ . '/comum.php';

eduwatch_exigir_metodo('GET');
$usuario = ew_acad_require_role(['professor']);

$etapa = 'iniciar';
try {
    $etapa = 'consultar atribuições do professor';
    $atribuicoes = ew_acad_rows(
        '/rest/v1/turma_disciplinas?select=id,turma_id,disciplina_id,professor_id&professor_id=eq.' . rawurlencode($usuario['id']) . '&order=id.asc',
        'as turmas e disciplinas do professor'
    );

    $turmaIds = array_values(array_unique(array_map(static fn($r) => (int) $r['turma_id'], $atribuicoes)));
    $disciplinaIds = array_values(array_unique(array_map(static fn($r) => (int) $r['disciplina_id'], $atribuicoes)));

    $etapa = 'consultar turmas ativas';
    $turmas = $turmaIds
        ? ew_acad_rows('/rest/v1/turmas?select=id,nome,ano_letivo_id,status&id=' . ew_acad_in_filter($turmaIds) . '&status=eq.ativa&order=nome.asc', 'as turmas')
        : [];

    $etapa = 'consultar disciplinas ativas';
    $disciplinas = $disciplinaIds
        ? ew_acad_rows('/rest/v1/disciplinas?select=id,nome,ativo&id=' . ew_acad_in_filter($disciplinaIds) . '&ativo=eq.true&order=nome.asc', 'as disciplinas')
        : [];

    $etapa = 'consultar períodos letivos';
    $periodos = ew_acad_rows('/rest/v1/periodos_letivos?select=id,nome,ordem,ano_letivo_id,data_inicio,data_fim&order=ordem.asc', 'os períodos letivos');

    $turmaMap = [];
    foreach ($turmas as $r) {
        $turmaMap[(int) $r['id']] = $r;
    }
    $disciplinaMap = [];
    foreach ($disciplinas as $r) {
        $disciplinaMap[(int) $r['id']] = $r;
    }

    $opcoes = [];
    foreach ($atribuicoes as $r) {
        $turma = $turmaMap[(int) $r['turma_id']] ?? null;
        $disciplina = $disciplinaMap[(int) $r['disciplina_id']] ?? null;
        if (!$turma || !$disciplina) {
            continue;
        }
        $opcoes[] = [
            'turma_disciplina_id' => (int) $r['id'],
            'turma_id' => (int) $turma['id'],
            'turma' => (string) $turma['nome'],
            'ano_letivo_id' => (int) $turma['ano_letivo_id'],
            'disciplina_id' => (int) $disciplina['id'],
            'disciplina' => (string) $disciplina['nome'],
        ];
    }

    $periodosOut = array_map(static fn($p) => [
        'id' => (int) $p['id'],
        'nome' => (string) $p['nome'],
        'ordem' => (int) $p['ordem'],
        'ano_letivo_id' => (int) $p['ano_letivo_id'],
        'data_inicio' => (string) $p['data_inicio'],
        'data_fim' => (string) $p['data_fim'],
    ], $periodos);

    ew_acad_json(200, [
        'sucesso' => true,
        'atribuicoes' => $opcoes,
        'periodos' => $periodosOut,
    ]);
} catch (Throwable $error) {
    error_log('EduWatch options assessment error at [' . $etapa . ']: ' . $error->getMessage());

    $payload = [
        'sucesso' => false,
        'mensagem' => 'Não foi possível carregar as opções de avaliação.',
    ];

    // Detalhes técnicos são enviados ao navegador apenas no ambiente local.
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $host = preg_replace('/:\d+$/', '', $host) ?? $host;
    if (in_array($host, ['localhost', '127.0.0.1', '[::1]'], true)) {
        $payload['diagnostico'] = [
            'etapa' => $etapa,
            'erro' => $error->getMessage(),
        ];
    }

    ew_acad_json(500, $payload);
}
