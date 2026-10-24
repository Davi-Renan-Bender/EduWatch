<?php
declare(strict_types=1);

require_once __DIR__ . '/comum.php';

$metodo = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($metodo, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    ew_acad_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}
if ($metodo === 'POST') eduwatch_validar_origem();
$usuario = ew_acad_require_role(['coordenacao', 'administrador']);

if ($metodo === 'POST' && $usuario['role'] !== 'coordenacao') {
    ew_acad_json(403, [
        'sucesso' => false,
        'mensagem' => 'Somente a coordenação pode alterar regras e registros de acompanhamento.'
    ]);
}

function ew_acomp_int(array $item, string $key, int $min = 0): int
{
    $value = filter_var($item[$key] ?? null, FILTER_VALIDATE_INT);
    return $value === false || $value === null || $value < $min ? 0 : (int) $value;
}

function ew_acomp_float_or_null(mixed $value): ?float
{
    if ($value === null || $value === '') return null;
    if (!is_numeric($value)) return null;
    $number = (float) $value;
    return is_finite($number) ? $number : null;
}

function ew_acomp_configuracoes(): array
{
    return ew_acad_rows(
        '/rest/v1/configuracoes_acompanhamento?select=id,codigo,nome,descricao,direcao,valor_atencao,valor_critico,minimo_registros,parametros,ativo,atualizado_por,updated_at&order=id.asc',
        'as regras de acompanhamento'
    );
}

function ew_acomp_matricula_ativa(int $matriculaId): ?array
{
    if ($matriculaId <= 0) return null;
    return ew_acad_one(
        '/rest/v1/matriculas?select=id,aluno_id,turma_id,status&id=eq.' . $matriculaId . '&status=eq.ativa',
        'a matrícula selecionada'
    );
}

function ew_acomp_registrar_observacao(array $input, array $usuario): never
{
    $matriculaId = ew_acomp_int($input, 'matricula_id', 1);
    $matricula = ew_acomp_matricula_ativa($matriculaId);
    if (!$matricula) ew_acad_json(404, ['sucesso' => false, 'mensagem' => 'A matrícula ativa selecionada não foi encontrada.']);

    $categoria = (string) ($input['categoria'] ?? 'outro');
    $categorias = ['dificuldade_conteudo', 'participacao', 'engajamento', 'comportamento', 'outro'];
    $descricao = trim((string) ($input['descricao'] ?? ''));
    if (!in_array($categoria, $categorias, true)) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Categoria de observação inválida.']);
    if ($descricao === '' || (function_exists('mb_strlen') ? mb_strlen($descricao, 'UTF-8') : strlen($descricao)) > 2000) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'A observação deve conter entre 1 e 2.000 caracteres.']);

    $assignmentId = ew_acomp_int($input, 'turma_disciplina_id', 1);
    if ($assignmentId > 0) {
        $assignment = ew_acad_one(
            '/rest/v1/turma_disciplinas?select=id,turma_id&id=eq.' . $assignmentId,
            'a disciplina da observação'
        );
        if (!$assignment || (int) $assignment['turma_id'] !== (int) $matricula['turma_id']) {
            ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'A disciplina selecionada não pertence à turma deste aluno.']);
        }
    }

    $visivelAluno = filter_var($input['visivel_aluno'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $payload = [
        'matricula_id' => $matriculaId,
        'registrado_por' => $usuario['id'],
        'turma_disciplina_id' => $assignmentId > 0 ? $assignmentId : null,
        'categoria' => $categoria,
        'descricao' => $descricao,
        'visivel_aluno' => $visivelAluno,
    ];
    $created = ew_acad_write('POST', '/rest/v1/observacoes_pedagogicas?select=id,matricula_id,categoria,descricao,data_registro,visivel_aluno', $payload, 'a observação pedagógica');
    if (empty($created[0]['id'])) throw new RuntimeException('O banco não retornou a observação criada.');

    if ($visivelAluno) {
        try {
            ew_acad_write('POST', '/rest/v1/notificacoes', [[
                'usuario_id' => (string) $matricula['aluno_id'],
                'titulo' => 'Nova observação pedagógica',
                'mensagem' => 'A equipe pedagógica registrou uma observação disponível na sua área de acompanhamento.',
                'link_destino' => 'aluno.html#frequencia',
            ]], 'a notificação da observação pedagógica', 'return=minimal');
        } catch (Throwable $notificationError) {
            error_log('EduWatch observation notification insert failed: ' . get_class($notificationError));
        }
    }

    ew_acad_json(201, ['sucesso' => true, 'mensagem' => 'Observação pedagógica registrada.', 'observacao' => $created[0]]);
}

function ew_acomp_atualizar_alerta(array $input, array $usuario): never
{
    $alertaId = ew_acomp_int($input, 'alerta_id', 1);
    $status = (string) ($input['status'] ?? '');
    $validos = ['aberto', 'em_andamento', 'resolvido', 'descartado'];
    if ($alertaId <= 0 || !in_array($status, $validos, true)) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Informe um alerta e um status válidos.']);

    $existing = ew_acad_one('/rest/v1/alertas_acompanhamento?select=id,status&id=eq.' . $alertaId, 'o alerta selecionado');
    if (!$existing) ew_acad_json(404, ['sucesso' => false, 'mensagem' => 'O alerta selecionado não foi encontrado.']);

    $payload = [
        'status' => $status,
        'responsavel_id' => $usuario['id'],
        'resolvido_em' => $status === 'resolvido' ? gmdate('Y-m-d\TH:i:s\Z') : null,
    ];
    ew_acad_write('PATCH', '/rest/v1/alertas_acompanhamento?id=eq.' . $alertaId, $payload, 'o status do alerta', 'return=minimal');
    ew_acad_json(200, ['sucesso' => true, 'mensagem' => 'Status do alerta atualizado.']);
}

function ew_acomp_criar_acao(array $input, array $usuario): never
{
    $alertaId = ew_acomp_int($input, 'alerta_id', 1);
    $alerta = $alertaId ? ew_acad_one('/rest/v1/alertas_acompanhamento?select=id,status,responsavel_id&id=eq.' . $alertaId, 'o alerta da ação') : null;
    if (!$alerta) ew_acad_json(404, ['sucesso' => false, 'mensagem' => 'Selecione um alerta válido para registrar a ação.']);

    $tipo = trim((string) ($input['tipo_acao'] ?? ''));
    $descricao = trim((string) ($input['descricao'] ?? ''));
    $status = (string) ($input['status'] ?? 'planejada');
    $dataAcao = trim((string) ($input['data_acao'] ?? ''));
    $dataRevisao = trim((string) ($input['data_revisao'] ?? ''));
    if ($tipo === '' || (function_exists('mb_strlen') ? mb_strlen($tipo, 'UTF-8') : strlen($tipo)) > 100 || $descricao === '' || (function_exists('mb_strlen') ? mb_strlen($descricao, 'UTF-8') : strlen($descricao)) > 2000) {
        ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Informe o tipo e a descrição da ação (até 2.000 caracteres).']);
    }
    if (!in_array($status, ['planejada', 'em_andamento', 'concluida', 'cancelada'], true)) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Status da ação inválido.']);
    foreach (['data_acao' => $dataAcao, 'data_revisao' => $dataRevisao] as $name => $value) {
        if ($value !== '' && (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) || !checkdate((int) substr($value, 5, 2), (int) substr($value, 8, 2), (int) substr($value, 0, 4)))) {
            ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Informe datas válidas para a ação e sua revisão.']);
        }
    }
    if ($dataAcao !== '' && $dataRevisao !== '' && $dataRevisao < $dataAcao) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'A data de revisão não pode anteceder a data da ação.']);

    $payload = [
        'alerta_id' => $alertaId,
        'responsavel_id' => $usuario['id'],
        'criado_por' => $usuario['id'],
        'tipo_acao' => $tipo,
        'descricao' => $descricao,
        'data_acao' => $dataAcao !== '' ? $dataAcao : null,
        'data_revisao' => $dataRevisao !== '' ? $dataRevisao : null,
        'status' => $status,
    ];
    $created = ew_acad_write('POST', '/rest/v1/acoes_acompanhamento?select=id,alerta_id,tipo_acao,descricao,data_acao,data_revisao,status,created_at', $payload, 'a ação de acompanhamento');
    if (empty($created[0]['id'])) throw new RuntimeException('O banco não retornou a ação criada.');

    if (in_array((string) $alerta['status'], ['aberto'], true) && $status !== 'cancelada') {
        ew_acad_write('PATCH', '/rest/v1/alertas_acompanhamento?id=eq.' . $alertaId . '&status=eq.aberto', ['status' => 'em_andamento', 'responsavel_id' => $usuario['id']], 'o início do acompanhamento', 'return=minimal');
    }
    ew_acad_json(201, ['sucesso' => true, 'mensagem' => 'Ação de acompanhamento registrada.', 'acao' => $created[0]]);
}

