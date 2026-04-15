-- =============================================
-- BANDEIRA OBRAS - Módulo Financeiro
-- Execute no SQL Editor do Supabase
-- =============================================
-- Este script é SEGURO: só cria o que ainda não existe,
-- não altera nada dos módulos anteriores.

-- ============================================================
-- 1. TABELA DE MOVIMENTAÇÕES FINANCEIRAS
-- ============================================================
-- Cada linha é um gasto (ou receita) vinculado a um imóvel OU a uma grande obra.
-- Pelo menos um dos dois (property_id / project_id) deve estar preenchido.
CREATE TABLE IF NOT EXISTS public.finances (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES public.projects(id)   ON DELETE CASCADE,
  request_id   UUID REFERENCES public.maintenance_requests(id) ON DELETE SET NULL,

  kind         TEXT NOT NULL DEFAULT 'despesa'
                 CHECK (kind IN ('despesa', 'receita')),
  category     TEXT NOT NULL DEFAULT 'outros'
                 CHECK (category IN (
                   'material', 'mao_de_obra', 'servico',
                   'equipamento', 'taxas', 'transporte',
                   'projeto', 'outros'
                 )),
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  due_date     DATE,                      -- vencimento previsto
  paid_date    DATE,                      -- data de pagamento (NULL = em aberto)
  status       TEXT NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),

  supplier     TEXT,                      -- fornecedor / pagador
  invoice_url  TEXT,                      -- URL da nota / recibo (Storage)
  notes        TEXT,

  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT finance_needs_scope CHECK (
    property_id IS NOT NULL OR project_id IS NOT NULL
  )
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_finances_project  ON public.finances (project_id);
CREATE INDEX IF NOT EXISTS idx_finances_property ON public.finances (property_id);
CREATE INDEX IF NOT EXISTS idx_finances_status   ON public.finances (status);
CREATE INDEX IF NOT EXISTS idx_finances_due      ON public.finances (due_date);

-- Trigger de updated_at (reaproveita função do schema principal)
DROP TRIGGER IF EXISTS update_finances_updated_at ON public.finances;
CREATE TRIGGER update_finances_updated_at
  BEFORE UPDATE ON public.finances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2. ORÇAMENTO POR GRANDE OBRA
-- ============================================================
-- Valor total previsto da obra (serve para comparar com gasto real).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS budget NUMERIC(12,2);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado visualiza lançamentos (sócios + responsável).
DROP POLICY IF EXISTS "finances_select" ON public.finances;
CREATE POLICY "finances_select" ON public.finances
  FOR SELECT TO authenticated USING (true);

-- Insert / update / delete: apenas sócios. Responsável é somente leitura.
DROP POLICY IF EXISTS "finances_insert" ON public.finances;
CREATE POLICY "finances_insert" ON public.finances
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'socio'
    )
  );

DROP POLICY IF EXISTS "finances_update" ON public.finances;
CREATE POLICY "finances_update" ON public.finances
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'socio'
    )
  );

DROP POLICY IF EXISTS "finances_delete" ON public.finances;
CREATE POLICY "finances_delete" ON public.finances
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'socio'
    )
  );

-- ============================================================
-- 4. REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.finances;

-- ============================================================
-- 5. BUCKET DE NOTAS / RECIBOS (opcional)
-- ============================================================
-- Cria bucket privado para anexos financeiros.
INSERT INTO storage.buckets (id, name, public)
VALUES ('obras-financeiro', 'obras-financeiro', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'obras_financeiro_select' AND tablename = 'objects') THEN
    CREATE POLICY "obras_financeiro_select" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'obras-financeiro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'obras_financeiro_insert' AND tablename = 'objects') THEN
    CREATE POLICY "obras_financeiro_insert" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'obras-financeiro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'obras_financeiro_delete' AND tablename = 'objects') THEN
    CREATE POLICY "obras_financeiro_delete" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'obras-financeiro');
  END IF;
END $$;

-- ============================================================
-- 6. VIEW DE RESUMO POR OBRA (ajuda no dashboard)
-- ============================================================
CREATE OR REPLACE VIEW public.v_project_finance_summary AS
SELECT
  p.id                                AS project_id,
  p.name                              AS project_name,
  p.budget                            AS budget,
  COALESCE(SUM(f.amount) FILTER (WHERE f.kind='despesa' AND f.status<>'cancelado'), 0)                               AS total_despesa,
  COALESCE(SUM(f.amount) FILTER (WHERE f.kind='despesa' AND f.status='pago'),       0)                               AS total_pago,
  COALESCE(SUM(f.amount) FILTER (WHERE f.kind='despesa' AND f.status IN ('pendente','atrasado')), 0)                 AS total_em_aberto,
  COALESCE(SUM(f.amount) FILTER (WHERE f.kind='receita' AND f.status='pago'),       0)                               AS total_receita
FROM public.projects p
LEFT JOIN public.finances f ON f.project_id = p.id
GROUP BY p.id, p.name, p.budget;

-- ============================================================
-- PRONTO!
-- ============================================================
