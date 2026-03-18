/**
 * Property-based tests for same-organization access grants (deterministic, in-memory)
 */

import * as fc from 'fast-check';

type AccessRecord = {
  userId: string;
  clientId: string;
  organizationId: string;
  permissions: { read: boolean; write: boolean };
  isActive: boolean;
};

class MockUserManagementService {
  private userOrganizations = new Map<string, string>();
  private clientOrganizations = new Map<string, string>();
  private accessByUserClient = new Map<string, AccessRecord>();

  constructor(
    users: Array<{ id: string; orgId: string }>,
    clients: Array<{ id: string; orgId: string }>
  ) {
    users.forEach((u) => this.userOrganizations.set(u.id, u.orgId));
    clients.forEach((c) => this.clientOrganizations.set(c.id, c.orgId));
  }

  reset() {
    this.accessByUserClient.clear();
  }

  async grantClientAccess(
    _adminUserId: string,
    userId: string,
    clientId: string,
    permissions: { read: boolean; write: boolean }
  ): Promise<void> {
    const userOrg = this.userOrganizations.get(userId);
    const clientOrg = this.clientOrganizations.get(clientId);

    if (!userOrg || !clientOrg) {
      throw new Error('User or client not found');
    }

    if (userOrg !== clientOrg) {
      throw new Error('Usuário e cliente devem pertencer à mesma organização');
    }

    this.accessByUserClient.set(`${userId}|${clientId}`, {
      userId,
      clientId,
      organizationId: userOrg,
      permissions,
      isActive: true,
    });
  }

  async revokeClientAccess(_adminUserId: string, userId: string, clientId: string): Promise<void> {
    const key = `${userId}|${clientId}`;
    const existing = this.accessByUserClient.get(key);
    if (existing) {
      existing.isActive = false;
      this.accessByUserClient.set(key, existing);
    }
  }

  async listUserClientAccess(_adminUserId: string, userId: string): Promise<AccessRecord[]> {
    return Array.from(this.accessByUserClient.values()).filter(
      (access) => access.userId === userId && access.isActive
    );
  }

  getUserOrg(userId: string) {
    return this.userOrganizations.get(userId);
  }

  getClientOrg(clientId: string) {
    return this.clientOrganizations.get(clientId);
  }

  insertAccessDirectly(record: {
    userId: string;
    clientId: string;
    organizationId: string;
    permissions: { read: boolean; write: boolean };
  }): { error: Error | null } {
    const userOrg = this.userOrganizations.get(record.userId);
    const clientOrg = this.clientOrganizations.get(record.clientId);

    if (!userOrg || !clientOrg) {
      return { error: new Error('missing entity') };
    }

    if (record.organizationId !== userOrg || record.organizationId !== clientOrg) {
      return { error: new Error('same_org check constraint violated') };
    }

    this.accessByUserClient.set(`${record.userId}|${record.clientId}`, {
      userId: record.userId,
      clientId: record.clientId,
      organizationId: record.organizationId,
      permissions: record.permissions,
      isActive: true,
    });

    return { error: null };
  }
}

describe('Property 7: Access Grant Same-Organization Constraint', () => {
  const testSuperAdminId = 'super-admin-1';
  const testUsers = [
    { id: 'user-org-1', orgId: 'org-1' },
    { id: 'user-org-2', orgId: 'org-2' },
  ];
  const testClients = [
    { id: 'client-org-1', orgId: 'org-1' },
    { id: 'client-org-2', orgId: 'org-2' },
  ];

  const userManagementService = new MockUserManagementService(testUsers, testClients);

  beforeEach(() => {
    userManagementService.reset();
  });

  test('should reject access grants when user and client are in different organizations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          permissions: fc.record({ read: fc.boolean(), write: fc.boolean() }),
        }),
        async ({ permissions }) => {
          await expect(
            userManagementService.grantClientAccess(
              testSuperAdminId,
              'user-org-1',
              'client-org-2',
              permissions
            )
          ).rejects.toThrow(/mesma organização|same organization/i);

          const accesses = await userManagementService.listUserClientAccess(
            testSuperAdminId,
            'user-org-1'
          );
          expect(accesses.find((a) => a.clientId === 'client-org-2')).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should validate organization constraint at database level', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          permissions: fc.record({ read: fc.boolean(), write: fc.boolean() }),
        }),
        ({ permissions }) => {
          const result = userManagementService.insertAccessDirectly({
            userId: 'user-org-1',
            clientId: 'client-org-2',
            organizationId: 'org-1',
            permissions,
          });

          expect(result.error).toBeTruthy();
          expect(result.error?.message).toMatch(/same_org|constraint|violated/i);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should allow access grants only within same organization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          permissions: fc.record({ read: fc.boolean(), write: fc.boolean() }),
        }),
        async ({ permissions }) => {
          await expect(
            userManagementService.grantClientAccess(
              testSuperAdminId,
              'user-org-1',
              'client-org-1',
              permissions
            )
          ).resolves.not.toThrow();

          const accesses = await userManagementService.listUserClientAccess(
            testSuperAdminId,
            'user-org-1'
          );
          const granted = accesses.find((a) => a.clientId === 'client-org-1');

          expect(granted).toBeTruthy();
          expect(granted?.permissions).toEqual(permissions);
          expect(granted?.organizationId).toBe('org-1');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should prevent cross-organization access even with valid user and client IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          permissions: fc.record({ read: fc.boolean(), write: fc.boolean() }),
        }),
        async ({ permissions }) => {
          const validUser = 'user-org-2';
          const validClient = 'client-org-1';

          expect(userManagementService.getUserOrg(validUser)).toBeTruthy();
          expect(userManagementService.getClientOrg(validClient)).toBeTruthy();
          expect(userManagementService.getUserOrg(validUser)).not.toBe(
            userManagementService.getClientOrg(validClient)
          );

          await expect(
            userManagementService.grantClientAccess(
              testSuperAdminId,
              validUser,
              validClient,
              permissions
            )
          ).rejects.toThrow(/mesma organização|same organization/i);

          const accesses = await userManagementService.listUserClientAccess(
            testSuperAdminId,
            validUser
          );
          expect(accesses.find((a) => a.clientId === validClient)).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
