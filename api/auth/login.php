<?php
declare(strict_types=1);
require_once __DIR__ . '/../config.php';

eduwatch_iniciar_sessao();
eduwatch_exigir_metodo('POST');
eduwatch_validar_origem();

$config = eduwatch_config();
if ($config['url'] === '' || $config['public_key'] === '' || $config['secret_key'] === '') {
    eduwatch_json(500, [
        'sucesso' => false,
        'mensagem' => 'O servidor ainda não está configurado para autenticar no Supabase.',
    ]);
}

$entrada = eduwatch_ler_json();
$email = strtolower(trim((string) ($entrada['email'] ?? '')));
$senha = (string) ($entrada['senha'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254 || $senha === '' || strlen($senha) > 4096) {
    eduwatch_json(422, ['sucesso' => false, 'mensagem' => 'Informe um e-mail válido e a senha.']);
}

try {
    // Consulta feita exclusivamente no servidor para localizar o perfil pelo e-mail.
    $filtroEmail = rawurlencode($email);
    $perfilResposta = eduwatch_supabase_request(
        'GET',
        '/rest/v1/usuarios?select=id,email,nome_completo,tipo_usuario_id,cpf,ativo&email=eq.' . $filtroEmail . '&limit=1',
        $config['secret_key']
    );

    $perfis = $perfilResposta['dados'];
    if ($perfilResposta['status'] < 200 || $perfilResposta['status'] >= 300 || !is_array($perfis) || !isset($perfis[0])) {
        eduwatch_json(401, ['sucesso' => false, 'mensagem' => 'E-mail ou senha incorretos.']);
    }

    $perfil = $perfis[0];
    if (($perfil['ativo'] ?? false) !== true || empty($perfil['email']) || empty($perfil['id'])) {
        eduwatch_json(401, ['sucesso' => false, 'mensagem' => 'E-mail ou senha incorretos.']);
    }

    // Determina o tipo usando a tabela de referência do próprio banco.
    $tipoId = (int) ($perfil['tipo_usuario_id'] ?? 0);
    $tipoResposta = eduwatch_supabase_request(
        'GET',
        '/rest/v1/tipos_usuario?select=id,codigo&id=eq.' . $tipoId . '&limit=1',
        $config['secret_key']
    );
    $tipos = $tipoResposta['dados'];
    if ($tipoResposta['status'] < 200 || $tipoResposta['status'] >= 300 || !is_array($tipos) || !isset($tipos[0]['codigo'])) {
        error_log('EduWatch login: tipo de usuário ausente para tipo_usuario_id=' . $tipoId);
        eduwatch_json(500, ['sucesso' => false, 'mensagem' => 'Não foi possível validar o perfil desta conta.']);
    }
    $codigoTipo = (string) $tipos[0]['codigo'];
    $niveisPermitidos = ['aluno', 'professor', 'coordenacao', 'administrador'];
    if (!in_array($codigoTipo, $niveisPermitidos, true)) {
        eduwatch_json(401, ['sucesso' => false, 'mensagem' => 'E-mail ou senha incorretos.']);
    }

    // Supabase Auth valida o e-mail e a senha no servidor.
    $authResposta = eduwatch_supabase_request(
        'POST',
        '/auth/v1/token?grant_type=password',
        $config['public_key'],
        ['email' => (string) $perfil['email'], 'password' => $senha]
    );

    $auth = $authResposta['dados'];
    if ($authResposta['status'] < 200 || $authResposta['status'] >= 300 || !is_array($auth) || empty($auth['access_token']) || empty($auth['refresh_token']) || empty($auth['user']['id'])) {
        eduwatch_json(401, ['sucesso' => false, 'mensagem' => 'E-mail ou senha incorretos.']);
    }

    // Confirma explicitamente que a identidade autenticada corresponde ao perfil localizado.
    if (!hash_equals((string) $perfil['id'], (string) $auth['user']['id'])) {
        error_log('EduWatch login: UUID Auth não corresponde ao perfil localizado.');
        eduwatch_json(401, ['sucesso' => false, 'mensagem' => 'E-mail ou senha incorretos.']);
    }

    session_regenerate_id(true);
    $nivelFrontend = eduwatch_nivel_frontend($codigoTipo);
    $_SESSION['usuario'] = [
        'id' => (string) $perfil['id'],
        'email' => (string) $perfil['email'],
        'nome' => (string) $perfil['nome_completo'],
        'cpf' => (string) ($perfil['cpf'] ?? ''),
        'nivel' => $nivelFrontend,
        'tipoUsuario' => $codigoTipo,
        'tipoUsuarioId' => $tipoId,
    ];
    $_SESSION['supabase'] = [
        'access_token' => (string) $auth['access_token'],
        'refresh_token' => (string) $auth['refresh_token'],
        'expira_em' => time() + (int) ($auth['expires_in'] ?? 3600),
    ];

    $destinos = [
        'aluno' => 'aluno.html',
        'professor' => 'professor.html',
        'coordenacao' => 'coordenacao.html',
        'administrador' => 'admin.html',
    ];

    eduwatch_json(200, [
        'sucesso' => true,
        'redirecionar' => $destinos[$codigoTipo],
    ]);
} catch (Throwable $erro) {
    error_log('EduWatch login error: ' . $erro->getMessage());
    eduwatch_json(500, ['sucesso' => false, 'mensagem' => 'Não foi possível concluir o login. Verifique a configuração do servidor e tente novamente.']);
}
