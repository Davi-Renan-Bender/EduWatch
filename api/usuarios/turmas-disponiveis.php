<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

eduwatch_iniciar_sessao();
eduwatch_exigir_metodo('GET');
eduwatch_validar_origem();

$config = eduwatch_config();
if ($config['url'] === '' || $config['secret_key'] === '') {
    eduwatch_json(500, [
        'sucesso' => false,
        'mensagem' => 'O servidor ainda nao esta configurado para consultar turmas.',
    ]);
}

if (empty($_SESSION['usuario']['id']) || !eduwatch_renovar_token_se_necessario()) {
    eduwatch_limpar_sessao();
    eduwatch_json(401, [
        'sucesso' => false,
        'mensagem' => 'Sua sessão expirou. Entre novamente no EduWatch.',
    ]);
}

try {
    $atorId = (string) $_SESSION['usuario']['id'];
    $atorResposta = eduwatch_supabase_request(
        'GET',
        '/rest/v1/usuarios?select=id,ativo,tipo_usuario_id&id=eq.' . rawurlencode($atorId) . '&limit=1',
        $config['secret_key']
    );
    $atores = $atorResposta['dados'];
    if ($atorResposta['status'] < 200 || $atorResposta['status'] >= 300 || !is_array($atores) || !isset($atores[0])) {
        eduwatch_json(401, ['sucesso' => false, 'mensagem' => 'Não foi possível validar sua conta. Entre novamente.']);
    }
    $ator = $atores[0];
    if (($ator['ativo'] ?? false) !== true) {
        eduwatch_limpar_sessao();
        eduwatch_json(403, ['sucesso' => false, 'mensagem' => 'Sua conta está inativa.']);
    }

    $tipoResposta = eduwatch_supabase_request(
        'GET',
        '/rest/v1/tipos_usuario?select=id,codigo&id=eq.' . (int) ($ator['tipo_usuario_id'] ?? 0) . '&limit=1',
        $config['secret_key']
    );
    $tipos = $tipoResposta['dados'];
    if ($tipoResposta['status'] < 200 || $tipoResposta['status'] >= 300 || !is_array($tipos) || !isset($tipos[0]['codigo'])) {
        eduwatch_json(403, ['sucesso' => false, 'mensagem' => 'Seu perfil não pode consultar turmas.']);
    }
    if (!in_array((string) $tipos[0]['codigo'], ['coordenacao', 'administrador'], true)) {
        eduwatch_json(403, ['sucesso' => false, 'mensagem' => 'Somente coordenação e administração podem consultar turmas para cadastro.']);
    }

    $turmasResposta = eduwatch_supabase_request(
        'GET',
        '/rest/v1/turmas?select=id,nome,status&status=eq.ativa&order=nome.asc&limit=500',
        $config['secret_key']
    );
    $turmas = $turmasResposta['dados'];
    if ($turmasResposta['status'] < 200 || $turmasResposta['status'] >= 300 || !is_array($turmas)) {
        error_log('EduWatch turma list: Supabase returned HTTP ' . $turmasResposta['status']);
        eduwatch_json(502, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar as turmas.']);
    }

    $resultado = [];
    foreach ($turmas as $turma) {
        if (isset($turma['id'], $turma['nome'])) {
            $resultado[] = [
                'id' => (int) $turma['id'],
                'nome' => (string) $turma['nome'],
            ];
        }
    }

    eduwatch_json(200, ['sucesso' => true, 'turmas' => $resultado]);
} catch (Throwable $erro) {
    error_log('EduWatch turma list: unexpected failure (' . get_class($erro) . ').');
    eduwatch_json(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar as turmas.']);
}
