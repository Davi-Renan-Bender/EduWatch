<?php
declare(strict_types=1);

require_once __DIR__ . '/comum.php';

eduwatch_exigir_metodo('GET');
$usuario = ew_acad_require_role(['professor']);

try {
    $atribuicoes = ew_acad_rows(
        '/rest/v1/turma_disciplinas?select=id&professor_id=eq.'
        . rawurlencode($usuario['id']) . '&order=id.asc',
        'as atribuições do professor'
    );

    $ids = array_values(array_unique(array_map(
        static fn(array $item): int => (int) $item['id'],
        $atribuicoes
    )));

    if (!$ids) {
        ew_acad_json(200, [
            'sucesso' => true,
            'avaliacoes' => []
        ]);
    }

    $avaliacoes = ew_acad_rows(
        '/rest/v1/avaliacoes?select=id,turma_disciplina_id,'
        . 'periodo_letivo_id,titulo,data_aplicacao,nota_maxima,status'
        . '&status=eq.rascunho'
        . '&criado_por=eq.' . rawurlencode($usuario['id'])
        . '&turma_disciplina_id=' . ew_acad_in_filter($ids)
        . '&order=data_aplicacao.asc,id.asc',
        'as avaliações em aberto do professor'
    );

    ew_acad_json(200, [
        'sucesso' => true,
        'avaliacoes' => $avaliacoes
    ]);
} catch (Throwable $error) {
    error_log(
        'EduWatch open assessments error: '
        . $error->getMessage()
    );

    ew_acad_json(500, [
        'sucesso' => false,
        'mensagem' => 'Não foi possível carregar as avaliações em aberto.'
    ]);
}