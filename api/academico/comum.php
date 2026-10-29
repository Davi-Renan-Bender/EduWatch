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
    static $persistentCurl = null;

    $config = eduwatch_config();
    if (empty($config['url']) || empty($config['secret_key'])) {
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
        $headers[] = 'Authorization: Bearer ' . $config['secret_key'];
    }
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    if ($prefer !== null && $prefer !== '') {
        $headers[] = 'Prefer: ' . $prefer;
    }

    if ($persistentCurl === null) {
        $persistentCurl = curl_init();
        curl_setopt_array($persistentCurl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERAGENT => 'EduWatch-Backend/1.0',
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_TCP_KEEPALIVE => 1,
            CURLOPT_TCP_KEEPIDLE => 120,
            CURLOPT_TCP_KEEPINTVL => 60,
        ]);
        eduwatch_configurar_curl_ssl($persistentCurl);
    }

    curl_setopt($persistentCurl, CURLOPT_URL, $config['url'] . $path);
    curl_setopt($persistentCurl, CURLOPT_CUSTOMREQUEST, strtoupper($method));
    curl_setopt($persistentCurl, CURLOPT_HTTPHEADER, $headers);

    if ($body !== null) {
        $encoded = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            throw new RuntimeException('Não foi possível preparar a consulta.');
        }
        curl_setopt($persistentCurl, CURLOPT_POSTFIELDS, $encoded);
    } else {
        curl_setopt($persistentCurl, CURLOPT_POSTFIELDS, null);
    }

    $responseHeaders = [];
    curl_setopt($persistentCurl, CURLOPT_HEADERFUNCTION, static function ($ch, $headerLine) use (&$responseHeaders): int {
        $len = strlen($headerLine);
        $parts = explode(':', $headerLine, 2);
        if (count($parts) === 2) {
            $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
        }
        return $len;
    });

    $raw = curl_exec($persistentCurl);
    curl_setopt($persistentCurl, CURLOPT_HEADERFUNCTION, null);
    $curlError = curl_error($persistentCurl);
    $status = (int) curl_getinfo($persistentCurl, CURLINFO_HTTP_CODE);

    if ($raw === false) {
        error_log('EduWatch academic Supabase connection failed: ' . $curlError);
        curl_close($persistentCurl);
        $persistentCurl = null;
        throw new RuntimeException('Não foi possível conectar ao banco de dados.');
    }
    $decoded = json_decode((string) $raw, true);
    return ['status' => $status, 'data' => $decoded, 'raw' => (string) $raw, 'headers' => $responseHeaders];
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

    $agora = time();
    $validadoEm = (int) ($_SESSION['usuario']['validado_em'] ?? 0);
    $cacheValido = ($agora - $validadoEm < 300)
        && !empty($_SESSION['usuario']['tipoUsuario'])
        && !empty($_SESSION['usuario']['tipoUsuarioId']);

    if ($cacheValido) {
        $role = (string) $_SESSION['usuario']['tipoUsuario'];
        $tipoUsuarioId = (int) $_SESSION['usuario']['tipoUsuarioId'];
    } else {
        try {
            $profile = ew_acad_one(
                '/rest/v1/usuarios?select=id,ativo,tipo_usuario_id,tipos_usuario(id,codigo)&id=eq.' . rawurlencode($id),
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
            $tipoObj = $profile['tipos_usuario'] ?? [];
            $role = (string) ($tipoObj['codigo'] ?? '');

            if ($role === '') {
                eduwatch_limpar_sessao();
                ew_acad_json(401, [
                    'sucesso' => false,
                    'mensagem' => 'Não foi possível validar seu perfil. Entre novamente.',
                ]);
            }

            $_SESSION['usuario']['tipoUsuario'] = $role;
            $_SESSION['usuario']['tipoUsuarioId'] = $tipoUsuarioId;
            $_SESSION['usuario']['nivel'] = eduwatch_nivel_frontend($role);
            $_SESSION['usuario']['validado_em'] = $agora;
        } catch (Throwable $error) {
            error_log('EduWatch academic authorization lookup failed: ' . get_class($error));
            ew_acad_json(503, [
                'sucesso' => false,
                'mensagem' => 'Não foi possível validar sua permissão agora. Tente novamente.',
            ]);
        }
    }

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

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
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
        foreach (explode('&', $queryString) as $pair) {
            if ($pair === '') continue;
            $eq = strpos($pair, '=');
            if ($eq === false) {
                $params[urldecode($pair)] = '';
            } else {
                $params[urldecode(substr($pair, 0, $eq))] = urldecode(substr($pair, $eq + 1));
            }
        }
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

    // Consultas pequenas continuam sendo feitas normalmente em conexão persistente.
    if ($requestedLimit !== null && $requestedLimit <= $pageSize) {
        return $fetch($path);
    }

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

    // Busca a 1ª página solicitando contagem exata no cabeçalho (count=exact)
    $page1Params = $params;
    $page1Params['limit'] = min($pageSize, $maxRows);
    $page1Params['offset'] = $initialOffset;
    $page1Path = $basePath . '?' . http_build_query($page1Params, '', '&', PHP_QUERY_RFC3986);

    $page1Response = ew_acad_db('GET', $page1Path, null, 'count=exact');
    if ($page1Response['status'] < 200 || $page1Response['status'] >= 300 || !is_array($page1Response['data'])) {
        return $fetch($page1Path);
    }

    $page1Data = $page1Response['data'];
    $count1 = count($page1Data);
    if ($count1 < $pageSize || $maxRows <= $pageSize) {
        return $page1Data;
    }

    $totalDb = null;
    $crHeader = (string) ($page1Response['headers']['content-range'] ?? '');
    if (preg_match('/content-range:\s*\d+-\d+\/(\d+)/i', $crHeader, $m)) {
        $totalDb = (int) $m[1];
    }

    $maxToFetch = ($totalDb !== null) ? min($totalDb - $initialOffset, $maxRows) : $maxRows;
    if ($count1 >= $maxToFetch) {
        return $page1Data;
    }

    $offsets = [];
    for ($off = $initialOffset + $count1; $off < $initialOffset + $maxToFetch; $off += $pageSize) {
        $offsets[] = $off;
    }

    if (empty($offsets)) {
        return $page1Data;
    }

    // Busca as páginas restantes em paralelo usando curl_multi (até 8 conexões concorrentes)
    $config = eduwatch_config();
    $headers = [
        'apikey: ' . $config['secret_key'],
        'User-Agent: EduWatch-Backend/1.0',
        'Accept: application/json',
    ];
    if (!str_starts_with($config['secret_key'], 'sb_secret_')) {
        $headers[] = 'Authorization: Bearer ' . $config['secret_key'];
    }

    $mh = curl_multi_init();
    $runningHandles = [];
    $pagesByOffset = [$initialOffset => $page1Data];
    $offsetIdx = 0;
    $concurrency = 8;

    $addHandle = static function (int $offset) use ($mh, $config, $basePath, $params, $pageSize, $headers, &$runningHandles): void {
        $p = $params;
        $p['limit'] = $pageSize;
        $p['offset'] = $offset;
        $url = $config['url'] . $basePath . '?' . http_build_query($p, '', '&', PHP_QUERY_RFC3986);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_USERAGENT => 'EduWatch-Backend/1.0',
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_TCP_KEEPALIVE => 1,
        ]);
        eduwatch_configurar_curl_ssl($ch);
        curl_multi_add_handle($mh, $ch);
        $key = (int) $ch;
        $runningHandles[$key] = ['ch' => $ch, 'offset' => $offset];
    };

    while ($offsetIdx < count($offsets) && count($runningHandles) < $concurrency) {
        $addHandle($offsets[$offsetIdx++]);
    }

    $running = null;
    do {
        curl_multi_exec($mh, $running);
        while ($info = curl_multi_info_read($mh)) {
            $ch = $info['handle'];
            $key = (int) $ch;
            $offset = $runningHandles[$key]['offset'];
            $raw = curl_multi_getcontent($ch);
            $pageData = json_decode((string) $raw, true);
            if (is_array($pageData)) {
                $pagesByOffset[$offset] = $pageData;
            }
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
            unset($runningHandles[$key]);

            if ($offsetIdx < count($offsets)) {
                $addHandle($offsets[$offsetIdx++]);
            }
        }
        if ($running > 0) {
            curl_multi_select($mh, 0.05);
        }
    } while ($running > 0 || !empty($runningHandles));

    curl_multi_close($mh);

    ksort($pagesByOffset);
    return array_merge(...array_values($pagesByOffset));
}

