<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

function ew_multi_fail(int $status, array $body): void
{
    eduwatch_json($status, $body);
    exit;
}

function ew_multi_require_gestao(string $method): array
{
    eduwatch_iniciar_sessao();
    eduwatch_exigir_metodo($method);

    if ($method === 'POST') {
        if (empty($_SERVER['HTTP_ORIGIN'])) {
            ew_multi_fail(403, [
                'sucesso' => false,
                'mensagem' => 'Origem da solicitação não identificada. Atualize a página e tente novamente.',
            ]);
        }
        eduwatch_validar_origem();
    }

    $config = eduwatch_config();
    if (($config['url'] ?? '') === '' || ($config['secret_key'] ?? '') === '') {
        ew_multi_fail(500, [
            'sucesso' => false,
            'mensagem' => 'O servidor ainda não está configurado para gerenciar atribuições.',
        ]);
    }
    if (empty($_SESSION['usuario']['id']) || !eduwatch_renovar_token_se_necessario()) {
        eduwatch_limpar_sessao();
        ew_multi_fail(401, ['sucesso' => false, 'mensagem' => 'Sua sessão expirou. Entre novamente no EduWatch.']);
    }

    $actorId = (string) $_SESSION['usuario']['id'];
    $actorResponse = eduwatch_supabase_request(
        'GET',
        '/rest/v1/usuarios?select=id,ativo,tipo_usuario_id&id=eq.' . rawurlencode($actorId) . '&limit=1',
        $config['secret_key']
    );
    $actors = $actorResponse['dados'] ?? null;
    if (($actorResponse['status'] ?? 0) < 200 || ($actorResponse['status'] ?? 0) >= 300 || !is_array($actors) || empty($actors[0])) {
        ew_multi_fail(401, ['sucesso' => false, 'mensagem' => 'Não foi possível validar sua conta. Entre novamente no EduWatch.']);
    }
    if (($actors[0]['ativo'] ?? false) !== true) {
        eduwatch_limpar_sessao();
        ew_multi_fail(403, ['sucesso' => false, 'mensagem' => 'Sua conta está inativa e não pode gerenciar atribuições.']);
    }

    $typeId = (int) ($actors[0]['tipo_usuario_id'] ?? 0);
    $typeResponse = eduwatch_supabase_request(
        'GET',
        '/rest/v1/tipos_usuario?select=codigo&id=eq.' . $typeId . '&limit=1',
        $config['secret_key']
    );
    $types = $typeResponse['dados'] ?? null;
    $typeCode = is_array($types) && isset($types[0]['codigo']) ? (string) $types[0]['codigo'] : '';
    if (($typeResponse['status'] ?? 0) < 200 || ($typeResponse['status'] ?? 0) >= 300 || !in_array($typeCode, ['coordenacao', 'administrador'], true)) {
        ew_multi_fail(403, ['sucesso' => false, 'mensagem' => 'Somente coordenação e administração podem gerenciar atribuições de professores.']);
    }

    return $config;
}

function ew_multi_rows(array $config, string $path, string $description): array
{
    $response = eduwatch_supabase_request('GET', $path, $config['secret_key']);
    $rows = $response['dados'] ?? null;
    if (($response['status'] ?? 0) < 200 || ($response['status'] ?? 0) >= 300 || !is_array($rows)) {
        error_log('EduWatch teacher assignments: failed retrieving ' . $description . '; HTTP ' . (int) ($response['status'] ?? 0));
        ew_multi_fail(502, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar ' . $description . '. Tente novamente.']);
    }
    return $rows;
}
