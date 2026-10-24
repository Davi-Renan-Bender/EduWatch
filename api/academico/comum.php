<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

/** Resposta JSON padronizada. */
function ew_acad_json(int $status, array $payload): never
{
    eduwatch_json($status, $payload);
}

/** Requisição PostgREST usando a chave secreta somente no servidor. */
function ew_acad_db(string $method, string $path, ?array $body = null, ?string $prefer = null): array
{
    $config = eduwatch_config();
    if (empty($config['url']) || empty($config['secret_key'])) {
        // Registra o arquivo realmente executado, sem registrar credenciais.
        error_log(
            'EduWatch academic configuration missing in ' . __FILE__
            . '; url=' . (empty($config['url']) ? 'MISSING' : 'OK')
            . '; secret=' . (empty($config['secret_key']) ? 'MISSING' : 'OK')
        );
        throw new RuntimeException('Configuração do Supabase ausente no servidor.');
    }
    if (!function_exists('curl_init')) {
        throw new RuntimeException('A extensão cURL do PHP não está habilitada.');
    }

    $headers = [
        'apikey: ' . $config['secret_key'],
        'Accept: application/json',
    ];
    if (!str_starts_with($config['secret_key'], 'sb_secret_')) {
        // Chaves legadas service_role são JWTs e também exigem Authorization.
        $headers[] = 'Authorization: Bearer ' . $config['secret_key'];
    }
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    if ($prefer !== null && $prefer !== '') {
        $headers[] = 'Prefer: ' . $prefer;
    }

    $curl = curl_init($config['url'] . $path);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    if ($body !== null) {
        $encoded = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            curl_close($curl);
            throw new RuntimeException('Não foi possível preparar a consulta.');
        }
        curl_setopt($curl, CURLOPT_POSTFIELDS, $encoded);
    }

    $raw = curl_exec($curl);
    $curlError = curl_error($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    if ($raw === false) {
        error_log('EduWatch academic Supabase connection failed: ' . $curlError);
        throw new RuntimeException('Não foi possível conectar ao banco de dados.');
    }
    $decoded = json_decode((string) $raw, true);
    return ['status' => $status, 'data' => $decoded, 'raw' => (string) $raw];
}

function ew_acad_require_role(array $allowedRoles): array
{
    eduwatch_iniciar_sessao();

    if (empty($_SESSION['usuario']['id']) || !eduwatch_renovar_token_se_necessario()) {
        eduwatch_limpar_sessao();
        ew_acad_json(401, [
            'sucesso' => false,
            'mensagem' => 'Sua sessão expirou. Entre novamente.',
        ]);
    }

    $id = (string) $_SESSION['usuario']['id'];
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) {
        eduwatch_limpar_sessao();
        ew_acad_json(401, [
            'sucesso' => false,
            'mensagem' => 'Sessão inválida. Entre novamente.',
        ]);
    }

    // Essas APIs acessam o Supabase com a chave privilegiada, que não aplica
    // as permissões RLS do usuário. Portanto, confirme o estado atual da conta
    // e o papel diretamente no banco em cada chamada acadêmica.
    try {
        $profile = ew_acad_one(
            '/rest/v1/usuarios?select=id,ativo,tipo_usuario_id&id=eq.' . rawurlencode($id),
            'o perfil do usuário autenticado'
        );
        if (!$profile || ($profile['ativo'] ?? false) !== true) {
            eduwatch_limpar_sessao();
            ew_acad_json(401, [
                'sucesso' => false,
                'mensagem' => 'Sua conta não está ativa ou não foi encontrada. Entre novamente.',
            ]);
        }

        $tipoUsuarioId = (int) ($profile['tipo_usuario_id'] ?? 0);
        $tipo = $tipoUsuarioId > 0
            ? ew_acad_one(
                '/rest/v1/tipos_usuario?select=id,codigo&id=eq.' . $tipoUsuarioId,
                'o perfil do usuário autenticado'
            )
            : null;
        if (!$tipo || empty($tipo['codigo'])) {
            eduwatch_limpar_sessao();
            ew_acad_json(401, [
                'sucesso' => false,
                'mensagem' => 'Não foi possível validar seu perfil. Entre novamente.',
            ]);
        }
    } catch (Throwable $error) {
        error_log('EduWatch academic authorization lookup failed: ' . get_class($error));
        ew_acad_json(503, [
            'sucesso' => false,
            'mensagem' => 'Não foi possível validar sua permissão agora. Tente novamente.',
        ]);
    }

    $role = (string) $tipo['codigo'];
    // Mantém a sessão alinhada ao banco para que uma alteração de papel entre
    // logins não continue usando o papel anterior.
    $_SESSION['usuario']['tipoUsuario'] = $role;
    $_SESSION['usuario']['tipoUsuarioId'] = $tipoUsuarioId;
    $_SESSION['usuario']['nivel'] = eduwatch_nivel_frontend($role);

    if (!in_array($role, ['aluno', 'professor', 'coordenacao', 'administrador'], true)) {
        eduwatch_json(401, [
            'sucesso' => false,
            'mensagem' => 'Não foi possível validar seu perfil. Entre novamente.',
        ]);
    }

    if (!in_array($role, $allowedRoles, true)) {
        ew_acad_json(403, [
            'sucesso' => false,
            'mensagem' => 'Você não tem permissão para realizar esta operação.',
        ]);
    }

    return [
        'id' => $id,
        'role' => $role,
        'tipo_usuario_id' => $tipoUsuarioId,
    ];
}


