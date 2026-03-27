const { createClient } = require('@supabase/supabase-js');

(async () => {
  const sb = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
  );

  const gid = '556792612328-1440704122@g.us';

  const groupAudit = await sb
    .from('whatsapp_command_audit_logs')
    .select('created_at,group_id,sender_id,action,status,error_message,response_message')
    .eq('group_id', gid)
    .order('created_at', { ascending: false })
    .limit(10);

  const anyAudit = await sb
    .from('whatsapp_command_audit_logs')
    .select('created_at,group_id,sender_id,action,status,error_message,response_message')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('GROUP_AUDIT_ERR', groupAudit.error ? groupAudit.error.message : null);
  console.log(JSON.stringify(groupAudit.data, null, 2));
  console.log('ANY_AUDIT_ERR', anyAudit.error ? anyAudit.error.message : null);
  console.log(JSON.stringify(anyAudit.data, null, 2));
})();