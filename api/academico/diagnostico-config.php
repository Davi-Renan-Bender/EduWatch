<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

$config = eduwatch_config();
$caminhoEnv = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env';

$chaveSecreta = (string) ($config['secret_key'] ?? '');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

echo json_encode([
    'arquivo_env_encontrado' => is_file($caminhoEnv),
    'arquivo_env_legivel' => is_readable($caminhoEnv),
    'url_carregada' => !empty($config['url']),
    'chave_publica_carregada' => !empty($config['public_key']),
    'chave_secreta_carregada' => $chaveSecreta !== '',
    'tipo_chave_secreta' => $chaveSecreta === ''
        ? 'ausente'
        : (str_starts_with($chaveSecreta, 'sb_secret_')
            ? 'sb_secret'
            : 'outra'),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);