function ew_acomp_salvar_regra(array $input, array $usuario): never
{
   if ($usuario['role'] !== 'coordenacao') {
    ew_acad_json(403, [
        'sucesso' => false,
        'mensagem' => 'Somente a coordenação pode alterar as regras de acompanhamento.'
    ]);
}

    $codigo = trim((string) ($input['codigo'] ?? ''));
    $existing = $codigo !== '' ? ew_acad_one('/rest/v1/configuracoes_acompanhamento?select=id,codigo&codigo=eq.' . rawurlencode($codigo), 'a regra selecionada') : null;
    if (!$existing) ew_acad_json(404, ['sucesso' => false, 'mensagem' => 'A regra de acompanhamento não foi encontrada no banco.']);

    $ativo = filter_var($input['ativo'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $direcao = (string) ($input['direcao'] ?? '');
    $validDirections = ['abaixo', 'acima', 'queda'];
    if (!in_array($direcao, $validDirections, true)) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Direção de comparação inválida.']);

    $attention = ew_acomp_float_or_null($input['valor_atencao'] ?? null);
    $critical = ew_acomp_float_or_null($input['valor_critico'] ?? null);
    $minimum = filter_var($input['minimo_registros'] ?? null, FILTER_VALIDATE_INT);
    if ($minimum === false || $minimum === null || $minimum < 1 || $minimum > 100) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'O mínimo de registros deve ficar entre 1 e 100.']);
    if ($ativo && ($attention === null || $critical === null)) {
        ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Para ativar uma regra, informe os limites de atenção e crítico.']);
    }
    if (($attention !== null && $attention < 0) || ($critical !== null && $critical < 0)) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Os limites não podem ser negativos.']);

    if (in_array($codigo, ['media_baixa', 'frequencia_baixa'], true)) {
        if ($direcao !== 'abaixo' || ($attention !== null && $critical !== null && $critical >= $attention)) {
            ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Para média/frequência baixa, o limite crítico precisa ser menor que o limite de atenção.']);
        }
        if ($codigo === 'media_baixa' && (($attention !== null && $attention > 10) || ($critical !== null && $critical > 10))) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Os limites de média devem estar entre 0 e 10.']);
        if ($codigo === 'frequencia_baixa' && (($attention !== null && $attention > 100) || ($critical !== null && $critical > 100))) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Os limites de frequência devem estar entre 0 e 100%.']);
    }
    if ($codigo === 'queda_desempenho') {
        if ($direcao !== 'queda' || ($attention !== null && $critical !== null && $critical < $attention)) {
            ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Para queda de desempenho, o limite crítico deve ser igual ou maior que o limite de atenção.']);
        }
        if (($attention !== null && $attention > 10) || ($critical !== null && $critical > 10)) {
            ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Os limites de queda devem ficar entre 0 e 10 pontos.']);
        }
    }
    if ($codigo === 'resultados_consecutivos_baixos') {
        if ($direcao !== 'acima' || ($attention !== null && $critical !== null && $critical < $attention)) {
            ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Para resultados consecutivos baixos, configure direção acima e limite crítico igual ou maior que o limite de atenção.']);
        }
        foreach (['atenção' => $attention, 'crítico' => $critical] as $label => $threshold) {
            if ($threshold !== null && ($threshold < 1 || floor($threshold) !== $threshold)) {
                ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Os limites de resultados consecutivos devem ser números inteiros positivos.']);
            }
        }
    }

    $params = $input['parametros'] ?? [];
    if (is_string($params)) {
        $decoded = json_decode($params, true);
        $params = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($params)) $params = [];
    if ($codigo === 'resultados_consecutivos_baixos') {
        $notaLimite = ew_acomp_float_or_null($params['nota_limite'] ?? 5);
        if ($notaLimite === null || $notaLimite < 0 || $notaLimite > 10) ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'O limite de nota para a sequência deve ficar entre 0 e 10.']);
        $params['nota_limite'] = $notaLimite;
    }

    $payload = [
        'ativo' => $ativo,
        'direcao' => $direcao,
        'valor_atencao' => $attention,
        'valor_critico' => $critical,
        'minimo_registros' => (int) $minimum,
        'parametros' => $params,
        'atualizado_por' => $usuario['id'],
        'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
    ];
    ew_acad_write('PATCH', '/rest/v1/configuracoes_acompanhamento?codigo=eq.' . rawurlencode($codigo), $payload, 'a regra de acompanhamento', 'return=minimal');
    ew_acad_json(200, ['sucesso' => true, 'mensagem' => 'Regra de acompanhamento salva.']);
}

