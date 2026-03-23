import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth, createAdminAuthErrorResponse } from '@/lib/middleware/admin-auth-improved';
import { createServiceClient } from '@/lib/supabase/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonBody = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return null;
}

function parseAllowedSenderIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value
    .map((item) => asString(item))
    .filter((item): item is string => item !== null);

  if (parsed.length !== value.length) {
    return null;
  }

  return parsed;
}

function parsePagination(value: string | null, fallback: number, min: number, max: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

async function ensureClientExists(supabase: ReturnType<typeof createServiceClient>, clientId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to verify client: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
}

async function parseRequestBody(request: NextRequest): Promise<JsonBody> {
  try {
    return (await request.json()) as JsonBody;
  } catch {
    throw new Error('Invalid JSON payload.');
  }
}

function getGroupIdFromBody(body: JsonBody): string | null {
  return asString(body.groupId) ?? asString(body.group_id);
}

function getClientIdFromBody(body: JsonBody): string | null {
  return asString(body.clientId) ?? asString(body.client_id);
}

function getGroupNameFromBody(body: JsonBody): string | null {
  return asString(body.groupName) ?? asString(body.group_name);
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const limit = parsePagination(searchParams.get('limit'), 50, 1, 200);
    const page = parsePagination(searchParams.get('page'), 1, 1, 10000);
    const offset = (page - 1) * limit;

    const groupId = asString(searchParams.get('group_id'));
    const clientId = asString(searchParams.get('client_id'));
    const search = asString(searchParams.get('search'));
    const isActive = parseBoolean(searchParams.get('is_active'));

    let query = supabase
      .from('whatsapp_group_bindings')
      .select(
        `
          id,
          group_id,
          group_name,
          client_id,
          is_active,
          can_read,
          can_manage_campaigns,
          allowed_sender_ids,
          created_at,
          updated_at,
          clients:clients(id, name)
        `,
        { count: 'exact' }
      )
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (groupId) {
      query = query.eq('group_id', groupId);
    }
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive);
    }
    if (search) {
      query = query.or(`group_id.ilike.%${search}%,group_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch bindings: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }

    const body = await parseRequestBody(request);
    const groupId = getGroupIdFromBody(body);
    const clientId = getClientIdFromBody(body);

    if (!groupId) {
      return NextResponse.json(
        { success: false, error: 'group_id is required.' },
        { status: 400 }
      );
    }

    if (!clientId || !UUID_REGEX.test(clientId)) {
      return NextResponse.json(
        { success: false, error: 'client_id must be a valid UUID.' },
        { status: 400 }
      );
    }

    const allowedSenderIdsRaw = body.allowedSenderIds ?? body.allowed_sender_ids;
    const allowedSenderIds = allowedSenderIdsRaw === undefined ? [] : parseAllowedSenderIds(allowedSenderIdsRaw);
    if (allowedSenderIds === null) {
      return NextResponse.json(
        { success: false, error: 'allowed_sender_ids must be an array of strings.' },
        { status: 400 }
      );
    }

    const canRead = parseBoolean(body.canRead ?? body.can_read);
    const canManageCampaigns = parseBoolean(body.canManageCampaigns ?? body.can_manage_campaigns);
    const isActive = parseBoolean(body.isActive ?? body.is_active);

    const supabase = createServiceClient();
    const clientExists = await ensureClientExists(supabase, clientId);
    if (!clientExists) {
      return NextResponse.json(
        { success: false, error: 'client_id does not exist.' },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = {
      group_id: groupId,
      group_name: getGroupNameFromBody(body),
      client_id: clientId,
      allowed_sender_ids: allowedSenderIds,
      updated_at: new Date().toISOString()
    };

    if (canRead !== null) {
      payload.can_read = canRead;
    }
    if (canManageCampaigns !== null) {
      payload.can_manage_campaigns = canManageCampaigns;
    }
    if (isActive !== null) {
      payload.is_active = isActive;
    }

    const { data, error } = await supabase
      .from('whatsapp_group_bindings')
      .upsert(payload as never, { onConflict: 'group_id' })
      .select(
        `
          id,
          group_id,
          group_name,
          client_id,
          is_active,
          can_read,
          can_manage_campaigns,
          allowed_sender_ids,
          created_at,
          updated_at
        `
      )
      .single();

    if (error) {
      throw new Error(`Failed to save binding: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Invalid JSON payload.' ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }

    const body = await parseRequestBody(request);
    const groupId = getGroupIdFromBody(body);

    if (!groupId) {
      return NextResponse.json(
        { success: false, error: 'group_id is required.' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    const groupName = getGroupNameFromBody(body);
    if (groupName !== null) {
      updateData.group_name = groupName;
    }

    const clientId = getClientIdFromBody(body);
    if (clientId !== null) {
      if (!UUID_REGEX.test(clientId)) {
        return NextResponse.json(
          { success: false, error: 'client_id must be a valid UUID.' },
          { status: 400 }
        );
      }
      updateData.client_id = clientId;
    }

    const allowedSenderIdsRaw = body.allowedSenderIds ?? body.allowed_sender_ids;
    if (allowedSenderIdsRaw !== undefined) {
      const allowedSenderIds = parseAllowedSenderIds(allowedSenderIdsRaw);
      if (allowedSenderIds === null) {
        return NextResponse.json(
          { success: false, error: 'allowed_sender_ids must be an array of strings.' },
          { status: 400 }
        );
      }
      updateData.allowed_sender_ids = allowedSenderIds;
    }

    const canRead = parseBoolean(body.canRead ?? body.can_read);
    if (canRead !== null) {
      updateData.can_read = canRead;
    }

    const canManageCampaigns = parseBoolean(body.canManageCampaigns ?? body.can_manage_campaigns);
    if (canManageCampaigns !== null) {
      updateData.can_manage_campaigns = canManageCampaigns;
    }

    const isActive = parseBoolean(body.isActive ?? body.is_active);
    if (isActive !== null) {
      updateData.is_active = isActive;
    }

    if (clientId !== null) {
      const supabase = createServiceClient();
      const clientExists = await ensureClientExists(supabase, clientId);
      if (!clientExists) {
        return NextResponse.json(
          { success: false, error: 'client_id does not exist.' },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json(
        { success: false, error: 'No fields to update.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('whatsapp_group_bindings')
      .update(updateData as never)
      .eq('group_id', groupId)
      .select(
        `
          id,
          group_id,
          group_name,
          client_id,
          is_active,
          can_read,
          can_manage_campaigns,
          allowed_sender_ids,
          created_at,
          updated_at
        `
      )
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update binding: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'group_id not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Invalid JSON payload.' ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }

    const body = await parseRequestBody(request);
    const groupId = getGroupIdFromBody(body);
    if (!groupId) {
      return NextResponse.json(
        { success: false, error: 'group_id is required.' },
        { status: 400 }
      );
    }

    const hardDelete = parseBoolean(body.hardDelete ?? body.hard_delete) === true;
    const supabase = createServiceClient();

    if (hardDelete) {
      const { error } = await supabase
        .from('whatsapp_group_bindings')
        .delete()
        .eq('group_id', groupId);

      if (error) {
        throw new Error(`Failed to delete binding: ${error.message}`);
      }

      return NextResponse.json({
        success: true,
        message: 'Binding deleted.'
      });
    }

    const { data, error } = await supabase
      .from('whatsapp_group_bindings')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      } as never)
      .eq('group_id', groupId)
      .select('id, group_id, is_active, updated_at')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to disable binding: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'group_id not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Binding disabled.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Invalid JSON payload.' ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
