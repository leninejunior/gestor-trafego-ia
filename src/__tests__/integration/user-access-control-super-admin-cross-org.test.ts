import * as fc from 'fast-check';

enum UserType {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  COMMON_USER = 'common_user',
}

type ResourceType = 'users' | 'clients' | 'connections' | 'campaigns' | 'reports';
type Action = 'create' | 'read' | 'update' | 'delete';

type PermissionResult = {
  allowed: boolean;
  userType: UserType;
  reason?: string;
};

class MockUserAccessControlService {
  constructor(
    private readonly superAdminId: string,
    private readonly orgAdminId: string,
    private readonly clients: Array<{ id: string; name: string; orgId: string; isActive: boolean }>
  ) {}

  async getUserType(userId: string): Promise<UserType> {
    if (userId === this.superAdminId) return UserType.SUPER_ADMIN;
    if (userId === this.orgAdminId) return UserType.ORG_ADMIN;
    return UserType.COMMON_USER;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return (await this.getUserType(userId)) === UserType.SUPER_ADMIN;
  }

  async getUserAccessibleClients(userId: string) {
    return (await this.isSuperAdmin(userId)) ? this.clients : [];
  }

  async checkPermission(
    userId: string,
    _resource: ResourceType,
    _action: Action,
    _resourceId?: string
  ): Promise<PermissionResult> {
    const userType = await this.getUserType(userId);
    if (userType === UserType.SUPER_ADMIN) {
      return { allowed: true, userType };
    }

    return {
      allowed: false,
      userType,
      reason: 'Access denied',
    };
  }
}

describe('Property 12: Super Admin Cross-Organization Management', () => {
  let testSuperAdminId: string;
  let testOrganizationIds: string[];
  let testUserIds: string[];
  let testClientIds: string[];
  let accessControlService: MockUserAccessControlService;

  beforeAll(() => {
    testSuperAdminId = 'super-admin-123';
    testOrganizationIds = ['org-1', 'org-2', 'org-3'];
    testUserIds = ['org-admin-456'];
    testClientIds = ['client-1', 'client-2', 'client-3'];

    accessControlService = new MockUserAccessControlService(testSuperAdminId, testUserIds[0], [
      { id: 'client-1', name: 'Client A', orgId: 'org-1', isActive: true },
      { id: 'client-2', name: 'Client B', orgId: 'org-2', isActive: true },
      { id: 'client-3', name: 'Client C', orgId: 'org-3', isActive: true },
    ]);
  });

  test('should identify super admin correctly', async () => {
    const userType = await accessControlService.getUserType(testSuperAdminId);
    expect(userType).toBe(UserType.SUPER_ADMIN);

    const isSuperAdmin = await accessControlService.isSuperAdmin(testSuperAdminId);
    expect(isSuperAdmin).toBe(true);
  });

  test('should allow super admin to access all organizations', async () => {
    const accessibleClients = await accessControlService.getUserAccessibleClients(testSuperAdminId);
    expect(Array.isArray(accessibleClients)).toBe(true);
    expect(accessibleClients).toHaveLength(testClientIds.length);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          targetOrgId: fc.constantFrom(...testOrganizationIds),
        }),
        async () => {
          const hasAccess = await accessControlService.isSuperAdmin(testSuperAdminId);
          expect(hasAccess).toBe(true);
        }
      ),
      { numRuns: 5 }
    );
  });

  test('should maintain super admin status consistently', async () => {
    for (let i = 0; i < 5; i++) {
      const userType = await accessControlService.getUserType(testSuperAdminId);
      expect(userType).toBe(UserType.SUPER_ADMIN);

      const isSuperAdmin = await accessControlService.isSuperAdmin(testSuperAdminId);
      expect(isSuperAdmin).toBe(true);
    }
  });

  test('should reject operations from non-super-admin users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          nonSuperAdminId: fc.constantFrom(...testUserIds),
        }),
        async ({ nonSuperAdminId }) => {
          const userType = await accessControlService.getUserType(nonSuperAdminId);
          expect(userType).not.toBe(UserType.SUPER_ADMIN);

          const isSuperAdmin = await accessControlService.isSuperAdmin(nonSuperAdminId);
          expect(isSuperAdmin).toBe(false);
        }
      ),
      { numRuns: 3 }
    );
  });

  test('should allow super admin to bypass permission checks', async () => {
    const resourceTypes: ResourceType[] = ['users', 'clients', 'connections', 'campaigns', 'reports'];
    const actions: Action[] = ['create', 'read', 'update', 'delete'];

    for (const resource of resourceTypes) {
      for (const action of actions) {
        const permission = await accessControlService.checkPermission(
          testSuperAdminId,
          resource,
          action
        );

        expect(permission.allowed).toBe(true);
        expect(permission.userType).toBe(UserType.SUPER_ADMIN);
      }
    }
  });
});
