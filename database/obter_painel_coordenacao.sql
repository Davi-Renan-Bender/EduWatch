-- ==============================================================================
-- EduWatch — Função Otimizada para o Painel da Coordenação
-- 
-- Executa o cálculo de médias, frequências e evolução diretamente no PostgreSQL,
-- eliminando o download de dezenas de milhares de registros pelo PostgREST.
-- 
-- Como aplicar:
-- 1. Abra o Supabase Dashboard (https://supabase.com/dashboard/project/nkndumldmwoqasphqjbg)
-- 2. Vá em "SQL Editor" -> "New query"
-- 3. Cole o código abaixo e clique em "Run" (Executar).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.obter_painel_coordenacao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  WITH
  -- 1. Turmas ativas
  turmas_ativas AS (
    SELECT id, nome
    FROM public.turmas
    WHERE status = 'ativa'
    ORDER BY nome ASC
  ),

  -- 2. Matrículas ativas com dados dos alunos
  matriculas_ativas AS (
    SELECT
      m.id AS matricula_id,
      m.aluno_id,
      m.turma_id,
      u.nome_completo AS nome_aluno,
      t.nome AS nome_turma
    FROM public.matriculas m
    JOIN public.usuarios u ON u.id = m.aluno_id AND u.ativo = true
    JOIN turmas_ativas t ON t.id = m.turma_id
    WHERE m.status = 'ativa'
  ),

  -- 3. Atribuições de turmas e disciplinas
  atribuicoes AS (
    SELECT
      td.id AS turma_disciplina_id,
      td.turma_id,
      td.disciplina_id,
      td.professor_id,
      u.nome_completo AS nome_professor
    FROM public.turma_disciplinas td
    JOIN turmas_ativas t ON t.id = td.turma_id
    LEFT JOIN public.usuarios u ON u.id = td.professor_id
  ),

  -- 4. Avaliações publicadas
  avaliacoes_publicadas AS (
    SELECT
      av.id AS avaliacao_id,
      av.nota_maxima,
      av.peso,
      av.periodo_letivo_id,
      a.turma_id,
      pl.nome AS nome_periodo,
      pl.ordem AS ordem_periodo
    FROM public.avaliacoes av
    JOIN atribuicoes a ON a.turma_disciplina_id = av.turma_disciplina_id
    LEFT JOIN public.periodos_letivos pl ON pl.id = av.periodo_letivo_id
    WHERE av.status = 'publicada'
      AND av.nota_maxima > 0
      AND av.peso > 0
  ),

  -- 5. Médias individuais dos alunos (calculadas isoladamente sem join em frequências)
  notas_aluno AS (
    SELECT
      n.matricula_id,
      count(n.id) AS avaliacoes_lancadas,
      round(
        sum((n.nota_obtida::numeric / av.nota_maxima * 10) * av.peso) / nullif(sum(av.peso), 0)
      , 2) AS media_aluno
    FROM public.notas n
    JOIN avaliacoes_publicadas av ON av.avaliacao_id = n.avaliacao_id
    JOIN matriculas_ativas m ON m.matricula_id = n.matricula_id AND m.turma_id = av.turma_id
    WHERE n.situacao = 'lancada'
      AND n.nota_obtida IS NOT NULL
    GROUP BY n.matricula_id
  ),

  -- 6. Frequências individuais dos alunos (calculadas isoladamente sem join em notas)
  frequencias_aluno AS (
    SELECT
      f.matricula_id,
      count(f.id) AS total_aulas,
      count(f.id) FILTER (WHERE f.status IN ('presente', 'atraso')) AS total_presencas,
      round(
        100.0 * count(f.id) FILTER (WHERE f.status IN ('presente', 'atraso')) / nullif(count(f.id), 0)
      , 1) AS percentual_frequencia
    FROM public.frequencias f
    JOIN public.aulas au ON au.id = f.aula_id AND au.status = 'realizada' AND au.frequencia_fechada = true
    JOIN atribuicoes a ON a.turma_disciplina_id = au.turma_disciplina_id
    JOIN matriculas_ativas m ON m.matricula_id = f.matricula_id AND m.turma_id = a.turma_id
    GROUP BY f.matricula_id
  ),

  -- 7. Consolidação de alunos
  alunos_consolidados AS (
    SELECT
      m.matricula_id AS id,
      m.aluno_id AS "usuarioId",
      m.nome_aluno AS nome,
      m.turma_id AS "turmaId",
      m.nome_turma AS turma,
      na.media_aluno AS media,
      fa.percentual_frequencia AS frequencia,
      CASE
        WHEN na.media_aluno IS NULL THEN 'sem_dados'
        WHEN na.media_aluno >= 7.0 THEN 'normal'
        WHEN na.media_aluno >= 5.0 THEN 'atencao'
        ELSE 'critico'
      END AS situacao,
      coalesce(na.avaliacoes_lancadas, 0) AS "avaliacoesLancadas"
    FROM matriculas_ativas m
    LEFT JOIN notas_aluno na ON na.matricula_id = m.matricula_id
    LEFT JOIN frequencias_aluno fa ON fa.matricula_id = m.matricula_id
    ORDER BY m.nome_aluno ASC
  ),

  -- 8. Consolidação por turma
  turmas_consolidadas AS (
    SELECT
      t.id,
      t.nome,
      count(ac.id) AS "totalAlunos",
      round(avg(ac.media), 2) AS media,
      round(avg(ac.frequencia), 1) AS frequencia,
      CASE
        WHEN avg(ac.media) IS NULL THEN 'sem_dados'
        WHEN avg(ac.media) >= 7.0 THEN 'normal'
        WHEN avg(ac.media) >= 5.0 THEN 'atencao'
        ELSE 'critico'
      END AS situacao
    FROM turmas_ativas t
    LEFT JOIN alunos_consolidados ac ON ac."turmaId" = t.id
    GROUP BY t.id, t.nome
    ORDER BY t.nome ASC
  ),

  -- 9. Consolidação por professor
  professores_consolidados AS (
    SELECT
      a.nome_professor AS nome,
      count(DISTINCT a.turma_id) AS turmas,
      count(DISTINCT ac.id) AS alunos,
      round(avg(ac.media), 2) AS "mediaTurmas",
      round(avg(ac.frequencia), 1) AS "frequenciaMedia"
    FROM atribuicoes a
    LEFT JOIN alunos_consolidados ac ON ac."turmaId" = a.turma_id
    WHERE a.nome_professor IS NOT NULL AND a.nome_professor <> ''
    GROUP BY a.professor_id, a.nome_professor
    ORDER BY a.nome_professor ASC
  ),

  -- 10. Evolução por período letivo
  evolucao_periodos AS (
    SELECT
      av.periodo_letivo_id AS periodo_id,
      av.nome_periodo AS rotulo,
      av.ordem_periodo AS ordem,
      round(
        sum((n.nota_obtida::numeric / av.nota_maxima * 10) * av.peso) / nullif(sum(av.peso), 0)
      , 2) AS valor
    FROM public.notas n
    JOIN avaliacoes_publicadas av ON av.avaliacao_id = n.avaliacao_id
    JOIN matriculas_ativas m ON m.matricula_id = n.matricula_id AND m.turma_id = av.turma_id
    WHERE n.situacao = 'lancada'
      AND n.nota_obtida IS NOT NULL
      AND av.periodo_letivo_id IS NOT NULL
    GROUP BY av.periodo_letivo_id, av.nome_periodo, av.ordem_periodo
    ORDER BY av.ordem_periodo ASC
  ),

  -- 11. Resumo institucional
  resumo_geral AS (
    SELECT
      count(DISTINCT "usuarioId") AS "totalAlunos",
      (SELECT count(*) FROM professores_consolidados) AS "totalProfessores",
      (SELECT count(*) FROM turmas_consolidadas) AS "totalTurmas",
      round(avg(media), 2) AS "mediaGeral",
      round(avg(frequencia), 1) AS "frequenciaMedia",
      count(*) FILTER (WHERE situacao = 'normal') AS "alunosNormais",
      count(*) FILTER (WHERE situacao = 'atencao') AS "alunosAtencao",
      count(*) FILTER (WHERE situacao = 'critico') AS "alunosCritico"
    FROM alunos_consolidados
  )

  SELECT jsonb_build_object(
    'sucesso', true,
    'resumo', (SELECT to_jsonb(r.*) FROM resumo_geral r),
    'alunos', coalesce((SELECT jsonb_agg(to_jsonb(a.*)) FROM alunos_consolidados a), '[]'::jsonb),
    'professores', coalesce((SELECT jsonb_agg(to_jsonb(p.*)) FROM professores_consolidados p), '[]'::jsonb),
    'turmas', coalesce((SELECT jsonb_agg(to_jsonb(t.*)) FROM turmas_consolidadas t), '[]'::jsonb),
    'evolucao', coalesce((SELECT jsonb_agg(to_jsonb(e.*)) FROM evolucao_periodos e), '[]'::jsonb)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;

-- Permissões de execução para os papéis do Supabase
GRANT EXECUTE ON FUNCTION public.obter_painel_coordenacao() TO authenticated, anon, service_role;
