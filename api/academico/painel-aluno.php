<?php
declare(strict_types=1);

require_once __DIR__ . '/comum.php';

eduwatch_exigir_metodo('GET');
$usuario = ew_acad_require_role(['aluno']);

/** Retorna a situação a partir da média normalizada de 0 a 10. */
function ew_painel_situacao(?float $media): string
{
    if ($media === null) {
        return 'sem_dados';
    }
    if ($media >= 7.0) {
        return 'normal';
    }
    if ($media >= 5.0) {
        return 'atencao';
    }
    return 'critico';
}

/** Calcula média ponderada usando apenas notas lançadas. */
function ew_painel_media(array $notas): ?float
{
    $somaPonderada = 0.0;
    $somaPesos = 0.0;

    foreach ($notas as $nota) {
        $maxima = (float) ($nota['nota_maxima'] ?? 0);
        $obtida = $nota['nota_obtida'] ?? null;
        if ($obtida === null || $maxima <= 0) {
            continue;
        }
        $peso = max(0.0, (float) ($nota['peso'] ?? 1));
        if ($peso <= 0) {
            continue;
        }
        $somaPonderada += ((float) $obtida / $maxima * 10) * $peso;
        $somaPesos += $peso;
    }

    return $somaPesos > 0 ? round($somaPonderada / $somaPesos, 2) : null;
}

