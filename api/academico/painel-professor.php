<?php
declare(strict_types=1);

require_once __DIR__ . '/comum.php';

eduwatch_exigir_metodo('GET');
$usuario = ew_acad_require_role(['professor']);

function ew_professor_media(array $notas): ?float
{
    $somaPonderada = 0.0;
    $somaPesos = 0.0;
    foreach ($notas as $nota) {
        $obtida = $nota['nota_obtida'] ?? null;
        $maxima = (float) ($nota['nota_maxima'] ?? 0);
        $peso = max(0.0, (float) ($nota['peso'] ?? 1));
        if ($obtida === null || $maxima <= 0 || $peso <= 0) {
            continue;
        }
        $somaPonderada += ((float) $obtida / $maxima * 10) * $peso;
        $somaPesos += $peso;
    }
    return $somaPesos > 0 ? round($somaPonderada / $somaPesos, 2) : null;
}

function ew_professor_situacao(?float $media): string
{
    if ($media === null) return 'sem_dados';
    if ($media >= 7.0) return 'normal';
    if ($media >= 5.0) return 'atencao';
    return 'critico';
}

try {
    $atribuicoes = ew_acad_rows(
        '/rest/v1/turma_disciplinas?select=id,turma_id&professor_id=eq.' . rawurlencode($usuario['id']) . '&order=id.asc',
        'suas atribuições de turma e disciplina'
    );
    if (!$atribuicoes) {
        ew_acad_json(200, [
            'sucesso' => true,
            'resumo' => ['total_alunos' => 0, 'total_turmas' => 0, 'media_geral' => null, 'avaliacoes_publicadas' => 0, 'alunos_atencao' => 0],
            'turmas' => [],
            'alunos' => [],
        ]);
    }

    $atribuicaoPorId = [];
    $atribuicaoIds = [];
    $turmaIds = [];
    foreach ($atribuicoes as $atribuicao) {
        $atribuicaoId = (int) $atribuicao['id'];
        $atribuicaoPorId[$atribuicaoId] = $atribuicao;
        $atribuicaoIds[] = $atribuicaoId;
        $turmaIds[] = (int) $atribuicao['turma_id'];
    }
    $turmaIds = array_values(array_unique($turmaIds));

    $turmasDb = ew_acad_rows(
        '/rest/v1/turmas?select=id,nome,status&id=' . ew_acad_in_filter($turmaIds) . '&status=eq.ativa&order=nome.asc',
        'suas turmas ativas'
    );
    $turmasPorId = [];
    foreach ($turmasDb as $turma) $turmasPorId[(int) $turma['id']] = $turma;
    $turmaIdsAtivas = array_keys($turmasPorId);

    if (!$turmaIdsAtivas) {
        ew_acad_json(200, [
            'sucesso' => true,
            'resumo' => ['total_alunos' => 0, 'total_turmas' => 0, 'media_geral' => null, 'avaliacoes_publicadas' => 0, 'alunos_atencao' => 0],
            'turmas' => [],
            'alunos' => [],
        ]);
    }

    $matriculas = ew_acad_rows(
        '/rest/v1/matriculas?select=id,aluno_id,turma_id&turma_id=' . ew_acad_in_filter($turmaIdsAtivas) . '&status=eq.ativa&order=id.asc',
        'os alunos das suas turmas'
    );
    $alunoIds = array_values(array_unique(array_map(static fn(array $matricula): string => (string) $matricula['aluno_id'], $matriculas)));
    $tipoAluno = ew_acad_one('/rest/v1/tipos_usuario?select=id&codigo=eq.aluno', 'o tipo de usuário aluno');
    if (!$tipoAluno) throw new RuntimeException('O tipo de usuário aluno não foi encontrado.');
    $usuarios = $alunoIds ? ew_acad_rows(
        '/rest/v1/usuarios?select=id,nome_completo&ativo=eq.true&tipo_usuario_id=eq.' . (int) $tipoAluno['id'] . '&id=' . ew_acad_in_filter($alunoIds) . '&order=nome_completo.asc',
        'os perfis dos alunos'
    ) : [];
    $usuarioPorId = [];
    foreach ($usuarios as $aluno) $usuarioPorId[(string) $aluno['id']] = $aluno;

    $avaliacoes = ew_acad_rows(
        '/rest/v1/avaliacoes?select=id,turma_disciplina_id,nota_maxima,peso&turma_disciplina_id=' . ew_acad_in_filter($atribuicaoIds) . '&status=eq.publicada&order=id.asc',
        'as avaliações publicadas das suas disciplinas'
    );
    $avaliacaoPorId = [];
    foreach ($avaliacoes as $avaliacao) $avaliacaoPorId[(int) $avaliacao['id']] = $avaliacao;
    $avaliacaoIds = array_keys($avaliacaoPorId);
    $notas = $avaliacaoIds ? ew_acad_rows(
        '/rest/v1/notas?select=avaliacao_id,matricula_id,nota_obtida&avaliacao_id=' . ew_acad_in_filter($avaliacaoIds) . '&situacao=eq.lancada&order=id.asc',
        'as notas lançadas das suas turmas'
    ) : [];

    $notasPorMatricula = [];
    $notasPorTurma = [];
    foreach ($notas as $nota) {
        $avaliacao = $avaliacaoPorId[(int) $nota['avaliacao_id']] ?? null;
        if (!$avaliacao) continue;
        $atribuicao = $atribuicaoPorId[(int) $avaliacao['turma_disciplina_id']] ?? null;
        if (!$atribuicao) continue;
        $turmaId = (int) $atribuicao['turma_id'];
        if (!isset($turmasPorId[$turmaId])) continue;
        $nota['nota_maxima'] = (float) $avaliacao['nota_maxima'];
        $nota['peso'] = (float) $avaliacao['peso'];
        $notasPorMatricula[(int) $nota['matricula_id']][] = $nota;
        $notasPorTurma[$turmaId][] = $nota;
    }

    $matriculasPorTurma = [];
    $matriculaTurmaPorId = [];
    $alunosOut = [];
    foreach ($matriculas as $matricula) {
        $turmaId = (int) $matricula['turma_id'];
        $aluno = $usuarioPorId[(string) $matricula['aluno_id']] ?? null;
        if (!$aluno || !isset($turmasPorId[$turmaId])) continue;
        $matriculaId = (int) $matricula['id'];
        $media = ew_professor_media($notasPorMatricula[$matriculaId] ?? []);
        $alunosOut[] = [
            'id' => $matriculaId,
            'nome' => (string) $aluno['nome_completo'],
            'turma_id' => $turmaId,
            'turma' => (string) $turmasPorId[$turmaId]['nome'],
            'media' => $media,
            'avaliacoes_lancadas' => count($notasPorMatricula[$matriculaId] ?? []),
            'situacao' => ew_professor_situacao($media),
        ];
        $matriculasPorTurma[$turmaId][] = $matriculaId;
        $matriculaTurmaPorId[$matriculaId] = $turmaId;
    }
    usort($alunosOut, static fn(array $a, array $b): int => strcasecmp($a['nome'], $b['nome']));

    // Frequência por turma: considera apenas aulas realizadas
// e com a chamada fechada, nas disciplinas atribuídas ao professor.
$atribuicaoIdsAtivas = array_values(array_filter(
    $atribuicaoIds,
    static function (int $id) use ($atribuicaoPorId, $turmasPorId): bool {
        $atribuicao = $atribuicaoPorId[$id] ?? null;

        return $atribuicao !== null
            && isset($turmasPorId[(int) $atribuicao['turma_id']]);
    }
));

$aulasDb = $atribuicaoIdsAtivas
    ? ew_acad_rows(
        '/rest/v1/aulas?select=id,turma_disciplina_id'
        . '&turma_disciplina_id=' . ew_acad_in_filter($atribuicaoIdsAtivas)
        . '&status=eq.realizada'
        . '&frequencia_fechada=eq.true'
        . '&order=id.asc',
        'as aulas realizadas com frequência fechada'
    )
    : [];

$aulaTurma = [];

foreach ($aulasDb as $aula) {
    $aulaId = (int) ($aula['id'] ?? 0);
    $atribuicaoId = (int) ($aula['turma_disciplina_id'] ?? 0);

    $atribuicao = $atribuicaoPorId[$atribuicaoId] ?? null;

    if (!$atribuicao || $aulaId <= 0) {
        continue;
    }

    $turmaId = (int) $atribuicao['turma_id'];

    if (!isset($turmasPorId[$turmaId])) {
        continue;
    }

    $aulaTurma[$aulaId] = $turmaId;
}

$frequenciaPorTurma = [];

if ($aulaTurma && $matriculaTurmaPorId) {
    $frequenciasDb = ew_acad_rows(
        '/rest/v1/frequencias?select=aula_id,matricula_id,status'
        . '&aula_id=' . ew_acad_in_filter(array_keys($aulaTurma))
        . '&matricula_id=' . ew_acad_in_filter(array_keys($matriculaTurmaPorId))
        . '&order=id.asc',
        'as frequências das suas turmas'
    );

    foreach ($frequenciasDb as $frequencia) {
        $aulaId = (int) ($frequencia['aula_id'] ?? 0);
        $matriculaId = (int) ($frequencia['matricula_id'] ?? 0);

        $turmaId = $aulaTurma[$aulaId] ?? 0;
        $turmaDaMatricula = $matriculaTurmaPorId[$matriculaId] ?? 0;

        // Não mistura frequências de alunos de outras turmas.
        if ($turmaId <= 0 || $turmaDaMatricula !== $turmaId) {
            continue;
        }

        if (!isset($frequenciaPorTurma[$turmaId])) {
            $frequenciaPorTurma[$turmaId] = [
                'total' => 0,
                'presencas' => 0,
            ];
        }

        $frequenciaPorTurma[$turmaId]['total']++;

        // Atrasos contam como presença.
        // Ausências justificadas permanecem no denominador.
        if (in_array(
            (string) ($frequencia['status'] ?? ''),
            ['presente', 'atraso'],
            true
        )) {
            $frequenciaPorTurma[$turmaId]['presencas']++;
        }
     }
    }

    $turmasOut = [];
    foreach ($turmasPorId as $turmaId => $turma) {
        $media = ew_professor_media($notasPorTurma[$turmaId] ?? []);
        $turmasOut[] = [
            'id' => $turmaId,
            'nome' => (string) $turma['nome'],
            'total_alunos' => count($matriculasPorTurma[$turmaId] ?? []),
            'media' => $media,
            'frequencia' => (
        isset($frequenciaPorTurma[$turmaId])
       && $frequenciaPorTurma[$turmaId]['total'] > 0
    )
    ? round(
        100
        * $frequenciaPorTurma[$turmaId]['presencas']
        / $frequenciaPorTurma[$turmaId]['total'],
        1
    )
    : null,
    'situacao' => ew_professor_situacao($media),
            'avaliacoes_publicadas' => count(array_filter($avaliacoes, static function (array $avaliacao) use ($atribuicaoPorId, $turmaId): bool {
                return (int) ($atribuicaoPorId[(int) $avaliacao['turma_disciplina_id']]['turma_id'] ?? 0) === $turmaId;
            })),
        ];
    }
    usort($turmasOut, static fn(array $a, array $b): int => strcasecmp($a['nome'], $b['nome']));

    $mediaGeral = ew_professor_media(array_merge(...array_values($notasPorTurma ?: [[]])));
    $alunosAtencao = count(array_filter($alunosOut, static fn(array $aluno): bool => in_array($aluno['situacao'], ['atencao', 'critico'], true)));

    ew_acad_json(200, [
        'sucesso' => true,
        'resumo' => [
            'total_alunos' => count($alunosOut),
            'total_turmas' => count($turmasOut),
            'media_geral' => $mediaGeral,
            'avaliacoes_publicadas' => count($avaliacoes),
            'alunos_atencao' => $alunosAtencao,
        ],
        'turmas' => $turmasOut,
        'alunos' => $alunosOut,
    ]);
} catch (Throwable $error) {
    error_log('EduWatch teacher dashboard error: ' . $error->getMessage());
    ew_acad_json(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar o painel das suas turmas.']);
}
