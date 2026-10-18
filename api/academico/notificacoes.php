<?php
declare(strict_types=1);

require_once __DIR__ . '/comum.php';

$metodo = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($metodo, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    ew_acad_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}
if ($metodo === 'POST') {
    eduwatch_validar_origem();
}

$usuario = ew_acad_require_role(['aluno', 'professor', 'coordenacao', 'administrador']);
$usuarioId = rawurlencode($usuario['id']);

try {
    if ($metodo === 'GET') {
        $rows = ew_acad_rows(
            '/rest/v1/notificacoes?select=id,titulo,mensagem,link_destino,created_at,lida_em'
            . '&usuario_id=eq.' . $usuarioId
            . '&order=created_at.desc,id.desc&limit=100',
            'suas notificações'
        );

        $naoLidas = 0;
        foreach ($rows as $row) {
            if (empty($row['lida_em'])) $naoLidas++;
        }

        ew_acad_json(200, [
            'sucesso' => true,
            'notificacoes' => array_map(static fn($row) => [
                'id' => (int) $row['id'],
                'titulo' => (string) $row['titulo'],
                'mensagem' => (string) $row['mensagem'],
                'link_destino' => isset($row['link_destino']) ? (string) $row['link_destino'] : null,
                'created_at' => (string) $row['created_at'],
                'lida_em' => isset($row['lida_em']) ? (string) $row['lida_em'] : null,
            ], $rows),
            'nao_lidas' => $naoLidas,
        ]);
    }

    $input = eduwatch_ler_json();
    $acao = (string) ($input['acao'] ?? '');
    $agora = gmdate('Y-m-d\TH:i:s\Z');

    if ($acao === 'marcar_lida') {
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id <= 0) {
            ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Notificação inválida.']);
        }
        ew_acad_write(
            'PATCH',
            '/rest/v1/notificacoes?id=eq.' . (int) $id . '&usuario_id=eq.' . $usuarioId . '&lida_em=is.null',
            ['lida_em' => $agora],
            'a notificação como lida',
            'return=minimal'
        );
        ew_acad_json(200, ['sucesso' => true, 'mensagem' => 'Notificação marcada como lida.']);
    }

    if ($acao === 'marcar_todas') {
        ew_acad_write(
            'PATCH',
            '/rest/v1/notificacoes?usuario_id=eq.' . $usuarioId . '&lida_em=is.null',
            ['lida_em' => $agora],
            'as notificações como lidas',
            'return=minimal'
        );
        ew_acad_json(200, ['sucesso' => true, 'mensagem' => 'Todas as notificações foram marcadas como lidas.']);
    }

    ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Ação de notificação desconhecida.']);
} catch (Throwable $error) {
    error_log('EduWatch notifications API error: ' . get_class($error) . ': ' . $error->getMessage());
    ew_acad_json(500, [
        'sucesso' => false,
        'mensagem' => $error instanceof RuntimeException ? $error->getMessage() : 'Não foi possível carregar ou atualizar as notificações.',
    ]);
}
