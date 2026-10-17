<?php
declare(strict_types=1);
require_once __DIR__ . '/comum.php';
eduwatch_exigir_metodo('GET');
$usuario = ew_acad_require_role(['aluno']);
try {
    $enrollments = ew_acad_rows('/rest/v1/matriculas?select=id,turma_id&aluno_id=eq.' . rawurlencode($usuario['id']) . '&status=eq.ativa&order=id.asc', 'suas matrículas ativas');
    if (!$enrollments) ew_acad_json(200, ['sucesso' => true, 'notas' => []]);
    $enrollmentIds = array_map(static fn($r) => (int) $r['id'], $enrollments);
    $notes = ew_acad_rows('/rest/v1/notas?select=id,avaliacao_id,matricula_id,nota_obtida,situacao,feedback&matricula_id=' . ew_acad_in_filter($enrollmentIds) . '&order=id.desc', 'suas notas');
    if (!$notes) ew_acad_json(200, ['sucesso' => true, 'notas' => []]);
    $evaluationIds = array_values(array_unique(array_map(static fn($r) => (int) $r['avaliacao_id'], $notes)));
    $evaluations = ew_acad_rows('/rest/v1/avaliacoes?select=id,titulo,data_aplicacao,nota_maxima,peso,periodo_letivo_id,turma_disciplina_id,status&id=' . ew_acad_in_filter($evaluationIds) . '&status=eq.publicada', 'as avaliações publicadas');
    if (!$evaluations) ew_acad_json(200, ['sucesso' => true, 'notas' => []]);
    $evaluationMap = [];
    $assignmentIds = [];
    $periodIds = [];
    foreach ($evaluations as $r) {
        $evaluationMap[(int) $r['id']] = $r;
        $assignmentIds[] = (int) $r['turma_disciplina_id'];
        $periodIds[] = (int) $r['periodo_letivo_id'];
    }
    $assignments = ew_acad_rows('/rest/v1/turma_disciplinas?select=id,disciplina_id,turma_id&id=' . ew_acad_in_filter(array_values(array_unique($assignmentIds))), 'as disciplinas das avaliações');
    $assignmentMap = [];
    $disciplineIds = [];
    foreach ($assignments as $r) {
        $assignmentMap[(int) $r['id']] = $r;
        $disciplineIds[] = (int) $r['disciplina_id'];
    }
    $disciplines = $disciplineIds ? ew_acad_rows('/rest/v1/disciplinas?select=id,nome&id=' . ew_acad_in_filter(array_values(array_unique($disciplineIds))), 'as disciplinas') : [];
    $disciplineMap = [];
    foreach ($disciplines as $r) $disciplineMap[(int) $r['id']] = (string) $r['nome'];
    $periods = ew_acad_rows('/rest/v1/periodos_letivos?select=id,nome&id=' . ew_acad_in_filter(array_values(array_unique($periodIds))), 'os períodos das avaliações');
    $periodMap = [];
    foreach ($periods as $r) $periodMap[(int) $r['id']] = (string) $r['nome'];

    $result = [];
    foreach ($notes as $note) {
        $evaluation = $evaluationMap[(int) $note['avaliacao_id']] ?? null;
        if (!$evaluation) continue;
        $assignment = $assignmentMap[(int) $evaluation['turma_disciplina_id']] ?? [];
        $result[] = [
            'id' => (int) $note['id'],
            'avaliacao' => (string) $evaluation['titulo'],
            'data_aplicacao' => (string) $evaluation['data_aplicacao'],
            'nota_maxima' => (float) $evaluation['nota_maxima'],
            'peso' => (float) $evaluation['peso'],
            'nota_obtida' => $note['nota_obtida'] === null ? null : (float) $note['nota_obtida'],
            'situacao' => (string) $note['situacao'],
            'feedback' => (string) ($note['feedback'] ?? ''),
            'disciplina' => $disciplineMap[(int) ($assignment['disciplina_id'] ?? 0)] ?? 'Disciplina',
            'periodo' => $periodMap[(int) $evaluation['periodo_letivo_id']] ?? '',
        ];
    }
    usort($result, static fn($a, $b) => strcmp($b['data_aplicacao'], $a['data_aplicacao']));
    ew_acad_json(200, ['sucesso' => true, 'notas' => $result]);
} catch (Throwable $error) {
    error_log('EduWatch student grades error: ' . $error->getMessage());
    ew_acad_json(500, ['sucesso' => false, 'mensagem' => $error instanceof RuntimeException ? $error->getMessage() : 'Não foi possível carregar suas notas.']);
}
