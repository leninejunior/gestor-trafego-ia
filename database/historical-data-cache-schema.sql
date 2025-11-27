-- =====================================================
-- Historical Data Cache Multi-Platform Schema
-- =======

-- ====
=================================================
-- Export System Tables
-- =====================================================

-- Tabela de jobs de exportação
CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  format VARCHAR(10) NOT NULL CHECK (format IN ('csv', 'json')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  file_path TEXT,
  file_size INTEGER,
  record_count INTEGER,
  error_message TEXT,
  
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_user ON export_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires ON export_jobs(expires_at) WHERE status = 'completed';

-- RLS para export_jobs
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own export jobs"
  ON export_jobs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own export jobs"
  ON export_jobs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own export jobs"
  ON export_jobs
  FOR UPDATE
  USING (user_id = auth.uid());

-- Tabela de logs de notificações de exportação
CREATE TABLE IF NOT EXISTS export_notifications_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  export_job_id UUID NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  type VARCHAR(50) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_notifications_job ON export_notifications_log(export_job_id);
CREATE INDEX IF NOT EXISTS idx_export_notifications_user ON export_notifications_log(user_id, sent_at DESC);

-- RLS para export_notifications_log
ALTER TABLE export_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own export notifications"
  ON export_notifications_log
  FOR SELECT
  USING (user_id = auth.uid());

-- Storage bucket para exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

-- RLS para storage bucket exports
CREATE POLICY "Users can upload their own exports"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own exports"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own exports"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
