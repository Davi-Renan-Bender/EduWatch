<?php
declare(strict_types=1);
require_once __DIR__ . '/comum.php';
eduwatch_exigir_metodo('POST');
eduwatch_validar_origem();
$usuario = ew_acad_require_role(['professor']);
$input = eduwatch_ler_json();
$assignmentId = filter_var($input['turma_disciplina_id'] ?? null, FILTER_VALIDATE_INT);
$turmaId = filter_var($input['turma_id'] ?? null, FILTER_VALIDATE_INT);
$periodoId = filter_var($input['periodo_letivo_id'] ?? null, FILTER_VALIDATE_INT);
$titulo = trim((string) ($input['titulo'] ?? ''));
$data = trim((string) ($input['data_aplicacao'] ?? ''));
$notaMaxima = $input['nota_maxima'] ?? null;

if (!$assignmentId || !$turmaId || !$periodoId || $titulo === '' || (function_exists('mb_strlen') ? mb_strlen($titulo) : strlen($titulo)) > 120 || !is_numeric($notaMaxima) || (float) $notaMaxima <= 0) {
    ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Preencha turma, disciplina, período, título, data e nota máxima corretamente.']);
}
$dateObj = DateTimeImmutable::createFromFormat('!Y-m-d', $data);
if (!$dateObj || $dateObj->format('Y-m-d') !== $data) {
    ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Informe uma data de avaliação válida.']);
}

try {
    $assignment = ew_acad_require_teacher_assignment((int) $assignmentId, $usuario['id']);
    if ((int) $assignment['turma_id'] !== (int) $turmaId) {
        ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'A disciplina selecionada não corresponde à turma.']);
    }
    $class = ew_acad_one('/rest/v1/turmas?select=id,ano_letivo_id,status&id=eq.' . (int) $turmaId, 'a turma selecionada');
    $period = ew_acad_one('/rest/v1/periodos_letivos?select=id,ano_letivo_id,data_inicio,data_fim&id=eq.' . (int) $periodoId, 'o período selecionado');
    if (!$class || !$period || ($class['status'] ?? '') !== 'ativa') {
        ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Turma ou período letivo indisponível.']);
    }
    if ((int) $class['ano_letivo_id'] !== (int) $period['ano_letivo_id']) {
        ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'O período selecionado não pertence ao ano letivo desta turma.']);
    }
    if ($data < (string) $period['data_inicio'] || $data > (string) $period['data_fim']) {
        ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'A data da avaliação precisa estar dentro do período letivo selecionado.']);
    }
    $payload = [
        'turma_disciplina_id' => (int) $assignmentId,
        'periodo_letivo_id' => (int) $periodoId,
        'titulo' => $titulo,
        'descricao' => null,
        'tipo' => 'prova',
        'data_aplicacao' => $data,
        'nota_maxima' => (float) $notaMaxima,
        'peso' => 1,
        'modo_correcao' => 'nota_total',
        'status' => 'rascunho',
        'criado_por' => $usuario['id'],
    ];
    $created = ew_acad_write('POST', '/rest/v1/avaliacoes?select=id,titulo,data_aplicacao,nota_maxima,status,turma_disciplina_id,periodo_letivo_id', $payload, 'a avaliação');
    if (!isset($created[0]['id'])) {
        throw new RuntimeException('O banco não retornou o identificador da avaliação criada.');
    }
    ew_acad_json(201, ['sucesso' => true, 'mensagem' => 'Avaliação criada. Agora você pode lançar as notas.', 'avaliacao' => $created[0]]);
} catch (Throwable $error) {
    error_log('EduWatch create assessment error: ' . $error->getMessage());
    ew_acad_json(500, ['sucesso' => false, 'mensagem' => $error instanceof RuntimeException ? $error->getMessage() : 'Não foi possível criar a avaliação.']);
}
