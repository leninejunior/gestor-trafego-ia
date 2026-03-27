import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserAccessControlService } from '@/lib/services/user-access-control';

type UserType = 'super_admin' | 'master' | 'regular';

type LimitValidation = {
  valid: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
};

export type AccessContext = {
  user: {
    id: string;
    email: string | null;
  };
  userType: UserType;
  organizationId: string | null;
  hasClientAccess: (userId: string, clientId: string) => Promise<boolean>;
  validateActionAgainstLimits: (organizationId: string, action: string) => Promise<LimitValidation>;
};

type AccessHandler = (request: NextRequest, context: AccessContext) => Promise<NextResponse>;

function forbidden(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

async function resolveUserType(userId: string): Promise<UserType> {
  const accessControl = new UserAccessControlService();

  if (await accessControl.isMasterUser(userId)) {
    const supabase = await createClient();
    const { data: superAdminData } = await supabase
      .from('super_admins')
      .select('user_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);

    if (Array.isArray(superAdminData) && superAdminData.length > 0) {
      return 'super_admin';
    }

    return 'master';
  }

  const supabase = await createClient();
  const { data: membershipData } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (Array.isArray(membershipData) && membershipData.length > 0) {
    return 'regular';
  }

  return 'regular';
}

async function resolveOrganizationId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1);

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const first = data[0] as { organization_id?: unknown };
  return typeof first.organization_id === 'string' ? first.organization_id : null;
}

async function buildAccessContext(): Promise<{ context: AccessContext | null; error: NextResponse | null }> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      context: null,
      error: NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    };
  }

  const accessControl = new UserAccessControlService();
  const userType = await resolveUserType(user.id);
  const organizationId = await resolveOrganizationId(user.id);

  return {
    context: {
      user: {
        id: user.id,
        email: user.email ?? null
      },
      userType,
      organizationId,
      hasClientAccess: async (targetUserId: string, clientId: string) =>
        accessControl.hasClientAccess(targetUserId, clientId),
      validateActionAgainstLimits: async () => ({ valid: true })
    },
    error: null
  };
}

function withAccessControl(
  options: { allowRegularUsers: boolean; errorMessage: string }
) {
  return (handler: AccessHandler) => {
    return async (request: NextRequest, _routeContext?: unknown): Promise<NextResponse> => {
      const { context, error } = await buildAccessContext();

      if (error || !context) {
        return error ?? NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      if (!options.allowRegularUsers && context.userType === 'regular') {
        return forbidden(options.errorMessage);
      }

      return handler(request, context);
    };
  };
}

export const createAccessControl = {
  readCampaigns: (_allowRegularUsers = true, errorMessage = 'Acesso negado para visualizar campanhas') =>
    withAccessControl({ allowRegularUsers: true, errorMessage }),

  writeCampaigns: (allowRegularUsers = false, errorMessage = 'Acesso negado para modificar campanhas') =>
    withAccessControl({ allowRegularUsers, errorMessage })
};