try {
    $matriculas = ew_acad_rows(
        '/rest/v1/matriculas?select=id,turma_id&aluno_id=eq.' . rawurlencode($usuario['id']) . '&status=eq.ativa&order=id.asc',
        'suas matrículas ativas'
    );

    if (!$matriculas) {
        ew_acad_json(200, [
            'sucesso' => true,
            'resumo' => ['media_geral' => null, 'disciplinas_com_notas' => 0, 'evolucao_recente' => null, 'situacao' => 'sem_dados'],
            'turmas' => [],
            'disciplinas' => [],
            'evolucao' => [],
        ]);
    }

    $matriculaIds = array_map(static fn(array $row): int => (int) $row['id'], $matriculas);
    $turmaIds = array_values(array_unique(array_map(static fn(array $row): int => (int) $row['turma_id'], $matriculas)));
    $notas = ew_acad_rows(
        '/rest/v1/notas?select=avaliacao_id,matricula_id,nota_obtida,situacao&matricula_id=' . ew_acad_in_filter($matriculaIds) . '&situacao=eq.lancada&order=id.asc',
        'suas notas lançadas'
    );

    $turmas = ew_acad_rows(
        '/rest/v1/turmas?select=id,nome&id=' . ew_acad_in_filter($turmaIds) . '&order=nome.asc',
        'suas turmas'
    );
    $turmasOut = array_map(static fn(array $turma): array => [
        'id' => (int) $turma['id'],
        'nome' => (string) $turma['nome'],
    ], $turmas);

    if (!$notas) {
        ew_acad_json(200, [
            'sucesso' => true,
            'resumo' => ['media_geral' => null, 'disciplinas_com_notas' => 0, 'evolucao_recente' => null, 'situacao' => 'sem_dados'],
            'turmas' => $turmasOut,
            'disciplinas' => [],
            'evolucao' => [],
        ]);
    }

    $avaliacaoIds = array_values(array_unique(array_map(static fn(array $row): int => (int) $row['avaliacao_id'], $notas)));
    $avaliacoes = ew_acad_rows(
        '/rest/v1/avaliacoes?select=id,turma_disciplina_id,periodo_letivo_id,nota_maxima,peso,status&id=' . ew_acad_in_filter($avaliacaoIds) . '&status=eq.publicada',
        'as avaliações publicadas'
    );
    $avaliacoesPorId = [];
    $atribuicaoIds = [];
    $periodoIds = [];
    foreach ($avaliacoes as $avaliacao) {
        $avaliacoesPorId[(int) $avaliacao['id']] = $avaliacao;
        $atribuicaoIds[] = (int) $avaliacao['turma_disciplina_id'];
        $periodoIds[] = (int) $avaliacao['periodo_letivo_id'];
    }

    if (!$avaliacoesPorId) {
        ew_acad_json(200, [
            'sucesso' => true,
            'resumo' => ['media_geral' => null, 'disciplinas_com_notas' => 0, 'evolucao_recente' => null, 'situacao' => 'sem_dados'],
            'turmas' => $turmasOut,
            'disciplinas' => [],
            'evolucao' => [],
        ]);
    }

    $atribuicoes = ew_acad_rows(
        '/rest/v1/turma_disciplinas?select=id,disciplina_id&id=' . ew_acad_in_filter(array_values(array_unique($atribuicaoIds))),
        'as disciplinas das suas avaliações'
    );
    $atribuicoesPorId = [];
    $disciplinaIds = [];
    foreach ($atribuicoes as $atribuicao) {
        $atribuicoesPorId[(int) $atribuicao['id']] = $atribuicao;
        $disciplinaIds[] = (int) $atribuicao['disciplina_id'];
    }

    $disciplinasDb = $disciplinaIds ? ew_acad_rows(
        '/rest/v1/disciplinas?select=id,nome&id=' . ew_acad_in_filter(array_values(array_unique($disciplinaIds))) . '&order=nome.asc',
        'as disciplinas'
    ) : [];
    $disciplinaNomePorId = [];
    foreach ($disciplinasDb as $disciplina) {
        $disciplinaNomePorId[(int) $disciplina['id']] = (string) $disciplina['nome'];
    }

    $periodos = ew_acad_rows(
        '/rest/v1/periodos_letivos?select=id,nome,ordem&id=' . ew_acad_in_filter(array_values(array_unique($periodoIds))) . '&order=ordem.asc',
        'os períodos das suas avaliações'
    );
    $periodosPorId = [];
    foreach ($periodos as $periodo) {
        $periodosPorId[(int) $periodo['id']] = $periodo;
    }

    $notasComContexto = [];
    foreach ($notas as $nota) {
        $avaliacao = $avaliacoesPorId[(int) $nota['avaliacao_id']] ?? null;
        if (!$avaliacao) {
            continue;
        }
        $atribuicao = $atribuicoesPorId[(int) $avaliacao['turma_disciplina_id']] ?? null;
        if (!$atribuicao) {
            continue;
        }
        $nota['nota_maxima'] = (float) $avaliacao['nota_maxima'];
        $nota['peso'] = (float) $avaliacao['peso'];
        $nota['disciplina_id'] = (int) $atribuicao['disciplina_id'];
        $nota['periodo_letivo_id'] = (int) $avaliacao['periodo_letivo_id'];
        $notasComContexto[] = $nota;
    }

    $porDisciplina = [];
    $porPeriodo = [];
    foreach ($notasComContexto as $nota) {
        $porDisciplina[(int) $nota['disciplina_id']][] = $nota;
        $porPeriodo[(int) $nota['periodo_letivo_id']][] = $nota;
    }

    $disciplinasOut = [];
    foreach ($porDisciplina as $disciplinaId => $notasDisciplina) {
        $media = ew_painel_media($notasDisciplina);
        if ($media === null) {
            continue;
        }
        $disciplinasOut[] = [
            'id' => $disciplinaId,
            'nome' => $disciplinaNomePorId[$disciplinaId] ?? 'Disciplina',
            'media' => $media,
            'situacao' => ew_painel_situacao($media),
            'avaliacoes_lancadas' => count($notasDisciplina),
        ];
    }
    usort($disciplinasOut, static fn(array $a, array $b): int => strcasecmp($a['nome'], $b['nome']));

    $evolucao = [];
    foreach ($porPeriodo as $periodoId => $notasPeriodo) {
        $media = ew_painel_media($notasPeriodo);
        if ($media === null) {
            continue;
        }
        $periodo = $periodosPorId[$periodoId] ?? [];
        $evolucao[] = [
            'periodo_id' => $periodoId,
            'rotulo' => (string) ($periodo['nome'] ?? 'Período'),
            'ordem' => (int) ($periodo['ordem'] ?? 0),
            'media' => $media,
        ];
    }
    usort($evolucao, static fn(array $a, array $b): int => $a['ordem'] <=> $b['ordem']);

    $mediaGeral = ew_painel_media($notasComContexto);
    $evolucaoRecente = count($evolucao) >= 2
        ? round($evolucao[count($evolucao) - 1]['media'] - $evolucao[count($evolucao) - 2]['media'], 2)
        : null;

    ew_acad_json(200, [
        'sucesso' => true,
        'resumo' => [
            'media_geral' => $mediaGeral,
            'disciplinas_com_notas' => count($disciplinasOut),
            'evolucao_recente' => $evolucaoRecente,
            'situacao' => ew_painel_situacao($mediaGeral),
        ],
        'turmas' => $turmasOut,
        'disciplinas' => $disciplinasOut,
        'evolucao' => $evolucao,
    ]);
} catch (Throwable $error) {
    error_log('EduWatch student dashboard error: ' . $error->getMessage());
    ew_acad_json(500, [
        'sucesso' => false,
        'mensagem' => 'Não foi possível carregar seu painel acadêmico.',
    ]);
}
