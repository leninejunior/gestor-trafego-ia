-- =============================================
-- Migration: User Access Audit Log System
-- Date: 2025-12-22
-- Description: Creates comprehensive audit logging for user access control system
-- Requirements: 7.5
-- =============================================

-- 1. Create audit log table for user access control events
CREATE TABLE IF NOT EXISTS user_access_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event identification
    event_type TEXT NOT NULL, -- 'user_type_change', 'access_grant', 'access_revoke', 'access_denied', 'user_create', 'user_update', 'user_delete'
    event_category TEXT NOT NULL, -- 'user_management', 'access_control', 'authentication', 'authorization'
    
    -- User information
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who performed the action
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who was affected (if applicable)
    
    -- Organization context
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    
    -- Event details
    action TEXT NOT NULL, -- Specific action taken
    resource_type TEXT, -- Type of resource affected ('user', 'client_access', 'user_type', etc.)
    resource_id TEXT, -- ID of the affected resource
    
    -- Before/after state for changes
    old_values JSONB, -- Previous state (for updates)
    new_values JSONB, -- New state (for creates/updates)
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id TEXT, -- For correlating with application logs
    session_id TEXT,
    
    -- Result information
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    error_code TEXT,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_event_type CHECK (
        event_type IN (
            'user_type_change',
            'access_grant', 
            'access_revoke',
            'access_denied',
            'user_create',
            'user_update', 
            'user_delete',
            'login_attempt',
            'permission_check',
            'plan_limit_exceeded'
        )
    ),
    CONSTRAINT valid_event_category CHECK (
        event_category IN (
            'user_management',
            'access_control', 
            'authentication',
            'authorization',
            'security'
        )
    )
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_actor ON user_access_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_target ON user_access_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_org ON user_access_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_client ON user_access_audit_log(client_id);
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_event_type ON user_access_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_category ON user_access_audit_log(event_category);
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_created_at ON user_access_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_success ON user_access_audit_log(success);
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_resource ON user_access_audit_log(resource_type, resource_id);

-- 3. Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_actor_date ON user_access_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_org_date ON user_access_audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_access_audit_log_event_success ON user_access_audit_log(event_type, success, created_at DESC);

-- 4. Enable RLS on audit log table
ALTER TABLE user_access_audit_log ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for audit log

-- Super admins can see all audit logs
CREATE POLICY "super_admins_audit_log_all" ON user_access_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.user_id = auth.uid() AND sa.is_active = true
        )
    );

-- Organization admins can see logs related to their organization
CREATE POLICY "org_admins_audit_log_org" ON user_access_audit_log
    FOR SELECT USING (
        organization_id IN (
            SELECT m.organization_id 
            FROM memberships m
            WHERE m.user_id = auth.uid() AND m.role = 'admin'
        )
    );

-- Users can see their own audit logs (as target or actor)
CREATE POLICY "users_audit_log_self" ON user_access_audit_log
    FOR SELECT USING (
        actor_user_id = auth.uid() OR target_user_id = auth.uid()
    );

