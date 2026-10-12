<?php
declare(strict_types=1);
require_once __DIR__ . '/../config.php';

eduwatch_iniciar_sessao();
eduwatch_exigir_metodo('POST');

// Esta operação altera contas e precisa vir de uma requisição do próprio site.
if (empty($_SERVER['HTTP_ORIGIN'])) {
    eduwatch_json(403, [
        'sucesso' => false,
        'mensagem' => 'Origem da solicitação não identificada. Atualize a página e tente novamente.',
    ]);
}
eduwatch_validar_origem();

$config = eduwatch_config();
if ($config['url'] === '' || $config['public_key'] === '' || $config['secret_key'] === '') {
    eduwatch_json(500, [
        'sucesso' => false,
        'mensagem' => 'O servidor ainda não está configurado para cadastrar usuários.',
    ]);
}

if (empty($_SESSION['usuario']['id']) || !eduwatch_renovar_token_se_necessario()) {
    eduwatch_limpar_sessao();
    eduwatch_json(401, [
        'sucesso' => false,
        'mensagem' => 'Sua sessão expirou. Entre novamente no EduWatch.',
    ]);
}

$entrada = eduwatch_ler_json();
$email = strtolower(trim((string) ($entrada['email'] ?? '')));
$nome = trim((string) ($entrada['nome'] ?? ''));
$tipoSolicitado = strtolower(trim((string) ($entrada['tipoUsuario'] ?? '')));
$cpfInformado = trim((string) ($entrada['cpf'] ?? ''));
$senha = (string) ($entrada['senha'] ?? '');
$confirmarSenha = (string) ($entrada['confirmarSenha'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
    eduwatch_json(422, ['sucesso' => false, 'mensagem' => 'Informe um e-mail válido. Para demonstração, use um endereço fictício único, como aluno01@example.com.']);
}

if ($nome === '' || preg_match('/[\x00-\x1F\x7F]/', $nome) === 1 || strlen($nome) > 300) {
    eduwatch_json(422, ['sucesso' => false, 'mensagem' => 'Informe um nome válido com até 120 caracteres.']);
}
if (function_exists('mb_strlen') && mb_strlen($nome, 'UTF-8') > 120) {
    eduwatch_json(422, ['sucesso' => false, 'mensagem' => 'O nome deve ter no máximo 120 caracteres.']);
}

$cpf = null;
if ($cpfInformado !== '') {
    if (preg_match('/^[0-9.\-\s]+$/', $cpfInformado) !== 1) {
        eduwatch_json(422, ['sucesso' => false, 'mensagem' => 'Se informar CPF, use somente números ou a formatação 000.000.000-00.']);
    }
    $cpf = preg_replace('/\D/', '', $cpfInformado) ?? '';
    if (strlen($cpf) !== 11) {
        eduwatch_json(422, ['sucesso' => false, 'mensagem' => 'O CPF fictício deve conter 11 números. Deixe o campo vazio se não for necessário.']);
    }
}

if (strlen($senha) < 6 || strlen($senha) > 4096) {
    eduwatch_json(422, ['sucesso' => false, 'mensagem' => 'A senha deve ter pelo menos 6 caracteres.']);
}
if (!hash_equals($senha, $confirmarSenha)) {
    eduwatch_json(422, ['sucesso' => false, 'mensagem' => 'As senhas não coincidem.']);
}

try {
    // Confere o papel atual no banco. Não confia apenas no que a interface mostra.
    $atorId = (string) $_SESSION['usuario']['id'];
    $atorResposta = eduwatch_supabase_request(
        'GET',
        '/rest/v1/usuarios?select=id,ativo,tipo_usuario_id&id=eq.' . rawurlencode($atorId) . '&limit=1',
        $config['secret_key']
    );
    $atores = $atorResposta['dados'];
    if ($atorResposta['status'] < 200 || $atorResposta['status'] >= 300 || !is_array($atores) || !isset($atores[0])) {
        error_log('EduWatch create user: não foi possível validar o perfil solicitante; HTTP ' . $atorResposta['status']);
        eduwatch_json(401, ['sucesso' => false, 'mensagem' => 'Não foi possível validar sua conta. Entre novamente no EduWatch.']);
    }

    $ator = $atores[0];
    if (($ator['ativo'] ?? false) !== true) {
        eduwatch_limpar_sessao();
        eduwatch_json(403, ['sucesso' => false, 'mensagem' => 'Sua conta está inativa e não pode cadastrar usuários.']);
    }

    $atorTipoId = (int) ($ator['tipo_usuario_id'] ?? 0);
    $atorTipoResposta = eduwatch_supabase_request(
        'GET',
        '/rest/v1/tipos_usuario?select=id,codigo&id=eq.' . $atorTipoId . '&limit=1',
        $config['secret_key']
    );
    $atorTipos = $atorTipoResposta['dados'];
    if ($atorTipoResposta['status'] < 200 || $atorTipoResposta['status'] >= 300 || !is_array($atorTipos) || !isset($atorTipos[0]['codigo'])) {
        error_log('EduWatch create user: tipo do solicitante não encontrado; tipo_usuario_id=' . $atorTipoId);
        eduwatch_json(403, ['sucesso' => false, 'mensagem' => 'Seu perfil não está autorizado a cadastrar usuários.']);
    }

    $tipoAtor = (string) $atorTipos[0]['codigo'];
    if (!in_array($tipoAtor, ['coordenacao', 'administrador'], true)) {
        eduwatch_json(403, ['sucesso' => false, 'mensagem' => 'Somente coordenação e administração podem cadastrar usuários.']);
    }

    $tiposPermitidos = $tipoAtor === 'administrador'
        ? ['aluno', 'professor', 'coordenacao', 'administrador']
        : ['aluno', 'professor', 'coordenacao'];

    if (!in_array($tipoSolicitado, $tiposPermitidos, true)) {
        eduwatch_json(403, ['sucesso' => false, 'mensagem' => $tipoAtor === 'coordenacao'
            ? 'A coordenação pode cadastrar alunos, professores e outros coordenadores, mas não administradores.'
            : 'Tipo de usuário inválido.']);
    }

    $tipoResposta = eduwatch_supabase_request(
        'GET',
        '/rest/v1/tipos_usuario?select=id,codigo&codigo=eq.' . rawurlencode($tipoSolicitado) . '&limit=1',
        $config['secret_key']
    );
    $tipos = $tipoResposta['dados'];
    if ($tipoResposta['status'] < 200 || $tipoResposta['status'] >= 300 || !is_array($tipos) || !isset($tipos[0]['id'])) {
        error_log('EduWatch create user: tipo solicitado não existe: ' . $tipoSolicitado);
        eduwatch_json(422, ['sucesso' => false, 'mensagem' => 'O tipo de usuário selecionado não existe no banco.']);
    }
    $tipoUsuarioId = (int) $tipos[0]['id'];

    // Evita criar a identidade de Auth quando o perfil já ocupa o e-mail ou CPF.
    $emailExistente = eduwatch_supabase_request(
        'GET',
        '/rest/v1/usuarios?select=id&email=eq.' . rawurlencode($email) . '&limit=1',
        $config['secret_key']
    );
    if ($emailExistente['status'] < 200 || $emailExistente['status'] >= 300 || !is_array($emailExistente['dados'])) {
        error_log('EduWatch create user: falha ao verificar e-mail duplicado; HTTP ' . $emailExistente['status']);
        eduwatch_json(502, ['sucesso' => false, 'mensagem' => 'Não foi possível verificar se o e-mail está disponível. Tente novamente.']);
    }
    if (count($emailExistente['dados']) > 0) {
        eduwatch_json(409, ['sucesso' => false, 'mensagem' => 'Esse e-mail já está cadastrado no EduWatch.']);
    }

    if ($cpf !== null) {
        $cpfExistente = eduwatch_supabase_request(
            'GET',
            '/rest/v1/usuarios?select=id&cpf=eq.' . rawurlencode($cpf) . '&limit=1',
            $config['secret_key']
        );
        if ($cpfExistente['status'] < 200 || $cpfExistente['status'] >= 300 || !is_array($cpfExistente['dados'])) {
            error_log('EduWatch create user: falha ao verificar CPF; HTTP ' . $cpfExistente['status']);
            eduwatch_json(502, ['sucesso' => false, 'mensagem' => 'Não foi possível verificar o CPF. Tente novamente.']);
        }
        if (count($cpfExistente['dados']) > 0) {
            eduwatch_json(409, ['sucesso' => false, 'mensagem' => 'Esse CPF já está cadastrado. Use outro valor fictício ou deixe o campo vazio.']);
        }
    }

    // Cria a identidade de autenticação. O e-mail é confirmado pelo processo
    // administrativo; nenhuma mensagem é enviada ao endereço fictício.
    $criarAuth = eduwatch_supabase_request(
        'POST',
        '/auth/v1/admin/users',
        $config['secret_key'],
        [
            'email' => $email,
            'password' => $senha,
            'email_confirm' => true,
            'user_metadata' => ['nome_completo' => $nome],
        ]
    );

    $novoAuth = $criarAuth['dados'];
    if ($criarAuth['status'] < 200 || $criarAuth['status'] >= 300 || !is_array($novoAuth) || empty($novoAuth['id'])) {
        $statusAuth = (int) $criarAuth['status'];
        $erroAuth = is_array($novoAuth) ? strtolower((string) ($novoAuth['msg'] ?? $novoAuth['message'] ?? $novoAuth['error_description'] ?? '')) : '';
        error_log('EduWatch create user: Auth Admin recusou a criação; HTTP ' . $statusAuth);

        if (str_contains($erroAuth, 'already') || str_contains($erroAuth, 'registered') || $statusAuth === 409) {
            eduwatch_json(409, ['sucesso' => false, 'mensagem' => 'Esse e-mail já possui uma conta no sistema de autenticação.']);
        }
        if ($statusAuth === 401 || $statusAuth === 403) {
            eduwatch_json(502, ['sucesso' => false, 'mensagem' => 'O servidor não conseguiu autorizar a criação da conta no Supabase. Confira a configuração do servidor.']);
        }
        eduwatch_json(422, ['sucesso' => false, 'mensagem' => 'O Supabase recusou os dados. Confira o e-mail e a senha e tente novamente.']);
    }

    $novoAuthId = (string) $novoAuth['id'];
    $perfilCorpo = [
        'id' => $novoAuthId,
        'email' => $email,
        'nome_completo' => $nome,
        'tipo_usuario_id' => $tipoUsuarioId,
        'cpf' => $cpf,
        'ativo' => true,
    ];

    try {
        $criarPerfil = eduwatch_supabase_request(
            'POST',
            '/rest/v1/usuarios',
            $config['secret_key'],
            $perfilCorpo
        );
    } catch (Throwable $erroPerfil) {
        error_log('EduWatch create user: erro de transporte ao criar perfil. Tentando rollback da conta Auth.');
        $criarPerfil = ['status' => 0, 'dados' => null];
    }

    if ($criarPerfil['status'] < 200 || $criarPerfil['status'] >= 300) {
        // As duas APIs não compartilham uma transação. Se o perfil falhar,
        // tenta remover a identidade Auth recém-criada para evitar órfãos.
        error_log('EduWatch create user: falha ao criar perfil; HTTP ' . $criarPerfil['status'] . '. Tentando rollback da conta Auth.');
        try {
            $rollback = eduwatch_supabase_request(
                'DELETE',
                '/auth/v1/admin/users/' . rawurlencode($novoAuthId),
                $config['secret_key']
            );
            if ($rollback['status'] < 200 || $rollback['status'] >= 300) {
                error_log('EduWatch create user: rollback Auth falhou; HTTP ' . $rollback['status'] . '; UUID=' . $novoAuthId);
            }
        } catch (Throwable $erroRollback) {
            error_log('EduWatch create user: exceção no rollback Auth; UUID=' . $novoAuthId);
        }

        eduwatch_json(500, ['sucesso' => false, 'mensagem' => 'A conta de autenticação foi criada, mas não foi possível concluir o perfil. O sistema tentou desfazer a criação; se o problema persistir, a equipe técnica deverá conferir o cadastro.']);
    }

    eduwatch_json(201, [
        'sucesso' => true,
        'mensagem' => 'Usuário cadastrado com sucesso. Ele já pode entrar com o e-mail e a senha definidos.',
        'usuario' => [
            'id' => $novoAuthId,
            'email' => $email,
            'nome' => $nome,
            'tipoUsuario' => $tipoSolicitado,
            'tipoUsuarioId' => $tipoUsuarioId,
        ],
    ]);
} catch (Throwable $erro) {
    error_log('EduWatch create user: falha inesperada (' . get_class($erro) . ').');
    eduwatch_json(500, ['sucesso' => false, 'mensagem' => 'Não foi possível concluir o cadastro. Confira a conexão e tente novamente.']);
}