function ew_acad_rows(string $path, string $context): array
{
    $fetch = static function (string $requestPath) use ($context): array {
        $response = ew_acad_db('GET', $requestPath);

        if (
            $response['status'] < 200
            || $response['status'] >= 300
            || !is_array($response['data'])
        ) {
            $data = is_array($response['data'])
                ? $response['data']
                : [];

            $code = (string) ($data['code'] ?? '');
            $details = (string) (
                $data['message'] ?? 'Resposta inesperada do PostgREST.'
            );

            error_log(
                'EduWatch academic read failed (' . $context
                . '), HTTP ' . $response['status']
                . ', code=' . ($code !== '' ? $code : 'n/a')
                . ': ' . $details
            );

            throw new RuntimeException(
                'Falha ao carregar ' . $context
                . ' (HTTP ' . $response['status']
                . ($code !== '' ? ', código ' . $code : '')
                . ').'
            );
        }

        return $response['data'];
    };

    $questionPosition = strpos($path, '?');

    $basePath = $questionPosition === false
        ? $path
        : substr($path, 0, $questionPosition);

    $queryString = $questionPosition === false
        ? ''
        : substr($path, $questionPosition + 1);

    $params = [];

    if ($queryString !== '') {
        parse_str($queryString, $params);
    }

    $requestedLimit = isset($params['limit'])
        && is_numeric($params['limit'])
        ? max(0, (int) $params['limit'])
        : null;

    $initialOffset = isset($params['offset'])
        && is_numeric($params['offset'])
        ? max(0, (int) $params['offset'])
        : 0;

    $pageSize = 1000;

    // Consultas pequenas continuam sendo feitas normalmente.
    if ($requestedLimit !== null && $requestedLimit <= $pageSize) {
        return $fetch($path);
    }

    // Respeita o limite solicitado. Sem limite explícito, usa um teto
    // de segurança para evitar carregar registros ilimitados.
    $maxRows = $requestedLimit ?? 50000;

    if ($maxRows <= 0) {
        return [];
    }

    unset($params['limit'], $params['offset']);

    // Garante uma ordem estável para a paginação.
    $order = trim((string) ($params['order'] ?? ''));

    if ($order === '') {
        $params['order'] = 'id.asc';
    } else {
        $orderWithoutSpaces = preg_replace('/\s+/', '', $order) ?? $order;

        if (!preg_match('/(^|,)id(?:\.|,|$)/i', $orderWithoutSpaces)) {
            $params['order'] = $order . ',id.asc';
        }
    }

    $allRows = [];
    $fetched = 0;

    while ($fetched < $maxRows) {
        $pageLimit = min($pageSize, $maxRows - $fetched);

        $pageParams = $params;
        $pageParams['limit'] = $pageLimit;
        $pageParams['offset'] = $initialOffset + $fetched;

        $pagePath = $basePath . '?'
            . http_build_query(
                $pageParams,
                '',
                '&',
                PHP_QUERY_RFC3986
            );

        $pageRows = $fetch($pagePath);
        $received = count($pageRows);

        if ($received === 0) {
            break;
        }

        $allRows = array_merge($allRows, $pageRows);
        $fetched += $received;

        if ($received < $pageLimit) {
            break;
        }
    }

    return $allRows;
}


