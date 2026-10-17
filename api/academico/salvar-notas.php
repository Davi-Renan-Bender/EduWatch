<?php
declare(strict_types=1);
require_once __DIR__ . '/comum.php';
eduwatch_exigir_metodo('POST');
eduwatch_validar_origem();
$usuario = ew_acad_require_role(['professor']);
$input = eduwatch_ler_json();
$evaluationId = filter_var($input['avaliacao_id'] ?? null, FILTER_VALIDATE_INT);
$submitted = $input['notas'] ?? null;
if (!$evaluationId || !is_array($submitted) || count($submitted) < 1 || count($submitted) > 500) {
    ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Não há notas válidas para salvar.']);
}
try {
    [$evaluation, $assignment] = ew_acad_evaluation_for_teacher((int) $evaluationId, $usuario['id']);
    $max = (float) $evaluation['nota_maxima'];
    $roster = ew_acad_load_roster((int) $assignment['turma_id']);
    $validEnrollmentIds = array_fill_keys(array_map(static fn($row) => (int) $row['matricula_id'], $roster), true);
    $seen = [];
    $rows = [];
    foreach ($submitted as $item) {
        if (!is_array($item)) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Formato de nota inválido.']);
        $enrollmentId = filter_var($item['matricula_id'] ?? null, FILTER_VALIDATE_INT);
        if (!$enrollmentId || !isset($validEnrollmentIds[(int) $enrollmentId]) || isset($seen[(int) $enrollmentId])) {
            ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Um aluno não pertence à turma desta avaliação ou foi enviado duas vezes.']);
        }
        $seen[(int) $enrollmentId] = true;
        $status = (string) ($item['situacao'] ?? 'pendente');
        if (!in_array($status, ['pendente', 'lancada', 'ausente', 'dispensada'], true)) {
            ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Situação de nota inválida.']);
        }
        $rawGrade = $item['nota_obtida'] ?? null;
        $grade = null;
        if ($rawGrade !== null && $rawGrade !== '') {
            if (!is_numeric($rawGrade)) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Uma das notas não é numérica.']);
            $grade = (float) $rawGrade;
            if (!is_finite($grade) || $grade < 0 || $grade > $max) {
                ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'As notas devem ficar entre zero e ' . rtrim(rtrim(number_format($max, 2, '.', ''), '0'), '.') . '.']);
            }
            $status = 'lancada';
        } elseif ($status === 'lancada') {
            ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Informe uma nota ou marque o aluno como ausente, dispensado ou pendente.']);
        }
        if ($status !== 'lancada') $grade = null;
        $feedback = trim((string) ($item['feedback'] ?? ''));
        $rows[] = [
            'avaliacao_id' => (int) $evaluationId,
            'matricula_id' => (int) $enrollmentId,
            'nota_obtida' => $grade,
            'situacao' => $status,
            'feedback' => $feedback !== '' ? $feedback : null,
            'registrado_por' => $usuario['id'],
        ];
    }

    ew_acad_write(
        'POST',
        '/rest/v1/notas?on_conflict=avaliacao_id,matricula_id',
        $rows,
        'as notas dos alunos',
        'resolution=merge-duplicates,return=representation'
    );
    // A avaliação só fica visível aos alunos depois de o professor salvar as notas.
    if ((string) $evaluation['status'] === 'rascunho') {
        ew_acad_write(
            'PATCH',
            '/rest/v1/avaliacoes?id=eq.' . (int) $evaluationId . '&status=eq.rascunho',
            ['status' => 'publicada'],
            'a publicação da avaliação',
            'return=minimal'
        );
    }
    ew_acad_json(200, ['sucesso' => true, 'mensagem' => 'Notas salvas. A avaliação está publicada para consulta dos alunos.', 'quantidade' => count($rows)]);
} catch (Throwable $error) {
    error_log('EduWatch save grades error: ' . $error->getMessage());
    ew_acad_json(500, ['sucesso' => false, 'mensagem' => $error instanceof RuntimeException ? $error->getMessage() : 'Não foi possível salvar as notas.']);
}
