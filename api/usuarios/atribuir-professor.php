<?php
declare(strict_types=1);
require_once __DIR__ . '/atribuicoes-comum.php';

$config = ew_multi_require_gestao('POST');
$input = eduwatch_ler_json();
$professorId = strtolower(trim((string) ($input['professorId'] ?? '')));
$turmaId = filter_var($input['turmaId'] ?? null, FILTER_VALIDATE_INT);
$disciplinaId = filter_var($input['disciplinaId'] ?? null, FILTER_VALIDATE_INT);

if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $professorId)) {
    ew_multi_fail(422, ['sucesso' => false, 'mensagem' => 'Selecione um professor válido.']);
}
if ($turmaId === false || (int) $turmaId <= 0) {
    ew_multi_fail(422, ['sucesso' => false, 'mensagem' => 'Selecione uma turma válida.']);
}
if ($disciplinaId === false || (int) $disciplinaId <= 0) {
    ew_multi_fail(422, ['sucesso' => false, 'mensagem' => 'Selecione uma disciplina válida.']);
}
$turmaId = (int) $turmaId;
$disciplinaId = (int) $disciplinaId;

try {
    $tipoProfessor = ew_multi_rows(
        $config,
        '/rest/v1/tipos_usuario?select=id&codigo=eq.professor&limit=1',
        'o tipo de usuário professor'
    );
    if (empty($tipoProfessor[0]['id'])) {
        ew_multi_fail(500, ['sucesso' => false, 'mensagem' => 'O tipo de usuário professor não foi encontrado no banco.']);
    }
    $professores = ew_multi_rows(
        $config,
        '/rest/v1/usuarios?select=id&tipo_usuario_id=eq.' . (int) $tipoProfessor[0]['id'] . '&ativo=eq.true&id=eq.' . rawurlencode($professorId) . '&limit=1',
        'o professor selecionado'
    );
    if (empty($professores[0]['id'])) {
        ew_multi_fail(422, ['sucesso' => false, 'mensagem' => 'O professor selecionado não existe ou está inativo.']);
    }

    $turmas = ew_multi_rows(
        $config,
        '/rest/v1/turmas?select=id&status=eq.ativa&id=eq.' . $turmaId . '&limit=1',
        'a turma selecionada'
    );
    if (empty($turmas[0]['id'])) {
        ew_multi_fail(422, ['sucesso' => false, 'mensagem' => 'A turma selecionada não existe ou está inativa.']);
    }

    $disciplinas = ew_multi_rows(
        $config,
        '/rest/v1/disciplinas?select=id&ativo=eq.true&id=eq.' . $disciplinaId . '&limit=1',
        'a disciplina selecionada'
    );
    if (empty($disciplinas[0]['id'])) {
        ew_multi_fail(422, ['sucesso' => false, 'mensagem' => 'A disciplina selecionada não existe ou está inativa.']);
    }

    $existente = ew_multi_rows(
        $config,
        '/rest/v1/turma_disciplinas?select=id,professor_id&turma_id=eq.' . $turmaId . '&disciplina_id=eq.' . $disciplinaId . '&limit=1',
        'a atribuição da turma e disciplina'
    );
    if (!empty($existente[0]['id'])) {
        if (strtolower((string) $existente[0]['professor_id']) === $professorId) {
            ew_multi_fail(200, [
                'sucesso' => true,
                'jaExistia' => true,
                'mensagem' => 'Esse professor já está atribuído a essa turma e disciplina. Nenhuma alteração foi necessária.',
            ]);
        }
        $ocupanteId = (string) ($existente[0]['professor_id'] ?? '');
        $ocupante = ew_multi_rows(
            $config,
            '/rest/v1/usuarios?select=nome_completo&id=eq.' . rawurlencode($ocupanteId) . '&limit=1',
            'o professor atualmente responsável'
        );
        $nomeOcupante = (string) ($ocupante[0]['nome_completo'] ?? 'outro professor');
        ew_multi_fail(409, [
            'sucesso' => false,
            'mensagem' => 'Essa combinação de turma e disciplina já pertence a ' . $nomeOcupante . '. Nenhuma atribuição foi alterada. Escolha outra combinação.',
        ]);
    }

    $insert = eduwatch_supabase_request(
        'POST',
        '/rest/v1/turma_disciplinas',
        $config['secret_key'],
        [
            'professor_id' => $professorId,
            'turma_id' => $turmaId,
            'disciplina_id' => $disciplinaId,
        ]
    );
    $status = (int) ($insert['status'] ?? 0);
    if ($status < 200 || $status >= 300) {
        if ($status === 409) {
            ew_multi_fail(409, ['sucesso' => false, 'mensagem' => 'Outro cadastro ocupou essa combinação ao mesmo tempo. Atualize a lista e escolha outra combinação.']);
        }
        error_log('EduWatch teacher assignment insert failed; HTTP ' . $status);
        ew_multi_fail(502, ['sucesso' => false, 'mensagem' => 'Não foi possível salvar a atribuição. Verifique os dados e tente novamente.']);
    }

    ew_multi_fail(201, ['sucesso' => true, 'mensagem' => 'Atribuição adicionada. O professor pode receber outras combinações de turma e disciplina.']);
} catch (Throwable $error) {
    error_log('EduWatch teacher assignment write error: ' . get_class($error) . ': ' . $error->getMessage());
    ew_multi_fail(500, ['sucesso' => false, 'mensagem' => 'Ocorreu um erro ao atribuir o professor.']);
}
