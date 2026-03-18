/**
 * Property-based tests for access revocation immediacy (deterministic, in-memory)
 */

import * as fc from 'fast-check';

type Permissions = { read: boolean; write: boolean };

type AccessRecord = {
  id: string;
  userId: string;
  clientId: string;
  organizationId: string;
  permissions: Permissions;
  grantedBy: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
};

class MockUserManagementService {
  private users = new Map<string, { id: string; orgId: string; email: string }>();
  private clients = new Map<string, { id: string; orgId: string; name: string }>();
  private accessByUserClient = new Map<string, AccessRecord>();
  private counter = 0;

  constructor(
    users: Array<{ id: string; orgId: string; email: string }>,
    clients: Array<{ id: string; orgId: string; name: string }>
  ) {
    users.forEach((user) => this.users.set(user.id, user));
    clients.forEach((client) => this.clients.set(client.id, client));
  }

  resetAccess() {
    this.accessByUserClient.clear();
    this.counter = 0;
  }

  private key(userId: string, clientId: string): string {
    return `${userId}|${clientId}`;
  }

  async grantClientAccess(
    adminUserId: string,
    userId: string,
    clientId: string,
    permissions: Permissions = { read: true, write: false }
  ): Promise<void> {
    const user = this.users.get(userId);
    const client = this.clients.get(clientId);

    if (!user || !client) {
      throw new Error('Usuario ou cliente nao encontrado');
    }

    if (user.orgId !== client.orgId) {
      throw new Error('Usuario e cliente devem pertencer a mesma organizacao');
    }

    const now = new Date().toISOString();
    const key = this.key(userId, clientId);
    const existing = this.accessByUserClient.get(key);

    if (existing) {
      this.accessByUserClient.set(key, {
        ...existing,
        permissions,
        grantedBy: adminUserId,
        updatedAt: now,
        isActive: true,
      });
      return;
    }

    this.counter += 1;
    this.accessByUserClient.set(key, {
      id: `access-${this.counter}`,
      userId,
      clientId,
      organizationId: user.orgId,
      permissions,
      grantedBy: adminUserId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });
  }

  async revokeClientAccess(_adminUserId: string, userId: string, clientId: string): Promise<void> {
    const key = this.key(userId, clientId);
    const existing = this.accessByUserClient.get(key);
    if (!existing) {
      return;
    }

    this.accessByUserClient.set(key, {
      ...existing,
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
  }

  async hasClientAccess(userId: string, clientId: string): Promise<boolean> {
    const access = this.accessByUserClient.get(this.key(userId, clientId));
    return !!access?.isActive;
  }

  async listUserClientAccess(_adminUserId: string, userId: string): Promise<AccessRecord[]> {
    return Array.from(this.accessByUserClient.values()).filter(
      (access) => access.userId === userId && access.isActive
    );
  }

  getAccessRecord(userId: string, clientId: string): AccessRecord | null {
    return this.accessByUserClient.get(this.key(userId, clientId)) || null;
  }
}

describe('Property 8: Access Revocation Immediacy', () => {
  const testSuperAdminId = 'super-admin-1';
  const orgId = 'org-1';
  const testClientId = 'client-1';
  const firstUserId = 'user-1';
  const secondUserId = 'user-2';

  const service = new MockUserManagementService(
    [
      { id: firstUserId, orgId, email: 'user1@example.com' },
      { id: secondUserId, orgId, email: 'user2@example.com' },
    ],
    [{ id: testClientId, orgId, name: 'Client One' }]
  );

  beforeEach(() => {
    service.resetAccess();
  });

  test('should deny access immediately after revocation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          permissions: fc.record({
            read: fc.boolean(),
            write: fc.boolean(),
          }),
          delayMs: fc.integer({ min: 0, max: 20 }),
        }),
        async ({ permissions, delayMs }) => {
          service.resetAccess();

          await service.grantClientAccess(testSuperAdminId, firstUserId, testClientId, permissions);

          const hasAccessBefore = await service.hasClientAccess(firstUserId, testClientId);
          expect(hasAccessBefore).toBe(true);

          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          await service.revokeClientAccess(testSuperAdminId, firstUserId, testClientId);

          const hasAccessAfter = await service.hasClientAccess(firstUserId, testClientId);
          expect(hasAccessAfter).toBe(false);

          const userAccesses = await service.listUserClientAccess(testSuperAdminId, firstUserId);
          expect(userAccesses.find((access) => access.clientId === testClientId)).toBeUndefined();

          const dbAccess = service.getAccessRecord(firstUserId, testClientId);
          expect(dbAccess).toBeTruthy();
          expect(dbAccess?.isActive).toBe(false);

          const updatedAt = new Date(dbAccess!.updatedAt);
          const now = new Date();
          expect(now.getTime() - updatedAt.getTime()).toBeLessThan(5000);
        }
      ),
      { numRuns: 60 }
    );
  });

  test('should handle multiple revocations without errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          permissions: fc.record({
            read: fc.boolean(),
            write: fc.boolean(),
          }),
          revocationCount: fc.integer({ min: 1, max: 4 }),
        }),
        async ({ permissions, revocationCount }) => {
          service.resetAccess();

          await service.grantClientAccess(testSuperAdminId, firstUserId, testClientId, permissions);
          expect(await service.hasClientAccess(firstUserId, testClientId)).toBe(true);

          for (let i = 0; i < revocationCount; i += 1) {
            await expect(
              service.revokeClientAccess(testSuperAdminId, firstUserId, testClientId)
            ).resolves.not.toThrow();

            expect(await service.hasClientAccess(firstUserId, testClientId)).toBe(false);
          }
        }
      ),
      { numRuns: 40 }
    );
  });

  test('should maintain revocation state across service calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          permissions: fc.record({
            read: fc.boolean(),
            write: fc.boolean(),
          }),
          checkCount: fc.integer({ min: 2, max: 6 }),
        }),
        async ({ permissions, checkCount }) => {
          service.resetAccess();

          await service.grantClientAccess(testSuperAdminId, firstUserId, testClientId, permissions);
          await service.revokeClientAccess(testSuperAdminId, firstUserId, testClientId);

          for (let i = 0; i < checkCount; i += 1) {
            expect(await service.hasClientAccess(firstUserId, testClientId)).toBe(false);
            await new Promise((resolve) => setTimeout(resolve, 2));
          }
        }
      ),
      { numRuns: 40 }
    );
  });

  test('should not affect other user access when revoking specific user access', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          permissions1: fc.record({
            read: fc.boolean(),
            write: fc.boolean(),
          }),
          permissions2: fc.record({
            read: fc.boolean(),
            write: fc.boolean(),
          }),
        }),
        async ({ permissions1, permissions2 }) => {
          service.resetAccess();

          await service.grantClientAccess(testSuperAdminId, firstUserId, testClientId, permissions1);
          await service.grantClientAccess(testSuperAdminId, secondUserId, testClientId, permissions2);

          expect(await service.hasClientAccess(firstUserId, testClientId)).toBe(true);
          expect(await service.hasClientAccess(secondUserId, testClientId)).toBe(true);

          await service.revokeClientAccess(testSuperAdminId, firstUserId, testClientId);

          expect(await service.hasClientAccess(firstUserId, testClientId)).toBe(false);
          expect(await service.hasClientAccess(secondUserId, testClientId)).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });
});
