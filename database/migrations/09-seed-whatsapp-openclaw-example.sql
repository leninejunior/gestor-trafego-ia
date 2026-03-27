-- Template de seed para vincular grupos WhatsApp ao cliente
-- Troque os valores de group_id, client_id e allowed_sender_ids.

-- 1) Exemplo: grupo com leitura + gestão de campanhas (pausar/ligar)
insert into whatsapp_group_bindings (
  group_id,
  group_name,
  client_id,
  is_active,
  can_read,
  can_manage_campaigns,
  allowed_sender_ids
) values (
  '1203XXXXXXXX@g.us',
  'Cliente XPTO - Performance',
  '00000000-0000-0000-0000-000000000000',
  true,
  true,
  true,
  array[
    '5511999999999@s.whatsapp.net',
    '5511888888888@s.whatsapp.net'
  ]
)
on conflict (group_id) do update set
  group_name = excluded.group_name,
  client_id = excluded.client_id,
  is_active = excluded.is_active,
  can_read = excluded.can_read,
  can_manage_campaigns = excluded.can_manage_campaigns,
  allowed_sender_ids = excluded.allowed_sender_ids,
  updated_at = now();

-- 2) Exemplo: grupo somente leitura
insert into whatsapp_group_bindings (
  group_id,
  group_name,
  client_id,
  is_active,
  can_read,
  can_manage_campaigns,
  allowed_sender_ids
) values (
  '1203YYYYYYYY@g.us',
  'Cliente XPTO - Somente Leitura',
  '00000000-0000-0000-0000-000000000000',
  true,
  true,
  false,
  array['5511999999999@s.whatsapp.net']
)
on conflict (group_id) do update set
  group_name = excluded.group_name,
  client_id = excluded.client_id,
  is_active = excluded.is_active,
  can_read = excluded.can_read,
  can_manage_campaigns = excluded.can_manage_campaigns,
  allowed_sender_ids = excluded.allowed_sender_ids,
  updated_at = now();

-- Verificação rápida
select
  group_id,
  group_name,
  client_id,
  is_active,
  can_read,
  can_manage_campaigns,
  allowed_sender_ids,
  created_at,
  updated_at
from whatsapp_group_bindings
order by updated_at desc;
