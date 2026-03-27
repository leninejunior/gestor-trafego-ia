-- 20260321184000_expose_campaign_squad_api_schema.sql
-- Ensure PostgREST exposes campaign_squad schema for Supabase API access.

DO $do$
BEGIN
  BEGIN
    EXECUTE 'ALTER ROLE authenticator SET pgrst.db_schemas = ''public,graphql_public,campaign_squad''';
    RAISE NOTICE 'Updated authenticator pgrst.db_schemas to include campaign_squad.';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping ALTER ROLE authenticator (insufficient privileges).';
    WHEN undefined_object THEN
      RAISE NOTICE 'Skipping ALTER ROLE authenticator (role not found).';
  END;
END;
$do$;

NOTIFY pgrst, 'reload config';

GRANT USAGE ON SCHEMA campaign_squad TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA campaign_squad TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA campaign_squad GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