function ew_acomp_nivel_abaixo(float $valor, float $attention, float $critical): ?string
{
    // Limites consistentes com a classificação da área do aluno: a partir de
    // 7/90% é Normal; de 5 a menos de 7 ou de 75% a menos de 90% é Atenção;
    // abaixo de 5 ou de 75% é Crítico.
    if ($valor < $critical) return 'critico';
    if ($valor < $attention) return 'atencao';
    return null;
}

function ew_acomp_nivel_acima(float $valor, float $attention, float $critical): ?string
{
    if ($valor >= $critical) return 'critico';
    if ($valor >= $attention) return 'atencao';
    return null;
}

function ew_acomp_media_normalizada(array $notas, array $avaliacoes): array
{
    $soma = 0.0;
    $pesoTotal = 0.0;
    $quantidade = 0;
    foreach ($notas as $nota) {
        $avaliacao = $avaliacoes[(int) ($nota['avaliacao_id'] ?? 0)] ?? null;
        if (!$avaliacao || !is_numeric($nota['nota_obtida'] ?? null)) continue;
        $maximo = (float) ($avaliacao['nota_maxima'] ?? 0);
        $peso = (float) ($avaliacao['peso'] ?? 1);
        if ($maximo <= 0 || $peso <= 0) continue;
        $score = ((float) $nota['nota_obtida'] / $maximo) * 10.0;
        $soma += $score * $peso;
        $pesoTotal += $peso;
        $quantidade++;
    }
    return ['media' => $pesoTotal > 0 ? round($soma / $pesoTotal, 2) : null, 'quantidade' => $quantidade];
}

function ew_acomp_salvar_alerta(array $payload): string
{
    $matriculaId = (int) $payload['matricula_id'];
    $periodoId = (int) $payload['periodo_letivo_id'];
    $codigo = (string) $payload['codigo_regra'];
    $scopeId = isset($payload['turma_disciplina_id']) ? (int) $payload['turma_disciplina_id'] : 0;
    $path = '/rest/v1/alertas_acompanhamento?select=id,status,nivel&matricula_id=eq.' . $matriculaId
        . '&periodo_letivo_id=eq.' . $periodoId
        . '&codigo_regra=eq.' . rawurlencode($codigo)
        . '&status=in.(aberto,em_andamento)'
        . ($scopeId > 0 ? '&turma_disciplina_id=eq.' . $scopeId : '&turma_disciplina_id=is.null');
    $existing = ew_acad_one($path, 'o alerta ativo existente');
    if ($existing) {
        $patch = [
            'nivel' => $payload['nivel'],
            'valor_observado' => $payload['valor_observado'],
            'limite_aplicado' => $payload['limite_aplicado'],
            'justificativa' => $payload['justificativa'],
        ];
        ew_acad_write('PATCH', '/rest/v1/alertas_acompanhamento?id=eq.' . (int) $existing['id'], $patch, 'a atualização do alerta', 'return=minimal');
        return 'atualizado';
    }
    $created = ew_acad_write('POST', '/rest/v1/alertas_acompanhamento?select=id', $payload, 'o alerta pedagógico');
    return !empty($created[0]['id']) ? 'criado' : 'ignorado';
}

