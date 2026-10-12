<?php
declare(strict_types=1);
require_once __DIR__ . '/../config.php';

eduwatch_iniciar_sessao();
eduwatch_exigir_metodo('POST');
eduwatch_validar_origem();

$config = eduwatch_config();
if (!empty($_SESSION['supabase']['access_token']) && $config['public_key'] !== '') {
    try {
        // Melhor esforço: revoga a sessão remota; a sessão PHP será encerrada mesmo se falhar.
        eduwatch_supabase_request(
            'POST',
            '/auth/v1/logout',
            $config['public_key'],
            null,
            (string) $_SESSION['supabase']['access_token']
        );
    } catch (Throwable $erro) {
        error_log('EduWatch remote logout warning: ' . $erro->getMessage());
    }
}

eduwatch_limpar_sessao();
eduwatch_json(200, ['sucesso' => true]);