-- Service role has full access for logging
CREATE POLICY "service_role_audit_log_all" ON user_access_audit_log
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Create function to log user access events
CREATE OR REPLACE FUNCTION log_user_access_event(
    p_event_type TEXT,
    p_event_category TEXT,
    p_actor_user_id UUID,
    p_target_user_id UUID DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL,
    p_client_id UUID DEFAULT NULL,
    p_action TEXT DEFAULT NULL,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id TEXT DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL,
    p_error_code TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO user_access_audit_log (
        event_type,
        event_category,
        actor_user_id,
        target_user_id,
        organization_id,
        client_id,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values,
        ip_address,
        user_agent,
        request_id,
        session_id,
        success,
        error_message,
        error_code,
        metadata
    ) VALUES (
        p_event_type,
        p_event_category,
        p_actor_user_id,
        p_target_user_id,
        p_organization_id,
        p_client_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_old_values,
        p_new_values,
        p_ip_address,
        p_user_agent,
        p_request_id,
        p_session_id,
        p_success,
        p_error_message,
        p_error_code,
        p_metadata
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$func$;

-- 7. Create view for audit log with user details
CREATE OR REPLACE VIEW user_access_audit_log_detailed AS
SELECT 
    ual.*,
    actor.email as actor_email,
    actor.raw_user_meta_data->>'name' as actor_name,
    target.email as target_email,
    target.raw_user_meta_data->>'name' as target_name,
    o.name as organization_name,
    c.name as client_name
FROM user_access_audit_log ual
LEFT JOIN auth.users actor ON actor.id = ual.actor_user_id
LEFT JOIN auth.users target ON target.id = ual.target_user_id
LEFT JOIN organizations o ON o.id = ual.organization_id
LEFT JOIN clients c ON c.id = ual.client_id;

-- 8. Create function to get audit statistics
CREATE OR REPLACE FUNCTION get_audit_statistics(
    p_organization_id UUID DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    stats JSONB;
BEGIN
    WITH audit_stats AS (
        SELECT 
            event_type,
            event_category,
            success,
            COUNT(*) as count
        FROM user_access_audit_log
        WHERE created_at BETWEEN p_start_date AND p_end_date
        AND (p_organization_id IS NULL OR organization_id = p_organization_id)
        GROUP BY event_type, event_category, success
    ),
    summary_stats AS (
        SELECT 
            COUNT(*) as total_events,
            COUNT(*) FILTER (WHERE success = true) as successful_events,
            COUNT(*) FILTER (WHERE success = false) as failed_events,
            COUNT(DISTINCT actor_user_id) as unique_actors,
            COUNT(DISTINCT target_user_id) as unique_targets
        FROM user_access_audit_log
        WHERE created_at BETWEEN p_start_date AND p_end_date
        AND (p_organization_id IS NULL OR organization_id = p_organization_id)
    )
    SELECT jsonb_build_object(
        'period', jsonb_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date
        ),
        'summary', row_to_json(s.*),
        'by_event_type', jsonb_object_agg(
            a.event_type, 
            jsonb_build_object(
                'total', a.count,
                'success_rate', 
                CASE 
                    WHEN COUNT(*) FILTER (WHERE a.success = true) > 0 
                    THEN ROUND(
                        (COUNT(*) FILTER (WHERE a.success = true)::numeric / COUNT(*)::numeric) * 100, 2
                    )
                    ELSE 0 
                END
            )
        ),
        'by_category', jsonb_object_agg(
            a.event_category,
            a.count
        )
    ) INTO stats
    FROM audit_stats a
    CROSS JOIN summary_stats s
    GROUP BY s.total_events, s.successful_events, s.failed_events, s.unique_actors, s.unique_targets;
    
    RETURN COALESCE(stats, '{}'::jsonb);
END;
$func$;

-- 9. Create function to clean old audit logs (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
    p_retention_days INTEGER DEFAULT 365
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_access_audit_log
    WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$func$;

-- 10. Add comments for documentation
COMMENT ON TABLE user_access_audit_log IS 'Comprehensive audit log for user access control system events';
COMMENT ON COLUMN user_access_audit_log.event_type IS 'Type of event (user_type_change, access_grant, etc.)';
COMMENT ON COLUMN user_access_audit_log.event_category IS 'Category of event (user_management, access_control, etc.)';
COMMENT ON COLUMN user_access_audit_log.actor_user_id IS 'User who performed the action';
COMMENT ON COLUMN user_access_audit_log.target_user_id IS 'User who was affected by the action';
COMMENT ON COLUMN user_access_audit_log.old_values IS 'Previous state before the change (JSON)';
COMMENT ON COLUMN user_access_audit_log.new_values IS 'New state after the change (JSON)';
COMMENT ON COLUMN user_access_audit_log.metadata IS 'Additional context and metadata (JSON)';

COMMENT ON FUNCTION log_user_access_event IS 'Function to log user access control events with full context';
COMMENT ON FUNCTION get_audit_statistics IS 'Get audit statistics for a time period and optional organization';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Clean up old audit logs based on retention policy';

COMMENT ON VIEW user_access_audit_log_detailed IS 'Audit log with joined user and organization details for reporting';

-- Migration completed successfully
RAISE NOTICE 'User Access Audit Log system created successfully. Migration complete.';