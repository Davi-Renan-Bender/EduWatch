<?php
declare(strict_types=1);

require_once __DIR__ . '/comum.php';
eduwatch_exigir_metodo('GET');
$usuario = ew_acad_require_role(['aluno']);

/** Faixas iniciais de visualização do EduWatch; não representam regra legal. */
function ew_freq_aluno_situacao(?float $percentual): string
{
    if ($percentual === null) return 'sem_dados';
    if ($percentual >= 90.0) return 'normal';
    if ($percentual >= 75.0) return 'atencao';
    return 'critico';
}

function ew_freq_aluno_percentual(int $presencas, int $atrasos, int $total): ?float
{
    if ($total <= 0) return null;
    // Atraso conta como presença para este indicador. Falta justificada permanece
    // no total de aulas registradas, mantendo a regra consistente por disciplina.
    return round((($presencas + $atrasos) / $total) * 100, 1);
}

try {
    $matriculas = ew_acad_rows(
        '/rest/v1/matriculas?select=id,turma_id,aluno_id,status&aluno_id=eq.'
        . rawurlencode($usuario['id']) . '&status=eq.ativa&order=id.asc',
        'suas matrículas ativas'
    );

    $matriculaIdsAtivas = array_values(array_unique(array_map(static fn($row) => (int) $row['id'], $matriculas)));
    $observacoesVisiveis = $matriculaIdsAtivas
        ? ew_acad_rows(
            '/rest/v1/observacoes_pedagogicas?select=id,categoria,descricao,data_registro&matricula_id=' . ew_acad_in_filter($matriculaIdsAtivas)
            . '&visivel_aluno=eq.true&order=data_registro.desc,id.desc&limit=100',
            'as observações pedagógicas visíveis para você'
        )
        : [];

    if (!$matriculas) {
        ew_acad_json(200, [
            'sucesso' => true,
            'criterios' => ['normal_minimo' => 90, 'atencao_minimo' => 75, 'atraso_conta_como_presenca' => true],
            'resumo' => ['frequencia_percentual' => null, 'aulas_registradas' => 0, 'presencas' => 0, 'atrasos' => 0, 'faltas' => 0, 'justificadas' => 0, 'situacao' => 'sem_dados'],
            'disciplinas' => [],
            'evolucao' => [],
            'historico' => [],
            'observacoes' => $observacoesVisiveis,
        ]);
    }

    $matriculaPorId = [];
    $turmaIds = [];
    foreach ($matriculas as $matricula) {
        $matriculaId = (int) ($matricula['id'] ?? 0);
        $turmaId = (int) ($matricula['turma_id'] ?? 0);
        if ($matriculaId <= 0 || $turmaId <= 0) continue;
        $matriculaPorId[$matriculaId] = ['turma_id' => $turmaId];
        $turmaIds[] = $turmaId;
    }
    $turmaIds = array_values(array_unique($turmaIds));
    $matriculaIds = array_keys($matriculaPorId);

    if (!$turmaIds || !$matriculaIds) {
        ew_acad_json(200, [
            'sucesso' => true,
            'criterios' => ['normal_minimo' => 90, 'atencao_minimo' => 75, 'atraso_conta_como_presenca' => true],
            'resumo' => ['frequencia_percentual' => null, 'aulas_registradas' => 0, 'presencas' => 0, 'atrasos' => 0, 'faltas' => 0, 'justificadas' => 0, 'situacao' => 'sem_dados'],
            'disciplinas' => [],
            'evolucao' => [],
            'historico' => [],
            'observacoes' => $observacoesVisiveis,
        ]);
    }

    $atribuicoes = ew_acad_rows(
        '/rest/v1/turma_disciplinas?select=id,turma_id,disciplina_id&turma_id=' . ew_acad_in_filter($turmaIds) . '&order=id.asc',
        'as disciplinas das suas turmas'
    );
    $atribuicaoPorId = [];
    $disciplinaIds = [];
    $atribuicaoIds = [];
    foreach ($atribuicoes as $atribuicao) {
        $id = (int) ($atribuicao['id'] ?? 0);
        $turmaId = (int) ($atribuicao['turma_id'] ?? 0);
        $disciplinaId = (int) ($atribuicao['disciplina_id'] ?? 0);
        if ($id <= 0 || $turmaId <= 0 || $disciplinaId <= 0) continue;
        if (!in_array($turmaId, $turmaIds, true)) continue;
        $atribuicaoPorId[$id] = ['turma_id' => $turmaId, 'disciplina_id' => $disciplinaId];
        $atribuicaoIds[] = $id;
        $disciplinaIds[] = $disciplinaId;
    }
    $atribuicaoIds = array_values(array_unique($atribuicaoIds));
    $disciplinaIds = array_values(array_unique($disciplinaIds));

    if (!$atribuicaoIds) {
        ew_acad_json(200, [
            'sucesso' => true,
            'criterios' => ['normal_minimo' => 90, 'atencao_minimo' => 75, 'atraso_conta_como_presenca' => true],
            'resumo' => ['frequencia_percentual' => null, 'aulas_registradas' => 0, 'presencas' => 0, 'atrasos' => 0, 'faltas' => 0, 'justificadas' => 0, 'situacao' => 'sem_dados'],
            'disciplinas' => [],
            'evolucao' => [],
            'historico' => [],
            'observacoes' => $observacoesVisiveis,
        ]);
    }

    $disciplinasRows = ew_acad_rows(
        '/rest/v1/disciplinas?select=id,nome&id=' . ew_acad_in_filter($disciplinaIds) . '&order=nome.asc',
        'os nomes das disciplinas'
    );
    $nomeDisciplinaPorId = [];
    foreach ($disciplinasRows as $disciplina) {
        $nomeDisciplinaPorId[(int) $disciplina['id']] = (string) $disciplina['nome'];
    }

    $turmasRows = ew_acad_rows(
        '/rest/v1/turmas?select=id,nome,ano_letivo_id&id=' . ew_acad_in_filter($turmaIds),
        'os nomes das turmas'
    );
    $turmaPorId = [];
    foreach ($turmasRows as $turma) {
        $turmaPorId[(int) $turma['id']] = ['nome' => (string) $turma['nome'], 'ano_letivo_id' => (int) $turma['ano_letivo_id']];
    }

    $aulas = ew_acad_rows(
        '/rest/v1/aulas?select=id,turma_disciplina_id,periodo_letivo_id,data_aula,tema,status,frequencia_fechada'
        . '&turma_disciplina_id=' . ew_acad_in_filter($atribuicaoIds)
        . '&status=eq.realizada&frequencia_fechada=eq.true&order=data_aula.desc,id.desc&limit=10000',
        'as aulas com frequência fechada'
    );

    if (!$aulas) {
        ew_acad_json(200, [
            'sucesso' => true,
            'criterios' => ['normal_minimo' => 90, 'atencao_minimo' => 75, 'atraso_conta_como_presenca' => true],
            'resumo' => ['frequencia_percentual' => null, 'aulas_registradas' => 0, 'presencas' => 0, 'atrasos' => 0, 'faltas' => 0, 'justificadas' => 0, 'situacao' => 'sem_dados'],
            'disciplinas' => [],
            'evolucao' => [],
            'historico' => [],
            'observacoes' => $observacoesVisiveis,
        ]);
    }

    $aulaPorId = [];
    $periodoIds = [];
    foreach ($aulas as $aula) {
        $id = (int) ($aula['id'] ?? 0);
        $atribuicaoId = (int) ($aula['turma_disciplina_id'] ?? 0);
        if ($id <= 0 || !isset($atribuicaoPorId[$atribuicaoId])) continue;
        $aulaPorId[$id] = $aula;
        $periodoIds[] = (int) ($aula['periodo_letivo_id'] ?? 0);
    }
    $aulaIds = array_keys($aulaPorId);
    $periodoIds = array_values(array_unique(array_filter($periodoIds, static fn($id) => $id > 0)));

    if (!$aulaIds) {
        ew_acad_json(200, [
            'sucesso' => true,
            'criterios' => ['normal_minimo' => 90, 'atencao_minimo' => 75, 'atraso_conta_como_presenca' => true],
            'resumo' => ['frequencia_percentual' => null, 'aulas_registradas' => 0, 'presencas' => 0, 'atrasos' => 0, 'faltas' => 0, 'justificadas' => 0, 'situacao' => 'sem_dados'],
            'disciplinas' => [],
            'evolucao' => [],
            'historico' => [],
            'observacoes' => $observacoesVisiveis,
        ]);
    }

    $periodoRows = $periodoIds ? ew_acad_rows(
        '/rest/v1/periodos_letivos?select=id,nome,ordem,ano_letivo_id,data_inicio,data_fim&id=' . ew_acad_in_filter($periodoIds),
        'os períodos das aulas registradas'
    ) : [];
    $periodoPorId = [];
    foreach ($periodoRows as $periodo) {
        $periodoPorId[(int) $periodo['id']] = $periodo;
    }

    $frequencias = ew_acad_rows(
        '/rest/v1/frequencias?select=id,aula_id,matricula_id,status&aula_id=' . ew_acad_in_filter($aulaIds)
        . '&matricula_id=' . ew_acad_in_filter($matriculaIds) . '&order=id.asc&limit=20000',
        'seus registros de frequência'
    );

    $statusValidos = ['presente', 'atraso', 'ausente', 'justificada'];
    $contagem = ['presencas' => 0, 'atrasos' => 0, 'faltas' => 0, 'justificadas' => 0, 'total' => 0];
    $porDisciplina = [];
    $porPeriodo = [];
    $historico = [];

    foreach ($frequencias as $frequencia) {
        $aulaId = (int) ($frequencia['aula_id'] ?? 0);
        $matriculaId = (int) ($frequencia['matricula_id'] ?? 0);
        $status = (string) ($frequencia['status'] ?? '');
        if (!isset($aulaPorId[$aulaId], $matriculaPorId[$matriculaId]) || !in_array($status, $statusValidos, true)) continue;

        $aula = $aulaPorId[$aulaId];
        $atribuicaoId = (int) $aula['turma_disciplina_id'];
        $atribuicao = $atribuicaoPorId[$atribuicaoId] ?? null;
        if (!$atribuicao || (int) $atribuicao['turma_id'] !== (int) $matriculaPorId[$matriculaId]['turma_id']) continue;

        $disciplinaId = (int) $atribuicao['disciplina_id'];
        $periodoId = (int) $aula['periodo_letivo_id'];
        if (!isset($porDisciplina[$atribuicaoId])) {
            $porDisciplina[$atribuicaoId] = [
                'turma_disciplina_id' => $atribuicaoId,
                'disciplina_id' => $disciplinaId,
                'disciplina' => $nomeDisciplinaPorId[$disciplinaId] ?? 'Disciplina',
                'turma_id' => (int) $atribuicao['turma_id'],
                'turma' => $turmaPorId[(int) $atribuicao['turma_id']]['nome'] ?? 'Turma',
                'total_aulas' => 0, 'presencas' => 0, 'atrasos' => 0, 'faltas' => 0, 'justificadas' => 0,
            ];
        }
        if (!isset($porPeriodo[$periodoId])) {
            $periodo = $periodoPorId[$periodoId] ?? [];
            $porPeriodo[$periodoId] = [
                'periodo_letivo_id' => $periodoId,
                'nome' => (string) ($periodo['nome'] ?? 'Período'),
                'ordem' => (int) ($periodo['ordem'] ?? 0),
                'ano_letivo_id' => (int) ($periodo['ano_letivo_id'] ?? 0),
                'total_aulas' => 0, 'presencas' => 0, 'atrasos' => 0, 'faltas' => 0, 'justificadas' => 0,
            ];
        }

        $contagem['total']++;
        $porDisciplina[$atribuicaoId]['total_aulas']++;
        $porPeriodo[$periodoId]['total_aulas']++;
        if ($status === 'presente') $contagem['presencas']++;
        if ($status === 'atraso') $contagem['atrasos']++;
        if ($status === 'ausente') $contagem['faltas']++;
        if ($status === 'justificada') $contagem['justificadas']++;
        $chaveContagem = match ($status) {
            'presente' => 'presencas',
            'atraso' => 'atrasos',
            'ausente' => 'faltas',
            'justificada' => 'justificadas',
        };
        $porDisciplina[$atribuicaoId][$chaveContagem]++;
        $porPeriodo[$periodoId][$chaveContagem]++;

        $historico[] = [
            'data_aula' => (string) $aula['data_aula'],
            'periodo' => (string) (($periodoPorId[$periodoId]['nome'] ?? '') ?: 'Período'),
            'disciplina' => $nomeDisciplinaPorId[$disciplinaId] ?? 'Disciplina',
            'tema' => (string) ($aula['tema'] ?? ''),
            'status' => $status,
        ];
    }

    $disciplinas = array_values($porDisciplina);
    foreach ($disciplinas as &$item) {
        $item['frequencia_percentual'] = ew_freq_aluno_percentual($item['presencas'], $item['atrasos'], $item['total_aulas']);
        $item['situacao'] = ew_freq_aluno_situacao($item['frequencia_percentual']);
    }
    unset($item);
    usort($disciplinas, static fn($a, $b) => strcasecmp($a['disciplina'], $b['disciplina']));

    $evolucao = array_values($porPeriodo);
    foreach ($evolucao as &$item) {
        $item['frequencia_percentual'] = ew_freq_aluno_percentual($item['presencas'], $item['atrasos'], $item['total_aulas']);
        $item['situacao'] = ew_freq_aluno_situacao($item['frequencia_percentual']);
    }
    unset($item);
    usort($evolucao, static fn($a, $b) => [$a['ano_letivo_id'], $a['ordem'], $a['periodo_letivo_id']] <=> [$b['ano_letivo_id'], $b['ordem'], $b['periodo_letivo_id']]);

    usort($historico, static fn($a, $b) => strcmp($b['data_aula'], $a['data_aula']));
    $percentualGlobal = ew_freq_aluno_percentual($contagem['presencas'], $contagem['atrasos'], $contagem['total']);
    ew_acad_json(200, [
        'sucesso' => true,
        'criterios' => ['normal_minimo' => 90, 'atencao_minimo' => 75, 'atraso_conta_como_presenca' => true],
        'resumo' => [
            'frequencia_percentual' => $percentualGlobal,
            'aulas_registradas' => $contagem['total'],
            'presencas' => $contagem['presencas'],
            'atrasos' => $contagem['atrasos'],
            'faltas' => $contagem['faltas'],
            'justificadas' => $contagem['justificadas'],
            'situacao' => ew_freq_aluno_situacao($percentualGlobal),
        ],
        'disciplinas' => $disciplinas,
        'evolucao' => $evolucao,
        'historico' => array_slice($historico, 0, 300),
        'observacoes' => $observacoesVisiveis,
    ]);
} catch (Throwable $error) {
    error_log('EduWatch student attendance API error: ' . get_class($error) . ': ' . $error->getMessage());
    ew_acad_json(500, [
        'sucesso' => false,
        'mensagem' => $error instanceof RuntimeException ? $error->getMessage() : 'Não foi possível carregar sua frequência agora.',
    ]);
}
