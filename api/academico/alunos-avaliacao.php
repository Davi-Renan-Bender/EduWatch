<?php
declare(strict_types=1);
require_once __DIR__ . '/comum.php';
eduwatch_exigir_metodo('GET');
$usuario = ew_acad_require_role(['professor']);
$evaluationId = filter_input(INPUT_GET, 'avaliacao_id', FILTER_VALIDATE_INT);
if (!$evaluationId) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Identificador de avaliação inválido.']);
try {
    [$evaluation, $assignment] = ew_acad_evaluation_for_teacher((int) $evaluationId, $usuario['id']);
    $class = ew_acad_one('/rest/v1/turmas?select=id,nome&id=eq.' . (int) $assignment['turma_id'], 'a turma da avaliação');
    $roster = ew_acad_load_roster((int) $assignment['turma_id']);
    $existing = ew_acad_rows('/rest/v1/notas?select=id,matricula_id,nota_obtida,situacao,feedback&avaliacao_id=eq.' . (int) $evaluationId, 'as notas já lançadas');
    $notesByEnrollment = [];
    foreach ($existing as $row) $notesByEnrollment[(int) $row['matricula_id']] = $row;
    foreach ($roster as &$student) {
        $note = $notesByEnrollment[$student['matricula_id']] ?? null;
        $student['nota'] = $note['nota_obtida'] ?? null;
        $student['situacao'] = (string) ($note['situacao'] ?? 'pendente');
        $student['feedback'] = $note['feedback'] ?? '';
    }
    unset($student);
    ew_acad_json(200, ['sucesso' => true, 'avaliacao' => $evaluation, 'turma' => $class['nome'] ?? '', 'alunos' => $roster]);
} catch (Throwable $error) {
    error_log('EduWatch assessment roster error: ' . $error->getMessage());
    ew_acad_json(500, ['sucesso' => false, 'mensagem' => $error instanceof RuntimeException ? $error->getMessage() : 'Não foi possível carregar os alunos.']);
}
