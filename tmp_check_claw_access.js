const { createClient } = require('@supabase/supabase-js');

(async () => {
  const sb = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
  );

  const groupId = '556792612328-1440704122@g.us';

  const binding = await sb
    .from('whatsapp_group_bindings')
    .select('id,group_id,group_name,client_id,is_active,can_read,can_manage_campaigns,allowed_sender_ids,updated_at')
    .eq('group_id', groupId)
    .maybeSingle();

  const audit = await sb
    .from('whatsapp_command_audit_logs')
    .select('created_at,group_id,sender_id,action,status,error_message,response_message')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('BINDING');
  console.log(JSON.stringify(binding.data, null, 2));
  console.log('AUDIT');
  console.log(JSON.stringify(audit.data, null, 2));
})();