<?php
declare(strict_types=1);
require_once __DIR__ . '/../config.php';

eduwatch_iniciar_sessao();
eduwatch_exigir_metodo('GET');

if (empty($_SESSION['usuario']['id']) || !eduwatch_renovar_token_se_necessario()) {
    eduwatch_limpar_sessao();
    eduwatch_json(401, ['autenticado' => false, 'mensagem' => 'Sessão não autenticada.']);
}

$config = eduwatch_config();
$usuarioSessao = $_SESSION['usuario'];
$id = rawurlencode((string) $usuarioSessao['id']);
$token = (string) $_SESSION['supabase']['access_token'];

try {
    // Reconsulta o próprio perfil usando o token do usuário, com RLS aplicada.
    $perfilResposta = eduwatch_supabase_request(
        'GET',
        '/rest/v1/usuarios?select=id,email,nome_completo,cpf,tipo_usuario_id,ativo&id=eq.' . $id . '&limit=1',
        $config['public_key'],
        null,
        $token
    );
    $perfis = $perfilResposta['dados'];

    if ($perfilResposta['status'] < 200 || $perfilResposta['status'] >= 300 || !is_array($perfis) || !isset($perfis[0]) || ($perfis[0]['ativo'] ?? false) !== true) {
        eduwatch_limpar_sessao();
        eduwatch_json(401, ['autenticado' => false, 'mensagem' => 'A conta não está ativa ou não possui perfil.']);
    }

    $perfil = $perfis[0];
    $tipoId = (int) ($perfil['tipo_usuario_id'] ?? 0);
    $tipoResposta = eduwatch_supabase_request(
        'GET',
        '/rest/v1/tipos_usuario?select=id,codigo&id=eq.' . $tipoId . '&limit=1',
        $config['public_key'],
        null,
        $token
    );
    $tipos = $tipoResposta['dados'];
    if ($tipoResposta['status'] < 200 || $tipoResposta['status'] >= 300 || !is_array($tipos) || !isset($tipos[0]['codigo'])) {
        eduwatch_limpar_sessao();
        eduwatch_json(401, ['autenticado' => false, 'mensagem' => 'Não foi possível validar o perfil.']);
    }

    $codigoTipo = (string) $tipos[0]['codigo'];
    $_SESSION['usuario'] = [
        'id' => (string) $perfil['id'],
        'email' => (string) $perfil['email'],
        'nome' => (string) $perfil['nome_completo'],
        'cpf' => (string) ($perfil['cpf'] ?? ''),
        'nivel' => eduwatch_nivel_frontend($codigoTipo),
        'tipoUsuario' => $codigoTipo,
        'tipoUsuarioId' => $tipoId,
    ];

    eduwatch_json(200, [
        'autenticado' => true,
        'usuario' => $_SESSION['usuario'],
    ]);
} catch (Throwable $erro) {
    error_log('EduWatch session validation error: ' . $erro->getMessage());
    eduwatch_json(500, ['autenticado' => false, 'mensagem' => 'Não foi possível validar a sessão.']);
}
