-- Email Notifications Schema
-- This schema handles logging and tracking of email notifications sent for subscription events

-- Email notifications log table
CREATE TABLE IF NOT EXISTS email_notifications_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- subscription_confirmation, payment_failure, renewal_reminder, etc.
    recipient VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'sent', -- sent, failed, bounced
    error_message TEXT,
    email_service_id VARCHAR(100), -- External service ID (Resend, SendGrid, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email notification preferences table
CREATE TABLE IF NOT EXISTS email_notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- subscription_confirmation, payment_failure, etc.
    enabled BOOLEAN NOT NULL DEFAULT true,
    email_address VARCHAR(255), -- Override email address for this notification type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id, notification_type)
);

-- Email templates table (for customizable templates in the future)
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for system templates
    template_type VARCHAR(50) NOT NULL, -- subscription_confirmation, payment_failure, etc.
    name VARCHAR(100) NOT NULL,
    subject_template TEXT NOT NULL,
    html_template TEXT NOT NULL,
    text_template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system_template BOOLEAN NOT NULL DEFAULT false, -- System templates cannot be deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled email notifications table
CREATE TABLE IF NOT EXISTS scheduled_email_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notification_type VARCHAR(50) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    payload JSONB NOT NULL, -- Email data and template variables
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, sent, failed, cancelled
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_notifications_log_org_id ON email_notifications_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_log_user_id ON email_notifications_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_log_type ON email_notifications_log(type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_log_sent_at ON email_notifications_log(sent_at);

CREATE INDEX IF NOT EXISTS idx_email_notification_preferences_org_user ON email_notification_preferences(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_email_notification_preferences_type ON email_notification_preferences(notification_type);

CREATE INDEX IF NOT EXISTS idx_email_templates_org_id ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_scheduled_email_notifications_org_id ON scheduled_email_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_email_notifications_scheduled_for ON scheduled_email_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_email_notifications_status ON scheduled_email_notifications(status);

-- RLS Policies
ALTER TABLE email_notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_email_notifications ENABLE ROW LEVEL SECURITY;

-- Email notifications log policies
CREATE POLICY "Users can view their organization's email notifications log" ON email_notifications_log
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM memberships 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "System can insert email notifications log" ON email_notifications_log
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update email notifications log" ON email_notifications_log
    FOR UPDATE USING (true);

-- Email notification preferences policies
CREATE POLICY "Users can view their organization's notification preferences" ON email_notification_preferences
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM memberships 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can manage their own notification preferences" ON email_notification_preferences
    FOR ALL USING (
        user_id = auth.uid() AND
        organization_id IN (
            SELECT organization_id FROM memberships 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Email templates policies
CREATE POLICY "Users can view email templates for their organization" ON email_templates
    FOR SELECT USING (
        organization_id IS NULL OR -- System templates
        organization_id IN (
            SELECT organization_id FROM memberships 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Organization admins can manage email templates" ON email_templates
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM memberships 
            WHERE user_id = auth.uid() AND status = 'active' AND role IN ('admin', 'owner')
        )
    );

-- Scheduled email notifications policies
CREATE POLICY "Users can view their organization's scheduled notifications" ON scheduled_email_notifications
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM memberships 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "System can manage scheduled email notifications" ON scheduled_email_notifications
    FOR ALL USING (true);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_email_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_scheduled_email_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating timestamps
CREATE TRIGGER update_email_notification_preferences_updated_at
    BEFORE UPDATE ON email_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_email_notification_preferences_updated_at();

CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_email_templates_updated_at();

CREATE TRIGGER update_scheduled_email_notifications_updated_at
    BEFORE UPDATE ON scheduled_email_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_email_notifications_updated_at();

-- Insert default system email templates
INSERT INTO email_templates (template_type, name, subject_template, html_template, text_template, is_system_template) VALUES
('subscription_confirmation', 'Default Subscription Confirmation', 
 'Welcome to Ads Manager! Your {{planName}} subscription is active',
 '<!DOCTYPE html><html><body><h1>Welcome to Ads Manager!</h1><p>Your {{planName}} subscription is now active.</p></body></html>',
 'Welcome to Ads Manager! Your {{planName}} subscription is now active.',
 true),
('payment_failure', 'Default Payment Failure', 
 'Payment Failed - Action Required',
 '<!DOCTYPE html><html><body><h1>Payment Issue</h1><p>We were unable to process your payment.</p></body></html>',
 'Payment Issue: We were unable to process your payment.',
 true),
('renewal_reminder', 'Default Renewal Reminder', 
 'Your subscription renews in {{daysUntilRenewal}} days',
 '<!DOCTYPE html><html><body><h1>Renewal Reminder</h1><p>Your subscription renews in {{daysUntilRenewal}} days.</p></body></html>',
 'Renewal Reminder: Your subscription renews in {{daysUntilRenewal}} days.',
 true)
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE email_notifications_log IS 'Logs all email notifications sent for subscription events';
COMMENT ON TABLE email_notification_preferences IS 'User preferences for email notifications';
COMMENT ON TABLE email_templates IS 'Email templates for different notification types';
COMMENT ON TABLE scheduled_email_notifications IS 'Queue for scheduled email notifications';

COMMENT ON COLUMN email_notifications_log.type IS 'Type of notification: subscription_confirmation, payment_failure, renewal_reminder, etc.';
COMMENT ON COLUMN email_notifications_log.status IS 'Status: sent, failed, bounced';
COMMENT ON COLUMN email_notification_preferences.enabled IS 'Whether this notification type is enabled for the user';
COMMENT ON COLUMN email_templates.is_system_template IS 'System templates cannot be deleted or modified by users';
COMMENT ON COLUMN scheduled_email_notifications.payload IS 'JSON data containing email template variables and content';