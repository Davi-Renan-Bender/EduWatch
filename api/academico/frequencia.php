<?php
declare(strict_types=1);
require_once __DIR__ . '/comum.php';

$metodo = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($metodo, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    ew_acad_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}
if ($metodo === 'POST') eduwatch_validar_origem();
$usuario = ew_acad_require_role(['professor']);

function ew_freq_aula_professor(int $aulaId, string $professorId): array {
    if ($aulaId <= 0) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Selecione uma aula.']);
    $aula = ew_acad_one('/rest/v1/aulas?select=id,turma_disciplina_id,periodo_letivo_id,data_aula,tema,status,frequencia_fechada&id=eq.' . $aulaId, 'a aula selecionada');
    if (!$aula) ew_acad_json(404, ['sucesso' => false, 'mensagem' => 'Aula não encontrada.']);
    ew_acad_require_teacher_assignment((int) $aula['turma_disciplina_id'], $professorId);
    if (($aula['status'] ?? '') === 'cancelada') ew_acad_json(409, ['sucesso' => false, 'mensagem' => 'Esta aula foi cancelada.']);
    return $aula;
}

try {
    if ($metodo === 'GET') {
        $atribuicoes = ew_acad_rows('/rest/v1/turma_disciplinas?select=id,turma_id,disciplina_id,professor_id&professor_id=eq.' . rawurlencode($usuario['id']) . '&order=id.asc', 'as turmas e disciplinas do professor');
        $turmaIds = array_values(array_unique(array_map(static fn($r) => (int) $r['turma_id'], $atribuicoes)));
        $disciplinaIds = array_values(array_unique(array_map(static fn($r) => (int) $r['disciplina_id'], $atribuicoes)));
        $turmas = $turmaIds ? ew_acad_rows('/rest/v1/turmas?select=id,nome,ano_letivo_id,status&id=' . ew_acad_in_filter($turmaIds) . '&status=eq.ativa&order=nome.asc', 'as turmas ativas') : [];
        $disciplinas = $disciplinaIds ? ew_acad_rows('/rest/v1/disciplinas?select=id,nome,ativo&id=' . ew_acad_in_filter($disciplinaIds) . '&ativo=eq.true&order=nome.asc', 'as disciplinas ativas') : [];
        $periodos = ew_acad_rows('/rest/v1/periodos_letivos?select=id,nome,ordem,ano_letivo_id,data_inicio,data_fim&order=ordem.asc', 'os períodos letivos');
        $turmaMap = []; foreach ($turmas as $t) $turmaMap[(int)$t['id']] = $t;
        $discMap = []; foreach ($disciplinas as $d) $discMap[(int)$d['id']] = $d;
        $opcoes = [];
        foreach ($atribuicoes as $a) {
            $t = $turmaMap[(int)$a['turma_id']] ?? null; $d = $discMap[(int)$a['disciplina_id']] ?? null;
            if (!$t || !$d) continue;
            $opcoes[] = ['id'=>(int)$a['id'], 'turma_id'=>(int)$t['id'], 'turma'=>(string)$t['nome'], 'ano_letivo_id'=>(int)$t['ano_letivo_id'], 'disciplina'=>(string)$d['nome']];
        }
        $assignmentId = filter_var($_GET['turma_disciplina_id'] ?? null, FILTER_VALIDATE_INT) ?: 0;
        $periodId = filter_var($_GET['periodo_letivo_id'] ?? null, FILTER_VALIDATE_INT) ?: 0;
        $out = ['sucesso'=>true, 'atribuicoes'=>$opcoes, 'periodos'=>array_map(static fn($p)=>['id'=>(int)$p['id'],'nome'=>(string)$p['nome'],'ano_letivo_id'=>(int)$p['ano_letivo_id'],'data_inicio'=>(string)$p['data_inicio'],'data_fim'=>(string)$p['data_fim']], $periodos)];
        if ($assignmentId && $periodId) {
            ew_acad_require_teacher_assignment($assignmentId, $usuario['id']);
            $aulaRows = ew_acad_rows('/rest/v1/aulas?select=id,turma_disciplina_id,periodo_letivo_id,data_aula,tema,status,frequencia_fechada&turma_disciplina_id=eq.' . $assignmentId . '&periodo_letivo_id=eq.' . $periodId . '&order=data_aula.desc,id.desc', 'as aulas do período');
            $out['aulas'] = array_map(static fn($a)=>['id'=>(int)$a['id'],'data_aula'=>(string)$a['data_aula'],'tema'=>(string)($a['tema'] ?? ''),'status'=>(string)$a['status'],'frequencia_fechada'=>(bool)$a['frequencia_fechada']], $aulaRows);
        }
        $lessonId = filter_var($_GET['aula_id'] ?? null, FILTER_VALIDATE_INT) ?: 0;
        if ($lessonId) {
            $aula = ew_freq_aula_professor($lessonId, $usuario['id']);
            $roster = ew_acad_load_roster((int) (ew_acad_one('/rest/v1/turma_disciplinas?select=id,turma_id&id=eq.' . (int)$aula['turma_disciplina_id'], 'a atribuição da aula')['turma_id'] ?? 0));
            $freqRows = ew_acad_rows('/rest/v1/frequencias?select=id,aula_id,matricula_id,status,observacao&aula_id=eq.' . $lessonId . '&order=id.asc', 'a chamada existente');
            $freqByEnrollment = []; foreach ($freqRows as $f) $freqByEnrollment[(int)$f['matricula_id']] = $f;
            foreach ($roster as &$student) { $f = $freqByEnrollment[(int)$student['matricula_id']] ?? null; $student['status'] = $f['status'] ?? 'presente'; $student['observacao'] = (string)($f['observacao'] ?? ''); }
            unset($student);
            $out['aula'] = ['id'=>(int)$aula['id'],'data_aula'=>(string)$aula['data_aula'],'tema'=>(string)($aula['tema'] ?? ''),'status'=>(string)$aula['status'],'frequencia_fechada'=>(bool)$aula['frequencia_fechada']];
            $out['alunos'] = $roster;
        }
        ew_acad_json(200, $out);
    }

    $input = eduwatch_ler_json();
    $acao = (string)($input['acao'] ?? '');
    if ($acao === 'criar_aula') {
        $assignmentId = filter_var($input['turma_disciplina_id'] ?? null, FILTER_VALIDATE_INT);
        $periodId = filter_var($input['periodo_letivo_id'] ?? null, FILTER_VALIDATE_INT);
        $data = trim((string)($input['data_aula'] ?? ''));
        $tema = trim((string)($input['tema'] ?? ''));
        if (!$assignmentId || !$periodId || $data === '' || strlen($tema) > 180) ew_acad_json(422, ['sucesso'=>false,'mensagem'=>'Informe turma/disciplina, período e data. O tema deve ter até 180 caracteres.']);
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $data);
        if (!$date || $date->format('Y-m-d') !== $data) ew_acad_json(422, ['sucesso'=>false,'mensagem'=>'Informe uma data válida.']);
        $assignment = ew_acad_require_teacher_assignment((int)$assignmentId, $usuario['id']);
        $class = ew_acad_one('/rest/v1/turmas?select=id,ano_letivo_id,status&id=eq.' . (int)$assignment['turma_id'], 'a turma selecionada');
        $period = ew_acad_one('/rest/v1/periodos_letivos?select=id,ano_letivo_id,data_inicio,data_fim&id=eq.' . (int)$periodId, 'o período letivo');
        if (!$class || ($class['status'] ?? '') !== 'ativa' || !$period || (int)$class['ano_letivo_id'] !== (int)$period['ano_letivo_id']) ew_acad_json(422, ['sucesso'=>false,'mensagem'=>'A turma e o período letivo não correspondem.']);
        if ($data < $period['data_inicio'] || $data > $period['data_fim']) ew_acad_json(422, ['sucesso'=>false,'mensagem'=>'A data da aula precisa estar dentro do período letivo.']);
        $created = ew_acad_write('POST', '/rest/v1/aulas?select=id,turma_disciplina_id,periodo_letivo_id,data_aula,tema,status,frequencia_fechada', ['turma_disciplina_id'=>(int)$assignmentId,'periodo_letivo_id'=>(int)$periodId,'data_aula'=>$data,'tema'=>$tema !== '' ? $tema : null,'status'=>'planejada','frequencia_fechada'=>false,'criado_por'=>$usuario['id']], 'a aula');
        if (empty($created[0]['id'])) throw new RuntimeException('O banco não retornou a aula criada.');
        ew_acad_json(201, ['sucesso'=>true,'mensagem'=>'Aula criada.','aula'=>$created[0]]);
    }
    $lessonId = filter_var($input['aula_id'] ?? null, FILTER_VALIDATE_INT);
    $aula = ew_freq_aula_professor((int)$lessonId, $usuario['id']);
    if (($aula['frequencia_fechada'] ?? false) === true) ew_acad_json(409, ['sucesso'=>false,'mensagem'=>'A chamada desta aula já foi fechada e não pode ser alterada.']);
    $assignment = ew_acad_one('/rest/v1/turma_disciplinas?select=id,turma_id&id=eq.' . (int)$aula['turma_disciplina_id'], 'a atribuição da aula');
    $roster = ew_acad_load_roster((int)($assignment['turma_id'] ?? 0));
    $valid = []; foreach ($roster as $s) $valid[(int)$s['matricula_id']] = true;

    if ($acao === 'salvar_chamada') {
        $submitted = $input['frequencias'] ?? null;
        if (!is_array($submitted) || count($submitted) !== count($roster) || !$roster) ew_acad_json(422, ['sucesso'=>false,'mensagem'=>'A chamada precisa conter todos os alunos ativos da turma.']);
        $rows = []; $seen = [];
        foreach ($submitted as $item) {
            if (!is_array($item)) ew_acad_json(422, ['sucesso'=>false,'mensagem'=>'Formato de frequência inválido.']);
            $enrollmentId = filter_var($item['matricula_id'] ?? null, FILTER_VALIDATE_INT);
            $status = (string)($item['status'] ?? '');
            if (!$enrollmentId || !isset($valid[(int)$enrollmentId]) || isset($seen[(int)$enrollmentId]) || !in_array($status, ['presente','ausente','atraso','justificada'], true)) ew_acad_json(422, ['sucesso'=>false,'mensagem'=>'Há um aluno ou status inválido na chamada.']);
            $seen[(int)$enrollmentId] = true;
            $obs = trim((string)($item['observacao'] ?? ''));
            $rows[] = ['aula_id'=>(int)$lessonId,'matricula_id'=>(int)$enrollmentId,'status'=>$status,'observacao'=>$obs !== '' ? (function_exists('mb_substr') ? mb_substr($obs, 0, 500) : substr($obs, 0, 500)) : null,'registrado_por'=>$usuario['id']];
        }
        ew_acad_write('POST', '/rest/v1/frequencias?on_conflict=aula_id,matricula_id', $rows, 'a chamada', 'resolution=merge-duplicates,return=representation');
        ew_acad_json(200, ['sucesso'=>true,'mensagem'=>'Chamada salva. Você ainda pode revisar os registros antes de fechar a frequência.','quantidade'=>count($rows)]);
    }
    if ($acao === 'fechar_chamada') {
        $existing = ew_acad_rows('/rest/v1/frequencias?select=id,matricula_id&aula_id=eq.' . (int)$lessonId, 'os registros da chamada');
        $ids = array_unique(array_map(static fn($f)=>(int)$f['matricula_id'], $existing));
        if (!$roster || count($ids) !== count($roster) || count(array_intersect(array_keys($valid), $ids)) !== count($roster)) ew_acad_json(409, ['sucesso'=>false,'mensagem'=>'Salve a chamada completa antes de fechar a frequência.']);
        ew_acad_write('PATCH', '/rest/v1/aulas?id=eq.' . (int)$lessonId, ['status'=>'realizada','frequencia_fechada'=>true], 'o fechamento da frequência', 'return=minimal');
        ew_acad_json(200, ['sucesso'=>true,'mensagem'=>'Frequência fechada. A aula foi marcada como realizada.']);
    }
    ew_acad_json(422, ['sucesso'=>false,'mensagem'=>'Ação de frequência desconhecida.']);
} catch (Throwable $error) {
    error_log('EduWatch attendance API error: ' . $error->getMessage());
    ew_acad_json(500, ['sucesso'=>false,'mensagem'=>$error instanceof RuntimeException ? $error->getMessage() : 'Não foi possível processar a frequência.']);
}
