-- Schema SIMPLIFICADO para captura de leads da landing page
-- Versão sem dependência da tabela users

-- Tabela de leads interessados
CREATE TABLE IF NOT EXISTS public.landing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('agency', 'company', 'traffic_manager', 'social_media', 'other')),
  message TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  source TEXT DEFAULT 'landing_page',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_landing_leads_email ON public.landing_leads(email);
CREATE INDEX IF NOT EXISTS idx_landing_leads_status ON public.landing_leads(status);
CREATE INDEX IF NOT EXISTS idx_landing_leads_created_at ON public.landing_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_leads_lead_type ON public.landing_leads(lead_type);

-- RLS Policies
ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;

-- Permitir inserção pública (para o formulário da landing page)
-- IMPORTANTE: Permite que qualquer pessoa (anônima) insira leads
CREATE POLICY "Allow public insert leads"
  ON public.landing_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Permitir que usuários autenticados vejam todos os leads
-- (Você pode refinar isso depois quando tiver a tabela users)
CREATE POLICY "Authenticated users can view all leads"
  ON public.landing_leads
  FOR SELECT
  TO authenticated
  USING (true);

-- Permitir que usuários autenticados atualizem leads
CREATE POLICY "Authenticated users can update leads"
  ON public.landing_leads
  FOR UPDATE
  TO authenticated
  USING (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_landing_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_landing_leads_updated_at_trigger ON public.landing_leads;
CREATE TRIGGER update_landing_leads_updated_at_trigger
  BEFORE UPDATE ON public.landing_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_landing_leads_updated_at();

-- Comentários
COMMENT ON TABLE public.landing_leads IS 'Leads capturados através da landing page';
COMMENT ON COLUMN public.landing_leads.lead_type IS 'Tipo de lead: agency, company, traffic_manager, social_media, other';
COMMENT ON COLUMN public.landing_leads.status IS 'Status do lead: new, contacted, qualified, converted, lost';
