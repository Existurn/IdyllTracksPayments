-- ==============================================================================
-- Migration: Add missing columns and RLS permissions for invoice deletion
-- ==============================================================================

-- 1. Ensure columns exist on invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Index for filtering deleted vs active invoices efficiently
CREATE INDEX IF NOT EXISTS idx_invoices_is_deleted ON public.invoices(is_deleted);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON public.invoices(deleted_at);

-- 3. Enable RLS on invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Invoices (Read, Insert, Update, Delete)
-- Allow authenticated users to view active or deleted invoices based on permissions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Allow view invoices') THEN
    CREATE POLICY "Allow view invoices" ON public.invoices
    FOR SELECT
    USING (
      auth.uid() = creator_id 
      OR auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('CEO', 'Admin', 'CFO'))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Allow update invoices') THEN
    CREATE POLICY "Allow update invoices" ON public.invoices
    FOR UPDATE
    USING (
      auth.uid() = creator_id 
      OR auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('CEO', 'Admin', 'CFO'))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Allow delete invoices') THEN
    CREATE POLICY "Allow delete invoices" ON public.invoices
    FOR DELETE
    USING (
      auth.uid() = creator_id 
      OR auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('CEO', 'Admin', 'CFO'))
    );
  END IF;
END $$;