function ew_acad_cache_dir(): string
{
    $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'eduwatch_cache';
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    return $dir;
}

function ew_acad_obter_cache(string $chave, int $ttlSegundos = 60): ?array
{
    $file = ew_acad_cache_dir() . DIRECTORY_SEPARATOR . preg_replace('/[^a-zA-Z0-9_-]/', '_', $chave) . '.json';
    if (!file_exists($file)) {
        return null;
    }
    $mtime = filemtime($file);
    if ($mtime === false || (time() - $mtime) > $ttlSegundos) {
        return null;
    }
    $raw = @file_get_contents($file);
    if ($raw === false || $raw === '') {
        return null;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function ew_acad_salvar_cache(string $chave, array $dados): void
{
    $file = ew_acad_cache_dir() . DIRECTORY_SEPARATOR . preg_replace('/[^a-zA-Z0-9_-]/', '_', $chave) . '.json';
    $encoded = json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded !== false) {
        @file_put_contents($file, $encoded, LOCK_EX);
    }
}

function ew_acad_invalidar_cache(): void
{
    $dir = ew_acad_cache_dir();
    if (is_dir($dir)) {
        $files = glob($dir . DIRECTORY_SEPARATOR . '*.json');
        if ($files) {
            foreach ($files as $file) {
                @unlink($file);
            }
        }
    }
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
