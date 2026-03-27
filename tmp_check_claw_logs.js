const { createClient } = require('@supabase/supabase-js');

(async () => {
  const sb = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
  );

  const gid = '556792612328-1440704122@g.us';

  const audit = await sb
    .from('whatsapp_command_audit_logs')
    .select('created_at,group_id,sender_id,action,status,error_message,response_message', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(20);

  const groupAudit = await sb
    .from('whatsapp_command_audit_logs')
    .select('created_at,group_id,sender_id,action,status,error_message,response_message', { count: 'exact' })
    .eq('group_id', gid)
    .order('created_at', { ascending: false })
    .limit(20);

  const webhookLogs = await sb
    .from('webhook_logs')
    .select('id,provider,event_type,status_code,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('AUDIT_ALL_ERR', audit.error ? audit.error.message : null, 'COUNT', audit.count);
  console.log(JSON.stringify(audit.data, null, 2));
  console.log('AUDIT_GROUP_ERR', groupAudit.error ? groupAudit.error.message : null, 'COUNT', groupAudit.count);
  console.log(JSON.stringify(groupAudit.data, null, 2));
  console.log('WEBHOOK_LOGS_ERR', webhookLogs.error ? webhookLogs.error.message : null, 'COUNT', webhookLogs.count);
  console.log(JSON.stringify(webhookLogs.data, null, 2));
})();