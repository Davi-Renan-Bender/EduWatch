<?php
declare(strict_types=1);

require_once __DIR__ . '/comum.php';

eduwatch_exigir_metodo('POST');
eduwatch_validar_origem();
$usuario = ew_acad_require_role(['professor']);

$input = eduwatch_ler_json();
$avaliacaoId = filter_var(
    $input['avaliacao_id'] ?? null,
    FILTER_VALIDATE_INT
);

if (!$avaliacaoId || $avaliacaoId < 1) {
    ew_acad_json(422, [
        'sucesso' => false,
        'mensagem' => 'Informe uma avaliação válida.'
    ]);
}

function ew_avaliacao_excluir_registros(
    string $path,
    string $contexto
): void {
    $response = ew_acad_db(
        'DELETE',
        $path,
        null,
        'return=minimal'
    );

    if (
        $response['status'] < 200 ||
        $response['status'] >= 300
    ) {
        $detalhes = is_array($response['data'])
            ? (string) (
                $response['data']['message']
                ?? $response['data']['code']
                ?? ''
            )
            : '';

        error_log(
            'EduWatch delete failed (' . $contexto .
            '), HTTP ' . $response['status'] .
            ': ' . $detalhes
        );

        throw new RuntimeException(
            'Não foi possível excluir ' . $contexto .
            '. HTTP ' . $response['status'] . '.'
        );
    }
}

try {
    $avaliacao = ew_acad_one(
        '/rest/v1/avaliacoes?select=id,turma_disciplina_id,titulo,status&id=eq.'
        . (int) $avaliacaoId,
        'a avaliação'
    );

    if (!$avaliacao) {
        ew_acad_json(404, [
            'sucesso' => false,
            'mensagem' => 'Avaliação não encontrada ou já excluída.'
        ]);
    }

    // Só permite excluir avaliações da turma/disciplina
    // atualmente atribuída ao professor autenticado.
    ew_acad_require_teacher_assignment(
        (int) $avaliacao['turma_disciplina_id'],
        $usuario['id']
    );

    $id = (int) $avaliacaoId;

    // Primeiro, busca os itens vinculados à avaliação.
    $itens = ew_acad_rows(
        '/rest/v1/itens_avaliacao?select=id&avaliacao_id=eq.' . $id,
        'os itens da avaliação'
    );

    $itemIds = array_values(array_unique(array_map(
        static fn(array $item): int => (int) $item['id'],
        $itens
    )));

    // Os resultados dependem dos itens; excluí-los primeiro.
    if ($itemIds) {
        ew_avaliacao_excluir_registros(
            '/rest/v1/resultados_itens?item_avaliacao_id='
            . ew_acad_in_filter($itemIds),
            'os resultados dos itens'
        );
    }

    // Exclui as notas totais e os itens da avaliação.
    ew_avaliacao_excluir_registros(
        '/rest/v1/notas?avaliacao_id=eq.' . $id,
        'as notas'
    );

    ew_avaliacao_excluir_registros(
        '/rest/v1/itens_avaliacao?avaliacao_id=eq.' . $id,
        'os itens'
    );

    // Exclui as notificações geradas especificamente
    // para esta avaliação.
    $tituloNotificacao =
        'Atenção ao desempenho - avaliação ' . $id;

    ew_avaliacao_excluir_registros(
        '/rest/v1/notificacoes?titulo=eq.'
        . rawurlencode($tituloNotificacao),
        'as notificações relacionadas'
    );

    // Por último, exclui a avaliação.
    ew_avaliacao_excluir_registros(
        '/rest/v1/avaliacoes?id=eq.' . $id,
        'a avaliação'
    );

    ew_acad_json(200, [
        'sucesso' => true,
        'mensagem' => 'Avaliação excluída com sucesso.',
        'avaliacao_id' => $id
    ]);

} catch (Throwable $error) {
    error_log(
        'EduWatch assessment delete error: '
        . $error->getMessage()
    );

    ew_acad_json(500, [
        'sucesso' => false,
        'mensagem' => $error instanceof RuntimeException
            ? $error->getMessage()
            : 'Não foi possível excluir a avaliação.'
    ]);
}