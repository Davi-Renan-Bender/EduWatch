<?php
declare(strict_types=1);

/**
 * Configuração e funções compartilhadas do backend PHP do EduWatch.
 * Os segredos são lidos do arquivo .env na raiz do projeto ou do ambiente
 * do servidor. Nunca envie esses valores ao navegador.
 */

function eduwatch_carregar_env(string $caminho): void
{
    if (!is_file($caminho) || !is_readable($caminho)) {
        return;
    }

    $linhas = file($caminho, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($linhas === false) {
        return;
    }

    foreach ($linhas as $linha) {
        $linha = trim($linha);
        if ($linha === '' || str_starts_with($linha, '#') || !str_contains($linha, '=')) {
            continue;
        }

        [$nome, $valor] = explode('=', $linha, 2);
        $nome = trim($nome);
        $valor = trim($valor);

        if ($nome === '') {
            continue;
        }

        if (strlen($valor) >= 2) {
            $primeiro = $valor[0];
            $ultimo = $valor[strlen($valor) - 1];
            if (($primeiro === '"' && $ultimo === '"') || ($primeiro === "'" && $ultimo === "'")) {
                $valor = substr($valor, 1, -1);
            }
        }

        if (getenv($nome) === false) {
            putenv($nome . '=' . $valor);
            $_ENV[$nome] = $valor;
        }
    }
}

eduwatch_carregar_env(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

function eduwatch_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $url = rtrim((string) (getenv('SUPABASE_URL') ?: ''), '/');
    $publicKey = (string) (getenv('SUPABASE_PUBLISHABLE_KEY') ?: getenv('SUPABASE_ANON_KEY') ?: '');
    $secretKey = (string) (getenv('SUPABASE_SECRET_KEY') ?: getenv('SUPABASE_SERVICE_ROLE_KEY') ?: '');

    $config = [
        'url' => $url,
        'public_key' => $publicKey,
        'secret_key' => $secretKey,
    ];

    return $config;
}

function eduwatch_iniciar_sessao(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');

    $https = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && strtolower((string) $_SERVER['HTTPS']) !== 'off';

    session_name('EDUWATCHSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_start();
}

function eduwatch_json(int $status, array $dados): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function eduwatch_exigir_metodo(string $metodo): void
{
    if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== strtoupper($metodo)) {
        header('Allow: ' . strtoupper($metodo));
        eduwatch_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
    }
}

/** Bloqueia requisições de navegador com origem diferente da aplicação. */
function eduwatch_validar_origem(): void
{
    $origem = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origem === '') {
        return;
    }

    $partes = parse_url($origem);
    if (!is_array($partes) || empty($partes['host'])) {
        eduwatch_json(403, ['sucesso' => false, 'mensagem' => 'Origem não permitida.']);
    }

    $hostOrigem = strtolower($partes['host'] . (isset($partes['port']) ? ':' . $partes['port'] : ''));
    $hostRequisicao = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));

    if ($hostRequisicao !== '' && $hostOrigem !== $hostRequisicao) {
        eduwatch_json(403, ['sucesso' => false, 'mensagem' => 'Origem não permitida.']);
    }
}

function eduwatch_ler_json(): array
{
    $bruto = file_get_contents('php://input');
    if ($bruto === false || $bruto === '') {
        return [];
    }

    $dados = json_decode($bruto, true);
    return is_array($dados) ? $dados : [];
}

/** Faz uma requisição HTTP à API do Supabase e devolve status + JSON. */
function eduwatch_supabase_request(
    string $metodo,
    string $caminho,
    string $apiKey,
    ?array $corpo = null,
    ?string $tokenUsuario = null
): array {
    $config = eduwatch_config();
    if ($config['url'] === '' || $apiKey === '') {
        throw new RuntimeException('Configuração do Supabase ausente.');
    }

    if (!function_exists('curl_init')) {
        throw new RuntimeException('A extensão cURL do PHP não está habilitada.');
    }

    $url = $config['url'] . $caminho;
    $headers = [
        'apikey: ' . $apiKey,
        'Accept: application/json',
    ];

    if ($tokenUsuario !== null && $tokenUsuario !== '') {
        // Para consultas em nome do usuário, Authorization deve conter o JWT da sessão.
        $headers[] = 'Authorization: Bearer ' . $tokenUsuario;
    } elseif ($apiKey !== ''
        && !str_starts_with($apiKey, 'sb_publishable_')
        && !str_starts_with($apiKey, 'sb_secret_')) {
        // Chaves legadas anon/service_role são JWTs e usam Authorization.
        // As chaves novas sb_publishable_ e sb_secret_ não são JWTs: envie-as
        // somente no cabeçalho apikey, conforme a documentação atual do Supabase.
        $headers[] = 'Authorization: Bearer ' . $apiKey;
    }

    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($metodo),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    if ($corpo !== null) {
        $json = json_encode($corpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $headers[] = 'Content-Type: application/json';
        curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($curl, CURLOPT_POSTFIELDS, $json);
    }

    $resposta = curl_exec($curl);
    $erroCurl = curl_error($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    if ($resposta === false) {
        error_log('EduWatch Supabase request failed: ' . $erroCurl);
        throw new RuntimeException('Não foi possível conectar ao Supabase.');
    }

    $dados = json_decode((string) $resposta, true);
    return [
        'status' => $status,
        'dados' => $dados,
        'texto' => (string) $resposta,
    ];
}

function eduwatch_limpar_sessao(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'] ?: '/',
            'domain' => $params['domain'] ?? '',
            'secure' => (bool) ($params['secure'] ?? false),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

function eduwatch_renovar_token_se_necessario(): bool
{
    if (empty($_SESSION['supabase']['access_token']) || empty($_SESSION['supabase']['refresh_token'])) {
        return false;
    }

    if ((int) ($_SESSION['supabase']['expira_em'] ?? 0) > time() + 60) {
        return true;
    }

    $config = eduwatch_config();
    try {
        $resposta = eduwatch_supabase_request(
            'POST',
            '/auth/v1/token?grant_type=refresh_token',
            $config['public_key'],
            ['refresh_token' => $_SESSION['supabase']['refresh_token']]
        );
    } catch (Throwable $erro) {
        error_log('EduWatch refresh failed: ' . $erro->getMessage());
        return false;
    }

    $dados = $resposta['dados'];
    if ($resposta['status'] < 200 || $resposta['status'] >= 300 || !is_array($dados) || empty($dados['access_token']) || empty($dados['refresh_token'])) {
        return false;
    }

    $_SESSION['supabase']['access_token'] = $dados['access_token'];
    $_SESSION['supabase']['refresh_token'] = $dados['refresh_token'];
    $_SESSION['supabase']['expira_em'] = time() + (int) ($dados['expires_in'] ?? 3600);
    return true;
}

function eduwatch_nivel_frontend(string $codigo): string
{
    return $codigo === 'administrador' ? 'admin' : $codigo;
}