function ew_acad_write(string $method, string $path, array $body, string $context, string $prefer = 'return=representation'): array
{
    $response = ew_acad_db($method, $path, $body, $prefer);
    if ($response['status'] < 200 || $response['status'] >= 300) {
        $details = is_array($response['data']) ? ($response['data']['message'] ?? $response['data']['code'] ?? '') : '';
        error_log('EduWatch academic write failed (' . $context . '), HTTP ' . $response['status'] . ': ' . (string) $details);
        throw new RuntimeException('Não foi possível salvar ' . $context . '. Verifique os dados e tente novamente.');
    }
    return is_array($response['data']) ? $response['data'] : [];
}

function ew_acad_in_filter(array $values): string
{
    $clean = [];
    foreach ($values as $value) {
        if (is_int($value) || (is_string($value) && preg_match('/^[0-9]+$/', $value))) {
            $clean[] = (string) (int) $value;
        } elseif (is_string($value) && preg_match('/^[0-9a-f-]{36}$/i', $value)) {
            $clean[] = $value;
        }
    }
    return 'in.(' . implode(',', $clean) . ')';
}

function ew_acad_one(string $path, string $context): ?array
{
    $rows = ew_acad_rows($path . (str_contains($path, '?') ? '&' : '?') . 'limit=1', $context);
    return $rows[0] ?? null;
}

function ew_acad_require_teacher_assignment(int $assignmentId, string $teacherId): array
{
    if ($assignmentId <= 0) {
        ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Selecione a disciplina da turma.']);
    }
    $assignment = ew_acad_one(
        '/rest/v1/turma_disciplinas?select=id,turma_id,disciplina_id,professor_id&id=eq.' . $assignmentId . '&professor_id=eq.' . rawurlencode($teacherId),
        'a atribuição de turma e disciplina'
    );
    if (!$assignment) {
        ew_acad_json(403, ['sucesso' => false, 'mensagem' => 'Essa turma/disciplina não está atribuída ao seu usuário.']);
    }
    return $assignment;
}

function ew_acad_load_roster(int $classId): array
{
    $enrollments = ew_acad_rows(
        '/rest/v1/matriculas?select=id,aluno_id,turma_id,status&turma_id=eq.' . $classId . '&status=eq.ativa&order=id.asc',
        'os alunos matriculados'
    );
    if (!$enrollments) {
        return [];
    }
    $studentIds = array_values(array_unique(array_map(static fn($row) => (string) $row['aluno_id'], $enrollments)));
    $idFilter = ew_acad_in_filter($studentIds);
    $studentType = ew_acad_one('/rest/v1/tipos_usuario?select=id&codigo=eq.aluno', 'o tipo de usuário aluno');
    if (!$studentType) {
        throw new RuntimeException('O tipo de usuário aluno não foi encontrado.');
    }
    $users = ew_acad_rows(
        '/rest/v1/usuarios?select=id,nome_completo,tipo_usuario_id,ativo&id=' . $idFilter . '&tipo_usuario_id=eq.' . (int) $studentType['id'] . '&ativo=eq.true&order=nome_completo.asc',
        'os perfis dos alunos'
    );
    $userMap = [];
    foreach ($users as $user) {
        $userMap[(string) $user['id']] = $user;
    }
    $roster = [];
    foreach ($enrollments as $enrollment) {
        $student = $userMap[(string) $enrollment['aluno_id']] ?? null;
        if ($student) {
            $roster[] = [
                'matricula_id' => (int) $enrollment['id'],
                'aluno_id' => (string) $student['id'],
                'nome' => (string) $student['nome_completo'],
            ];
        }
    }
    usort($roster, static fn($a, $b) => strcasecmp($a['nome'], $b['nome']));
    return $roster;
}

function ew_acad_evaluation_for_teacher(int $evaluationId, string $teacherId): array
{
    $evaluation = ew_acad_one(
        '/rest/v1/avaliacoes?select=id,turma_disciplina_id,periodo_letivo_id,titulo,nota_maxima,status,criado_por&id=eq.' . $evaluationId,
        'a avaliação selecionada'
    );
    if (!$evaluation) {
        ew_acad_json(404, ['sucesso' => false, 'mensagem' => 'Avaliação não encontrada.']);
    }
    $assignment = ew_acad_require_teacher_assignment((int) $evaluation['turma_disciplina_id'], $teacherId);
    if (!in_array((string) $evaluation['status'], ['rascunho', 'publicada'], true)) {
        ew_acad_json(409, ['sucesso' => false, 'mensagem' => 'Esta avaliação está encerrada ou cancelada e não pode ser alterada.']);
    }
    return [$evaluation, $assignment];
}
