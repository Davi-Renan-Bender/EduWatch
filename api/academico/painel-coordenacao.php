<?php
declare(strict_types=1);

require_once __DIR__ . '/comum.php';

eduwatch_exigir_metodo('GET');
$usuario = ew_acad_require_role(['coordenacao', 'administrador']);

function ew_coord_media(array $notas): ?float
{
    $soma = 0.0;
    $pesos = 0.0;
    foreach ($notas as $nota) {
        $obtida = $nota['nota_obtida'] ?? null;
        $maxima = (float) ($nota['nota_maxima'] ?? 0);
        $peso = (float) ($nota['peso'] ?? 1);
        if ($obtida === null || $maxima <= 0 || $peso <= 0) continue;
        $soma += ((float) $obtida / $maxima * 10) * $peso;
        $pesos += $peso;
    }
    return $pesos > 0 ? round($soma / $pesos, 2) : null;
}

function ew_coord_situacao(?float $media): string
{
    if ($media === null) return 'sem_dados';
    if ($media >= 7.0) return 'normal';
    if ($media >= 5.0) return 'atencao';
    return 'critico';
}

try {
    // Dados institucionais são consultados apenas após validar a sessão e o perfil.
    $usuarios = ew_acad_rows('/rest/v1/usuarios?select=id,nome_completo,ativo,tipo_usuario_id&ativo=eq.true&limit=1000', 'os usuários ativos');
    $tipos = ew_acad_rows('/rest/v1/tipos_usuario?select=id,codigo&limit=100', 'os tipos de usuário');
    $tipoPorId = [];
    foreach ($tipos as $tipo) $tipoPorId[(int) $tipo['id']] = (string) $tipo['codigo'];
    $usuarioPorId = [];
    $alunosUsuarios = [];
    $professoresUsuarios = [];
    foreach ($usuarios as $item) {
        $id = (string) ($item['id'] ?? '');
        if ($id === '') continue;
        $registro = ['id' => $id, 'nome' => (string) ($item['nome_completo'] ?? 'Usuário')];
        $usuarioPorId[$id] = $registro;
        $papel = $tipoPorId[(int) ($item['tipo_usuario_id'] ?? 0)] ?? '';
        if ($papel === 'aluno') $alunosUsuarios[$id] = $registro;
        if ($papel === 'professor') $professoresUsuarios[$id] = $registro;
    }

    $turmasDb = ew_acad_rows('/rest/v1/turmas?select=id,nome,status&status=eq.ativa&order=nome.asc&limit=1000', 'as turmas ativas');
    $turmasPorId = [];
    foreach ($turmasDb as $turma) $turmasPorId[(int) $turma['id']] = ['id' => (int) $turma['id'], 'nome' => (string) $turma['nome']];

    $matriculas = ew_acad_rows('/rest/v1/matriculas?select=id,aluno_id,turma_id,status&status=eq.ativa&order=id.asc&limit=5000', 'as matrículas ativas');
    $matriculasPorId = [];
    $matriculasPorTurma = [];
    $matriculaIds = [];
    $alunosOut = [];
    foreach ($matriculas as $matricula) {
        $matriculaId = (int) ($matricula['id'] ?? 0);
        $alunoId = (string) ($matricula['aluno_id'] ?? '');
        $turmaId = (int) ($matricula['turma_id'] ?? 0);
        if ($matriculaId <= 0 || !isset($alunosUsuarios[$alunoId], $turmasPorId[$turmaId])) continue;
        $registro = ['id' => $matriculaId, 'aluno_id' => $alunoId, 'turma_id' => $turmaId, 'nome' => $alunosUsuarios[$alunoId]['nome'], 'turma' => $turmasPorId[$turmaId]['nome']];
        $matriculasPorId[$matriculaId] = $registro;
        $matriculasPorTurma[$turmaId][] = $matriculaId;
        $matriculaIds[] = $matriculaId;
    }

    $atribuicoes = ew_acad_rows('/rest/v1/turma_disciplinas?select=id,turma_id,disciplina_id,professor_id&limit=5000', 'as atribuições de turma e disciplina');
    $atribuicaoPorId = [];
    $atribuicoesPorProfessor = [];
    foreach ($atribuicoes as $atribuicao) {
        $id = (int) ($atribuicao['id'] ?? 0);
        $turmaId = (int) ($atribuicao['turma_id'] ?? 0);
        $professorId = (string) ($atribuicao['professor_id'] ?? '');
        if ($id <= 0 || !isset($turmasPorId[$turmaId])) continue;
        $atribuicaoPorId[$id] = ['id' => $id, 'turma_id' => $turmaId, 'disciplina_id' => (int) ($atribuicao['disciplina_id'] ?? 0), 'professor_id' => $professorId];
        if ($professorId !== '') $atribuicoesPorProfessor[$professorId][] = $id;
    }

    $avaliacoes = ew_acad_rows('/rest/v1/avaliacoes?select=id,titulo,data_aplicacao,nota_maxima,peso,periodo_letivo_id,turma_disciplina_id,status&status=eq.publicada&limit=5000', 'as avaliações publicadas');
    $avaliacoesPorId = [];
    $periodoIds = [];
    foreach ($avaliacoes as $avaliacao) {
        $avaliacaoId = (int) ($avaliacao['id'] ?? 0);
        $atribuicaoId = (int) ($avaliacao['turma_disciplina_id'] ?? 0);
        if ($avaliacaoId <= 0 || !isset($atribuicaoPorId[$atribuicaoId])) continue;
        $avaliacao['id'] = $avaliacaoId;
        $avaliacao['turma_id'] = $atribuicaoPorId[$atribuicaoId]['turma_id'];
        $avaliacao['nota_maxima'] = (float) ($avaliacao['nota_maxima'] ?? 0);
        $avaliacao['peso'] = (float) ($avaliacao['peso'] ?? 1);
        $avaliacoesPorId[$avaliacaoId] = $avaliacao;
        $periodoIds[] = (int) ($avaliacao['periodo_letivo_id'] ?? 0);
    }

    $notas = [];
    if ($matriculaIds && $avaliacoesPorId) {
        $notasDb = ew_acad_rows('/rest/v1/notas?select=id,avaliacao_id,matricula_id,nota_obtida,situacao,feedback&matricula_id=' . ew_acad_in_filter($matriculaIds) . '&situacao=eq.lancada&limit=10000', 'as notas lançadas');
        foreach ($notasDb as $nota) {
            $avaliacao = $avaliacoesPorId[(int) ($nota['avaliacao_id'] ?? 0)] ?? null;
            $matricula = $matriculasPorId[(int) ($nota['matricula_id'] ?? 0)] ?? null;
            if (!$avaliacao || !$matricula || (int) $matricula['turma_id'] !== (int) $avaliacao['turma_id']) continue;
            $nota['nota_maxima'] = (float) $avaliacao['nota_maxima'];
            $nota['peso'] = (float) $avaliacao['peso'];
            $nota['periodo_letivo_id'] = (int) ($avaliacao['periodo_letivo_id'] ?? 0);
            $nota['turma_id'] = (int) $matricula['turma_id'];
            $notas[] = $nota;
        }
    }

    $notasPorMatricula = [];
    $notasPorTurma = [];
    $notasPorPeriodo = [];
    foreach ($notas as $nota) {
        $notasPorMatricula[(int) $nota['matricula_id']][] = $nota;
        $notasPorTurma[(int) $nota['turma_id']][] = $nota;
        if ((int) $nota['periodo_letivo_id'] > 0) $notasPorPeriodo[(int) $nota['periodo_letivo_id']][] = $nota;
    }

    $periodosPorId = [];
    if ($periodoIds) {
        $periodos = ew_acad_rows('/rest/v1/periodos_letivos?select=id,nome,ordem&id=' . ew_acad_in_filter(array_values(array_unique($periodoIds))) . '&order=ordem.asc', 'os períodos letivos');
        foreach ($periodos as $periodo) $periodosPorId[(int) $periodo['id']] = $periodo;
    }

    // Frequência: considera apenas aulas realizadas e com chamada fechada.
    // Atrasos contam como presença; ausências justificadas permanecem no denominador.
    $frequenciaPorMatricula = [];
    $frequenciaPorTurma = [];
    $aulasComChamada = ew_acad_rows('/rest/v1/aulas?select=id,turma_disciplina_id&status=eq.realizada&frequencia_fechada=eq.true&limit=10000', 'as aulas com frequência fechada');
    $aulaTurma = [];
    foreach ($aulasComChamada as $aula) {
        $atribuicao = $atribuicaoPorId[(int)($aula['turma_disciplina_id'] ?? 0)] ?? null;
        if (!$atribuicao) continue;
        $aulaId = (int)($aula['id'] ?? 0);
        if ($aulaId > 0) $aulaTurma[$aulaId] = (int)$atribuicao['turma_id'];
    }
    if ($aulaTurma && $matriculaIds) {
        $frequenciasDb = ew_acad_rows('/rest/v1/frequencias?select=aula_id,matricula_id,status&aula_id=' . ew_acad_in_filter(array_keys($aulaTurma)) . '&matricula_id=' . ew_acad_in_filter($matriculaIds) . '&limit=20000', 'os registros de frequência');
        foreach ($frequenciasDb as $freq) {
            $matriculaId = (int)($freq['matricula_id'] ?? 0);
            $aulaId = (int)($freq['aula_id'] ?? 0);
            $matricula = $matriculasPorId[$matriculaId] ?? null;
            if (!$matricula || !isset($aulaTurma[$aulaId]) || (int)$matricula['turma_id'] !== $aulaTurma[$aulaId]) continue;
            $frequenciaPorMatricula[$matriculaId]['total'] = ($frequenciaPorMatricula[$matriculaId]['total'] ?? 0) + 1;
            if (in_array((string)($freq['status'] ?? ''), ['presente', 'atraso'], true)) {
                $frequenciaPorMatricula[$matriculaId]['presencas'] = ($frequenciaPorMatricula[$matriculaId]['presencas'] ?? 0) + 1;
            }
            $turmaId = (int)$matricula['turma_id'];
            $frequenciaPorTurma[$turmaId]['total'] = ($frequenciaPorTurma[$turmaId]['total'] ?? 0) + 1;
            if (in_array((string)($freq['status'] ?? ''), ['presente', 'atraso'], true)) {
                $frequenciaPorTurma[$turmaId]['presencas'] = ($frequenciaPorTurma[$turmaId]['presencas'] ?? 0) + 1;
            }
        }
    }
    $frequenciaAlunoPercentual = static function (int $matriculaId) use ($frequenciaPorMatricula): ?float {
        $dados = $frequenciaPorMatricula[$matriculaId] ?? null;
        return $dados && ($dados['total'] ?? 0) > 0 ? round(100 * ($dados['presencas'] ?? 0) / $dados['total'], 1) : null;
    };
    $frequenciaTurmaPercentual = static function (int $turmaId) use ($frequenciaPorTurma): ?float {
        $dados = $frequenciaPorTurma[$turmaId] ?? null;
        return $dados && ($dados['total'] ?? 0) > 0 ? round(100 * ($dados['presencas'] ?? 0) / $dados['total'], 1) : null;
    };

    foreach ($matriculasPorId as $matriculaId => $matricula) {
        $media = ew_coord_media($notasPorMatricula[$matriculaId] ?? []);
        $alunosOut[] = [
            'id' => $matriculaId,
            'usuarioId' => $matricula['aluno_id'],
            'nome' => $matricula['nome'],
            'turmaId' => $matricula['turma_id'],
            'turma' => $matricula['turma'],
            'media' => $media,
            'frequencia' => $frequenciaAlunoPercentual((int)$matriculaId),
            'situacao' => ew_coord_situacao($media),
            'avaliacoesLancadas' => count($notasPorMatricula[$matriculaId] ?? []),
        ];
    }
    usort($alunosOut, static fn(array $a, array $b): int => strcasecmp($a['nome'], $b['nome']));

    $turmasOut = [];
    foreach ($turmasPorId as $turmaId => $turma) {
        $media = ew_coord_media($notasPorTurma[$turmaId] ?? []);
        $turmasOut[] = [
            'id' => $turmaId,
            'nome' => $turma['nome'],
            'totalAlunos' => count($matriculasPorTurma[$turmaId] ?? []),
            'media' => $media,
            'frequencia' => $frequenciaTurmaPercentual((int)$turmaId),
            'situacao' => ew_coord_situacao($media),
        ];
    }

    $professoresOut = [];
    foreach ($professoresUsuarios as $professorId => $professor) {
        $ids = $atribuicoesPorProfessor[$professorId] ?? [];
        $turmasDoProfessor = [];
        $alunosDoProfessor = [];
        $notasDoProfessor = [];
        foreach ($ids as $atribuicaoId) {
            $atribuicao = $atribuicaoPorId[$atribuicaoId] ?? null;
            if (!$atribuicao) continue;
            $turmaId = $atribuicao['turma_id'];
            $turmasDoProfessor[$turmaId] = true;
            foreach ($matriculasPorTurma[$turmaId] ?? [] as $matriculaId) $alunosDoProfessor[$matriculaId] = true;
            foreach ($notasPorTurma[$turmaId] ?? [] as $nota) $notasDoProfessor[] = $nota;
        }
        $media = ew_coord_media($notasDoProfessor);
        $frequenciaProfessorTotal = 0; $frequenciaProfessorPresencas = 0;
        foreach (array_keys($alunosDoProfessor) as $matriculaId) {
            $f = $frequenciaPorMatricula[$matriculaId] ?? null;
            if (!$f || ($f['total'] ?? 0) <= 0) continue;
            $frequenciaProfessorTotal += (int)$f['total'];
            $frequenciaProfessorPresencas += (int)($f['presencas'] ?? 0);
        }
        $frequenciaProfessor = $frequenciaProfessorTotal > 0 ? round(100 * $frequenciaProfessorPresencas / $frequenciaProfessorTotal, 1) : null;
        $professoresOut[] = ['nome' => $professor['nome'], 'turmas' => count($turmasDoProfessor), 'alunos' => count($alunosDoProfessor), 'mediaTurmas' => $media, 'frequenciaMedia' => $frequenciaProfessor];
    }
    usort($professoresOut, static fn(array $a, array $b): int => strcasecmp($a['nome'], $b['nome']));

    $frequenciasValidas = array_values(array_filter(array_column($alunosOut, 'frequencia'), static fn($v): bool => $v !== null));
    $frequenciaMediaGeral = $frequenciasValidas ? round(array_sum($frequenciasValidas) / count($frequenciasValidas), 1) : null;
    $mediasValidas = array_values(array_filter(array_column($alunosOut, 'media'), static fn($v): bool => $v !== null));
    $mediaGeral = $mediasValidas ? round(array_sum($mediasValidas) / count($mediasValidas), 2) : null;
    $situacoes = ['normal' => 0, 'atencao' => 0, 'critico' => 0, 'sem_dados' => 0];
    foreach ($alunosOut as $aluno) $situacoes[$aluno['situacao']] = ($situacoes[$aluno['situacao']] ?? 0) + 1;

    $evolucao = [];
    foreach ($notasPorPeriodo as $periodoId => $notasPeriodo) {
        $media = ew_coord_media($notasPeriodo);
        if ($media === null) continue;
        $periodo = $periodosPorId[$periodoId] ?? [];
        $evolucao[] = ['periodo_id' => $periodoId, 'rotulo' => (string) ($periodo['nome'] ?? 'Período'), 'ordem' => (int) ($periodo['ordem'] ?? 0), 'valor' => $media];
    }
    usort($evolucao, static fn(array $a, array $b): int => $a['ordem'] <=> $b['ordem']);

    ew_acad_json(200, [
        'sucesso' => true,
        'resumo' => [
            'totalAlunos' => count(array_unique(array_column($alunosOut, 'usuarioId'))),
            'totalProfessores' => count($professoresOut),
            'totalTurmas' => count($turmasOut),
            'mediaGeral' => $mediaGeral,
            'frequenciaMedia' => $frequenciaMediaGeral,
            'alunosNormais' => $situacoes['normal'],
            'alunosAtencao' => $situacoes['atencao'],
            'alunosCritico' => $situacoes['critico'],
        ],
        'alunos' => $alunosOut,
        'professores' => $professoresOut,
        'turmas' => $turmasOut,
        'evolucao' => $evolucao,
    ]);
} catch (Throwable $error) {
    error_log('EduWatch coordination dashboard error: ' . $error->getMessage());
    ew_acad_json(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar os dados da coordenação. Confira a configuração do banco e tente novamente.']);
}