function ew_acomp_gerar_alertas(array $usuario): never
{
    $configs = ew_acomp_configuracoes();
    $rules = [];
    foreach ($configs as $config) {
        if (($config['ativo'] ?? false) !== true) continue;
        $attention = ew_acomp_float_or_null($config['valor_atencao'] ?? null);
        $critical = ew_acomp_float_or_null($config['valor_critico'] ?? null);
        if ($attention === null || $critical === null) continue;
        $config['valor_atencao_num'] = $attention;
        $config['valor_critico_num'] = $critical;
        $rules[(string) $config['codigo']] = $config;
    }
    if (!$rules) {
        ew_acad_json(200, ['sucesso' => true, 'mensagem' => 'Nenhuma regra está ativa e configurada. A administração precisa configurar e ativar as regras antes de gerar alertas.', 'criados' => 0, 'atualizados' => 0, 'periodos_analisados' => 0]);
    }

    $today = (new DateTimeImmutable('today', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
    $periods = ew_acad_rows('/rest/v1/periodos_letivos?select=id,nome,ordem,ano_letivo_id,data_inicio,data_fim&order=ordem.asc', 'os períodos letivos');
    $periodById = [];
    $periodsByYear = [];
    foreach ($periods as $period) {
        $id = (int) $period['id'];
        $periodById[$id] = $period;
        $periodsByYear[(int) $period['ano_letivo_id']][] = $period;
    }
    $currentPeriodByYear = [];
    $previousPeriodById = [];
    foreach ($periodsByYear as $yearId => $yearPeriods) {
        usort($yearPeriods, static fn($a, $b) => (int) $a['ordem'] <=> (int) $b['ordem']);
        $currentIndex = null;
        foreach ($yearPeriods as $i => $period) {
            if ((string) $period['data_inicio'] <= $today && (string) $period['data_fim'] >= $today) {
                $currentIndex = $i;
                break;
            }
        }
        if ($currentIndex !== null) {
            $current = $yearPeriods[$currentIndex];
            $currentPeriodByYear[(int) $yearId] = $current;
            if ($currentIndex > 0) $previousPeriodById[(int) $current['id']] = $yearPeriods[$currentIndex - 1];
        }
    }
    if (!$currentPeriodByYear) {
        ew_acad_json(200, ['sucesso' => true, 'mensagem' => 'Não existe período letivo que contenha a data de hoje. Confira as datas de início e fim dos períodos.', 'criados' => 0, 'atualizados' => 0, 'periodos_analisados' => 0]);
    }

    $matriculas = ew_acad_rows('/rest/v1/matriculas?select=id,aluno_id,turma_id,status&status=eq.ativa&order=id.asc&limit=10000', 'as matrículas ativas');
    $turmaIds = array_values(array_unique(array_map(static fn($m) => (int) $m['turma_id'], $matriculas)));
    if (!$matriculas || !$turmaIds) ew_acad_json(200, ['sucesso' => true, 'mensagem' => 'Não há matrículas ativas para avaliar.', 'criados' => 0, 'atualizados' => 0, 'periodos_analisados' => 0]);

    $turmasRows = ew_acad_rows('/rest/v1/turmas?select=id,nome,ano_letivo_id,status&id=' . ew_acad_in_filter($turmaIds) . '&status=eq.ativa', 'as turmas ativas');
    $turmas = [];
    foreach ($turmasRows as $turma) $turmas[(int) $turma['id']] = $turma;

    $students = [];
    $matriculaIds = [];
    $classIds = [];
    foreach ($matriculas as $matricula) {
        $id = (int) $matricula['id'];
        $turmaId = (int) $matricula['turma_id'];
        if (!isset($turmas[$turmaId])) continue;
        $students[$id] = ['matricula_id' => $id, 'aluno_id' => (string) $matricula['aluno_id'], 'turma_id' => $turmaId, 'ano_letivo_id' => (int) $turmas[$turmaId]['ano_letivo_id']];
        $matriculaIds[] = $id;
        $classIds[] = $turmaId;
    }
    $matriculaIds = array_values(array_unique($matriculaIds));
    $classIds = array_values(array_unique($classIds));
    if (!$matriculaIds || !$classIds) ew_acad_json(200, ['sucesso' => true, 'mensagem' => 'Não há matrículas ativas em turmas ativas para avaliar.', 'criados' => 0, 'atualizados' => 0, 'periodos_analisados' => 0]);

    $assignmentsRows = ew_acad_rows('/rest/v1/turma_disciplinas?select=id,turma_id,disciplina_id&turma_id=' . ew_acad_in_filter($classIds) . '&order=id.asc&limit=10000', 'as disciplinas das turmas ativas');
    $assignments = [];
    $assignmentIds = [];
    foreach ($assignmentsRows as $assignment) {
        $id = (int) $assignment['id'];
        $turmaId = (int) $assignment['turma_id'];
        if (!isset($turmas[$turmaId])) continue;
        $assignments[$id] = ['id' => $id, 'turma_id' => $turmaId, 'disciplina_id' => (int) $assignment['disciplina_id']];
        $assignmentIds[] = $id;
    }
    if (!$assignmentIds) ew_acad_json(200, ['sucesso' => true, 'mensagem' => 'Não há disciplinas atribuídas às turmas ativas.', 'criados' => 0, 'atualizados' => 0, 'periodos_analisados' => count($currentPeriodByYear)]);

    $periodEvalIds = [];
    foreach ($currentPeriodByYear as $current) {
        $periodEvalIds[] = (int) $current['id'];
        $prev = $previousPeriodById[(int) $current['id']] ?? null;
        if ($prev) $periodEvalIds[] = (int) $prev['id'];
    }
    $periodEvalIds = array_values(array_unique($periodEvalIds));
    $periodIdFilter = ew_acad_in_filter($periodEvalIds);

    $avaliacoesRows = ew_acad_rows(
        '/rest/v1/avaliacoes?select=id,turma_disciplina_id,periodo_letivo_id,titulo,data_aplicacao,nota_maxima,peso,status'
        . '&turma_disciplina_id=' . ew_acad_in_filter($assignmentIds)
        . '&periodo_letivo_id=' . $periodIdFilter
        . '&status=in.(publicada,encerrada)&order=data_aplicacao.asc,id.asc&limit=20000',
        'as avaliações publicadas dos períodos atuais e anteriores'
    );
    $avaliacoes = [];
    $avaliacaoIds = [];
    $evalsPorEscopo = [];
    foreach ($avaliacoesRows as $evaluation) {
        $id = (int) $evaluation['id'];
        $assignmentId = (int) $evaluation['turma_disciplina_id'];
        if (!isset($assignments[$assignmentId])) continue;
        $avaliacoes[$id] = $evaluation;
        $avaliacaoIds[] = $id;
        $periodId = (int) $evaluation['periodo_letivo_id'];
        $evalsPorEscopo[$periodId][$assignmentId][] = $evaluation;
    }

    $notasPorMatriculaPeriodo = [];
    $notasPorMatriculaEscopo = [];
    if ($avaliacaoIds) {
        $notas = ew_acad_rows(
            '/rest/v1/notas?select=id,avaliacao_id,matricula_id,nota_obtida,situacao'
            . '&avaliacao_id=' . ew_acad_in_filter($avaliacaoIds)
            . '&matricula_id=' . ew_acad_in_filter($matriculaIds)
            . '&situacao=eq.lancada&order=id.asc&limit=30000',
            'as notas lançadas dos períodos avaliados'
        );
        foreach ($notas as $nota) {
            $evaluationId = (int) $nota['avaliacao_id'];
            $matriculaId = (int) $nota['matricula_id'];
            $evaluation = $avaliacoes[$evaluationId] ?? null;
            if (!$evaluation || !isset($students[$matriculaId]) || !is_numeric($nota['nota_obtida'] ?? null)) continue;
            $assignmentId = (int) $evaluation['turma_disciplina_id'];
            if ($assignments[$assignmentId]['turma_id'] !== $students[$matriculaId]['turma_id']) continue;
            $periodId = (int) $evaluation['periodo_letivo_id'];
            $noteRow = ['nota_obtida' => (float) $nota['nota_obtida'], 'avaliacao_id' => $evaluationId];
            $notasPorMatriculaPeriodo[$matriculaId][$periodId][] = $noteRow;
            $notasPorMatriculaEscopo[$matriculaId][$periodId][$assignmentId][] = $noteRow;
        }
    }

    $medias = [];
    foreach ($students as $matriculaId => $student) {
        foreach ($periodEvalIds as $periodId) {
            $rows = $notasPorMatriculaPeriodo[$matriculaId][$periodId] ?? [];
            $medias[$matriculaId][$periodId] = ew_acomp_media_normalizada($rows, $avaliacoes);
        }
    }

    $aulasRows = ew_acad_rows(
        '/rest/v1/aulas?select=id,turma_disciplina_id,periodo_letivo_id,data_aula,status,frequencia_fechada'
        . '&turma_disciplina_id=' . ew_acad_in_filter($assignmentIds)
        . '&periodo_letivo_id=' . ew_acad_in_filter(array_values(array_map(static fn($p) => (int) $p['id'], array_values($currentPeriodByYear))))
        . '&status=eq.realizada&frequencia_fechada=eq.true&order=data_aula.asc,id.asc&limit=30000',
        'as chamadas fechadas dos períodos atuais'
    );
    $aulas = [];
    foreach ($aulasRows as $aula) {
        $id = (int) $aula['id'];
        $assignmentId = (int) $aula['turma_disciplina_id'];
        if (isset($assignments[$assignmentId])) $aulas[$id] = $aula;
    }

    $frequenciaPorMatriculaPeriodo = [];
    if ($aulas && $matriculaIds) {
        $frequencias = ew_acad_rows(
            '/rest/v1/frequencias?select=id,aula_id,matricula_id,status&aula_id=' . ew_acad_in_filter(array_keys($aulas))
            . '&matricula_id=' . ew_acad_in_filter($matriculaIds) . '&order=id.asc&limit=50000',
            'as chamadas registradas dos períodos atuais'
        );
        foreach ($frequencias as $freq) {
            $aulaId = (int) $freq['aula_id'];
            $matriculaId = (int) $freq['matricula_id'];
            if (!isset($aulas[$aulaId], $students[$matriculaId])) continue;
            $aula = $aulas[$aulaId];
            $assignmentId = (int) $aula['turma_disciplina_id'];
            if (!isset($assignments[$assignmentId]) || $assignments[$assignmentId]['turma_id'] !== $students[$matriculaId]['turma_id']) continue;
            $periodId = (int) $aula['periodo_letivo_id'];
            $bucket = &$frequenciaPorMatriculaPeriodo[$matriculaId][$periodId];
            if (!isset($bucket)) $bucket = ['total' => 0, 'presentes' => 0];
            $status = (string) $freq['status'];
            if (!in_array($status, ['presente', 'atraso', 'ausente', 'justificada'], true)) continue;
            $bucket['total']++;
            if (in_array($status, ['presente', 'atraso'], true)) $bucket['presentes']++;
            unset($bucket);
        }
    }

    $criados = 0;
    $atualizados = 0;
    $alertsProcessed = 0;
    foreach ($students as $matriculaId => $student) {
        $yearId = (int) $student['ano_letivo_id'];
        $currentPeriod = $currentPeriodByYear[$yearId] ?? null;
        if (!$currentPeriod) continue;
        $currentPeriodId = (int) $currentPeriod['id'];
        $previousPeriod = $previousPeriodById[$currentPeriodId] ?? null;
        $periodId = $currentPeriodId;

        $average = $medias[$matriculaId][$periodId] ?? ['media' => null, 'quantidade' => 0];
        $freq = $frequenciaPorMatriculaPeriodo[$matriculaId][$periodId] ?? ['total' => 0, 'presentes' => 0];
        $frequencyPercent = $freq['total'] > 0 ? round(($freq['presentes'] / $freq['total']) * 100, 1) : null;

        if (isset($rules['media_baixa'])) {
            $rule = $rules['media_baixa'];
            if ($average['media'] !== null && $average['quantidade'] >= (int) $rule['minimo_registros']) {
                $level = ew_acomp_nivel_abaixo((float) $average['media'], $rule['valor_atencao_num'], $rule['valor_critico_num']);
                if ($level) {
                    $limit = $level === 'critico' ? $rule['valor_critico_num'] : $rule['valor_atencao_num'];
                    $payload = ['matricula_id' => (int) $matriculaId, 'periodo_letivo_id' => $periodId, 'turma_disciplina_id' => null, 'codigo_regra' => 'media_baixa', 'nivel' => $level, 'valor_observado' => $average['media'], 'limite_aplicado' => $limit, 'justificativa' => 'Média ponderada normalizada de ' . number_format((float) $average['media'], 2, ',', '') . '/10, calculada com ' . $average['quantidade'] . ' avaliação(ões) publicada(s).'];
                    $alertsProcessed++;
                    $outcome = ew_acomp_salvar_alerta($payload);
                    if ($outcome === 'criado') $criados++; elseif ($outcome === 'atualizado') $atualizados++;
                }
            }
        }

        if (isset($rules['frequencia_baixa'])) {
            $rule = $rules['frequencia_baixa'];
            if ($frequencyPercent !== null && $freq['total'] >= (int) $rule['minimo_registros']) {
                $level = ew_acomp_nivel_abaixo((float) $frequencyPercent, $rule['valor_atencao_num'], $rule['valor_critico_num']);
                if ($level) {
                    $limit = $level === 'critico' ? $rule['valor_critico_num'] : $rule['valor_atencao_num'];
                    $payload = ['matricula_id' => (int) $matriculaId, 'periodo_letivo_id' => $periodId, 'turma_disciplina_id' => null, 'codigo_regra' => 'frequencia_baixa', 'nivel' => $level, 'valor_observado' => $frequencyPercent, 'limite_aplicado' => $limit, 'justificativa' => 'Frequência de ' . number_format((float) $frequencyPercent, 1, ',', '') . '% em ' . $freq['total'] . ' chamada(s) fechada(s); atrasos contam como presença.'];
                    $alertsProcessed++;
                    $outcome = ew_acomp_salvar_alerta($payload);
                    if ($outcome === 'criado') $criados++; elseif ($outcome === 'atualizado') $atualizados++;
                }
            }
        }

        if (isset($rules['queda_desempenho']) && $previousPeriod) {
            $rule = $rules['queda_desempenho'];
            $previous = $medias[$matriculaId][(int) $previousPeriod['id']] ?? ['media' => null, 'quantidade' => 0];
            if ($average['media'] !== null && $previous['media'] !== null
                && $average['quantidade'] >= (int) $rule['minimo_registros']
                && $previous['quantidade'] >= (int) $rule['minimo_registros']) {
                $drop = round((float) $previous['media'] - (float) $average['media'], 2);
                if ($drop > 0) {
                    $level = ew_acomp_nivel_acima($drop, $rule['valor_atencao_num'], $rule['valor_critico_num']);
                    if ($level) {
                        $limit = $level === 'critico' ? $rule['valor_critico_num'] : $rule['valor_atencao_num'];
                        $payload = ['matricula_id' => (int) $matriculaId, 'periodo_letivo_id' => $periodId, 'turma_disciplina_id' => null, 'codigo_regra' => 'queda_desempenho', 'nivel' => $level, 'valor_observado' => $drop, 'limite_aplicado' => $limit, 'justificativa' => 'A média caiu de ' . number_format((float) $previous['media'], 2, ',', '') . ' para ' . number_format((float) $average['media'], 2, ',', '') . ' entre ' . $previousPeriod['nome'] . ' e ' . $currentPeriod['nome'] . '.'];
                        $alertsProcessed++;
                        $outcome = ew_acomp_salvar_alerta($payload);
                        if ($outcome === 'criado') $criados++; elseif ($outcome === 'atualizado') $atualizados++;
                    }
                }
            }
        }

        if (isset($rules['resultados_consecutivos_baixos'])) {
            $rule = $rules['resultados_consecutivos_baixos'];
            $params = $rule['parametros'] ?? [];
            if (is_string($params)) $params = json_decode($params, true) ?: [];
            if (!is_array($params)) $params = [];
            $gradeLimit = ew_acomp_float_or_null($params['nota_limite'] ?? null);
            if ($gradeLimit === null) continue;
            foreach ($assignments as $assignmentId => $assignment) {
                if ((int) $assignment['turma_id'] !== (int) $student['turma_id']) continue;
                $scopedNotes = $notasPorMatriculaEscopo[$matriculaId][$periodId][$assignmentId] ?? [];
                if (count($scopedNotes) < (int) $rule['minimo_registros']) continue;
                $scores = [];
                foreach ($scopedNotes as $note) {
                    $evaluation = $avaliacoes[(int) $note['avaliacao_id']] ?? null;
                    if (!$evaluation || (float) $evaluation['nota_maxima'] <= 0) continue;
                    $scores[] = ['score' => ((float) $note['nota_obtida'] / (float) $evaluation['nota_maxima']) * 10, 'date' => (string) $evaluation['data_aplicacao'], 'id' => (int) $evaluation['id']];
                }
                usort($scores, static fn($a, $b) => [$a['date'], $a['id']] <=> [$b['date'], $b['id']]);
                $consecutive = 0;
                for ($i = count($scores) - 1; $i >= 0; $i--) {
                    if ($scores[$i]['score'] < $gradeLimit) $consecutive++; else break;
                }
                if ($consecutive < (int) $rule['minimo_registros']) continue;
                $level = ew_acomp_nivel_acima((float) $consecutive, $rule['valor_atencao_num'], $rule['valor_critico_num']);
                if (!$level) continue;
                $limit = $level === 'critico' ? $rule['valor_critico_num'] : $rule['valor_atencao_num'];
                $assignmentName = 'disciplina ' . (int) $assignment['disciplina_id'];
                $payload = ['matricula_id' => (int) $matriculaId, 'periodo_letivo_id' => $periodId, 'turma_disciplina_id' => (int) $assignmentId, 'codigo_regra' => 'resultados_consecutivos_baixos', 'nivel' => $level, 'valor_observado' => $consecutive, 'limite_aplicado' => $limit, 'justificativa' => $consecutive . ' resultado(s) consecutivo(s) abaixo de ' . number_format($gradeLimit, 1, ',', '') . '/10 em ' . $assignmentName . '.'];
                $alertsProcessed++;
                $outcome = ew_acomp_salvar_alerta($payload);
                if ($outcome === 'criado') $criados++; elseif ($outcome === 'atualizado') $atualizados++;
            }
        }
    }

    ew_acad_json(200, [
        'sucesso' => true,
        'mensagem' => 'Avaliação das regras concluída. Alertas existentes foram atualizados quando necessário; alertas sem condição atual não são encerrados automaticamente.',
        'criados' => $criados,
        'atualizados' => $atualizados,
        'casos_com_alerta' => $alertsProcessed,
        'periodos_analisados' => count($currentPeriodByYear),
    ]);
}

try {
    if ($metodo === 'GET') {
        $onlyRules = (string) ($_GET['apenas'] ?? '') === 'regras';
        $regras = ew_acomp_configuracoes();
        if ($onlyRules) ew_acad_json(200, ['sucesso' => true, 'regras' => $regras]);

        $matriculas = ew_acad_rows('/rest/v1/matriculas?select=id,aluno_id,turma_id,status&status=eq.ativa&order=id.asc&limit=10000', 'as matrículas ativas');
        $turmaIds = array_values(array_unique(array_map(static fn($m) => (int) $m['turma_id'], $matriculas)));
        $alunoIds = array_values(array_unique(array_map(static fn($m) => (string) $m['aluno_id'], $matriculas)));
        $turmas = $turmaIds ? ew_acad_rows('/rest/v1/turmas?select=id,nome,ano_letivo_id,status&id=' . ew_acad_in_filter($turmaIds) . '&order=nome.asc', 'as turmas dos alunos') : [];
        $turmaMap = [];
        foreach ($turmas as $turma) $turmaMap[(int) $turma['id']] = $turma;
        $usuarios = $alunoIds ? ew_acad_rows('/rest/v1/usuarios?select=id,nome_completo,ativo&id=' . ew_acad_in_filter($alunoIds) . '&ativo=eq.true&order=nome_completo.asc', 'os nomes dos alunos') : [];
        $nomePorUsuario = [];
        foreach ($usuarios as $student) $nomePorUsuario[(string) $student['id']] = (string) $student['nome_completo'];
        $matriculaMap = [];
        foreach ($matriculas as $matricula) {
            $turmaId = (int) $matricula['turma_id'];
            $alunoId = (string) $matricula['aluno_id'];
            $matriculaMap[(int) $matricula['id']] = [
                'matricula_id' => (int) $matricula['id'],
                'aluno_id' => $alunoId,
                'nome' => $nomePorUsuario[$alunoId] ?? 'Aluno sem nome',
                'turma_id' => $turmaId,
                'turma' => (string) ($turmaMap[$turmaId]['nome'] ?? 'Turma'),
                'ano_letivo_id' => (int) ($turmaMap[$turmaId]['ano_letivo_id'] ?? 0),
            ];
        }
        $assignmentsRows = $turmaIds ? ew_acad_rows('/rest/v1/turma_disciplinas?select=id,turma_id,disciplina_id&turma_id=' . ew_acad_in_filter($turmaIds), 'as atribuições de disciplinas') : [];
        $assignmentMap = [];
        $disciplineIds = [];
        foreach ($assignmentsRows as $assignment) {
            $assignmentMap[(int) $assignment['id']] = ['turma_id' => (int) $assignment['turma_id'], 'disciplina_id' => (int) $assignment['disciplina_id']];
            $disciplineIds[] = (int) $assignment['disciplina_id'];
        }
        $disciplineRows = $disciplineIds ? ew_acad_rows('/rest/v1/disciplinas?select=id,nome&id=' . ew_acad_in_filter(array_values(array_unique($disciplineIds))), 'os nomes das disciplinas') : [];
        $disciplineNameMap = [];
        foreach ($disciplineRows as $discipline) $disciplineNameMap[(int) $discipline['id']] = (string) $discipline['nome'];
        $periods = ew_acad_rows('/rest/v1/periodos_letivos?select=id,nome,ordem,ano_letivo_id,data_inicio,data_fim&order=ano_letivo_id.asc,ordem.asc', 'os períodos letivos');
        $periodNameMap = [];
        foreach ($periods as $period) $periodNameMap[(int) $period['id']] = $period;

        $alerts = ew_acad_rows('/rest/v1/alertas_acompanhamento?select=id,matricula_id,periodo_letivo_id,turma_disciplina_id,codigo_regra,nivel,valor_observado,limite_aplicado,justificativa,status,responsavel_id,created_at,resolvido_em&order=created_at.desc,id.desc&limit=300', 'os alertas pedagógicos');
        $observations = ew_acad_rows('/rest/v1/observacoes_pedagogicas?select=id,matricula_id,registrado_por,turma_disciplina_id,categoria,descricao,data_registro,visivel_aluno&order=data_registro.desc,id.desc&limit=300', 'as observações pedagógicas');
        $actions = ew_acad_rows('/rest/v1/acoes_acompanhamento?select=id,alerta_id,responsavel_id,criado_por,tipo_acao,descricao,data_acao,data_revisao,resultado,status,created_at&order=created_at.desc,id.desc&limit=500', 'as ações de acompanhamento');
        $ruleMap = [];
        foreach ($regras as $rule) $ruleMap[(string) $rule['codigo']] = (string) $rule['nome'];
        $alertIdSet = [];
        foreach ($alerts as &$alert) {
            $matriculaId = (int) $alert['matricula_id'];
            $assignmentId = (int) ($alert['turma_disciplina_id'] ?? 0);
            $periodId = (int) $alert['periodo_letivo_id'];
            $alert['aluno'] = $matriculaMap[$matriculaId]['nome'] ?? 'Aluno não encontrado';
            $alert['turma'] = $matriculaMap[$matriculaId]['turma'] ?? 'Turma';
            $alert['regra_nome'] = $ruleMap[(string) $alert['codigo_regra']] ?? (string) $alert['codigo_regra'];
            $alert['periodo'] = (string) ($periodNameMap[$periodId]['nome'] ?? 'Período');
            $alert['disciplina'] = $assignmentId > 0 ? ($disciplineNameMap[$assignmentMap[$assignmentId]['disciplina_id'] ?? 0] ?? 'Disciplina') : 'Geral';
            $alertIdSet[(int) $alert['id']] = true;
        }
        unset($alert);
        foreach ($observations as &$observation) {
            $matriculaId = (int) $observation['matricula_id'];
            $assignmentId = (int) ($observation['turma_disciplina_id'] ?? 0);
            $observation['aluno'] = $matriculaMap[$matriculaId]['nome'] ?? 'Aluno não encontrado';
            $observation['turma'] = $matriculaMap[$matriculaId]['turma'] ?? 'Turma';
            $observation['disciplina'] = $assignmentId > 0 ? ($disciplineNameMap[$assignmentMap[$assignmentId]['disciplina_id'] ?? 0] ?? 'Disciplina') : 'Geral';
        }
        unset($observation);
        $alertLabels = [];
        foreach ($alerts as $alert) {
            $alertLabels[(int) $alert['id']] = ($alert['aluno'] ?? 'Aluno') . ' · ' . ($alert['regra_nome'] ?? 'Regra') . ' · ' . ($alert['periodo'] ?? 'Período');
        }
        foreach ($actions as &$action) {
            $alertId = (int) $action['alerta_id'];
            $action['alerta_disponivel'] = isset($alertIdSet[$alertId]);
            $action['alerta_resumo'] = $alertLabels[$alertId] ?? ('Alerta #' . $alertId);
        }
        unset($action);

        $alunos = array_values($matriculaMap);
        usort($alunos, static fn($a, $b) => strcasecmp($a['nome'], $b['nome']));
        $atribuicoes = [];
        foreach ($assignmentMap as $id => $assignment) {
            $turmaId = (int) $assignment['turma_id'];
            $disciplinaId = (int) $assignment['disciplina_id'];
            $atribuicoes[] = [
                'id' => (int) $id,
                'turma_id' => $turmaId,
                'turma' => (string) ($turmaMap[$turmaId]['nome'] ?? 'Turma'),
                'disciplina_id' => $disciplinaId,
                'disciplina' => (string) ($disciplineNameMap[$disciplinaId] ?? 'Disciplina'),
            ];
        }
        usort($atribuicoes, static fn($a, $b) => [$a['turma'], $a['disciplina']] <=> [$b['turma'], $b['disciplina']]);
        $openCount = count(array_filter($alerts, static fn($row) => in_array((string) $row['status'], ['aberto', 'em_andamento'], true)));
        ew_acad_json(200, [
            'sucesso' => true,
            'regras' => $regras,
            'alunos' => $alunos,
            'atribuicoes' => $atribuicoes,
            'alertas' => $alerts,
            'observacoes' => $observations,
            'acoes' => $actions,
            'periodos' => $periods,
            'resumo' => ['alertas_abertos' => $openCount, 'observacoes' => count($observations), 'acoes' => count($actions)],
        ]);
    }

    $input = eduwatch_ler_json();
    $acao = (string) ($input['acao'] ?? '');
    if ($acao === 'gerar_alertas') ew_acomp_gerar_alertas($usuario);
    if ($acao === 'salvar_regra') ew_acomp_salvar_regra($input, $usuario);
    if ($acao === 'criar_observacao') ew_acomp_registrar_observacao($input, $usuario);
    if ($acao === 'criar_acao') ew_acomp_criar_acao($input, $usuario);
    if ($acao === 'atualizar_alerta') ew_acomp_atualizar_alerta($input, $usuario);

    ew_acad_json(422, ['sucesso' => false, 'mensagem' => 'Ação de acompanhamento desconhecida.']);
} catch (Throwable $error) {
    error_log('EduWatch pedagogical follow-up API error: ' . get_class($error) . ': ' . $error->getMessage());
    ew_acad_json(500, [
        'sucesso' => false,
        'mensagem' => $error instanceof RuntimeException ? $error->getMessage() : 'Não foi possível processar o acompanhamento pedagógico.',
    ]);
}
