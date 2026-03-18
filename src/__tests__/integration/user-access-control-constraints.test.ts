/**
 * Property-based tests for access-control constraints (deterministic, in-memory)
 */

import * as fc from 'fast-check';

type ConstraintError = { message: string };

type MembershipInput = {
  user_id: string;
  organization_id: string;
  role: string;
  user_type: string;
  status: string;
};

type UserClientAccessInput = {
  user_id: string;
  client_id: string;
  organization_id: string;
  granted_by: string;
  permissions: { read: boolean; write: boolean };
  is_active: boolean;
  notes?: string | null;
};

class InMemoryAccessStore {
  private membershipByUserOrg = new Map<string, any>();
  private accessByUserClient = new Map<string, any>();
  private readonly clientOrganizationMap: Record<string, string>;
  private membershipCounter = 0;
  private accessCounter = 0;

  constructor(clientOrganizationMap: Record<string, string>) {
    this.clientOrganizationMap = clientOrganizationMap;
  }

  reset() {
    this.membershipByUserOrg.clear();
    this.accessByUserClient.clear();
    this.membershipCounter = 0;
    this.accessCounter = 0;
  }

  insertMembership(input: MembershipInput): { data: any | null; error: ConstraintError | null } {
    if (!['admin', 'member'].includes(input.role)) {
      return { data: null, error: { message: 'invalid role constraint' } };
    }

    const key = `${input.user_id}|${input.organization_id}`;
    if (this.membershipByUserOrg.has(key)) {
      return { data: null, error: { message: 'duplicate membership unique constraint' } };
    }

    this.membershipCounter += 1;
    const data = { id: `membership-${this.membershipCounter}`, ...input };
    this.membershipByUserOrg.set(key, data);
    return { data, error: null };
  }

  insertUserClientAccess(input: UserClientAccessInput): { data: any | null; error: ConstraintError | null } {
    const clientOrg = this.clientOrganizationMap[input.client_id];
    if (clientOrg !== input.organization_id) {
      return { data: null, error: { message: 'same_org check constraint violated' } };
    }

    const key = `${input.user_id}|${input.client_id}`;
    if (this.accessByUserClient.has(key)) {
      return { data: null, error: { message: 'duplicate user_client_access unique constraint' } };
    }

    this.accessCounter += 1;
    const data = { id: `access-${this.accessCounter}`, ...input };
    this.accessByUserClient.set(key, data);
    return { data, error: null };
  }
}

describe('User Access Control Constraints - Property Tests', () => {
  const testUserId = 'user-1';
  const testOrganizationId = 'org-1';
  const secondOrganizationId = 'org-2';
  const testClientId = 'client-1';

  const store = new InMemoryAccessStore({
    [testClientId]: testOrganizationId,
    'client-2': secondOrganizationId,
  });

  beforeEach(() => {
    store.reset();
  });

  describe('Membership Uniqueness', () => {
    test('prevents duplicate memberships for the same user-organization pair', () => {
      fc.assert(
        fc.property(
          fc.record({
            role: fc.constantFrom('admin', 'member'),
            userType: fc.constantFrom('regular', 'client'),
            status: fc.constantFrom('active', 'pending', 'inactive'),
          }),
          (membershipData) => {
            store.reset();

            const first = store.insertMembership({
              user_id: testUserId,
              organization_id: testOrganizationId,
              role: membershipData.role,
              user_type: membershipData.userType,
              status: membershipData.status,
            });

            expect(first.error).toBeNull();
            expect(first.data).toBeTruthy();

            const duplicate = store.insertMembership({
              user_id: testUserId,
              organization_id: testOrganizationId,
              role: membershipData.role,
              user_type: membershipData.userType,
              status: membershipData.status,
            });

            expect(duplicate.data).toBeNull();
            expect(duplicate.error).toBeTruthy();
            expect(duplicate.error?.message).toMatch(/duplicate|unique/i);
          }
        ),
        { numRuns: 25 }
      );
    });

    test('allows same user across different organizations', () => {
      fc.assert(
        fc.property(
          fc.record({
            role: fc.constantFrom('admin', 'member'),
            userType: fc.constantFrom('regular', 'client'),
          }),
          (membershipData) => {
            store.reset();

            const first = store.insertMembership({
              user_id: testUserId,
              organization_id: testOrganizationId,
              role: membershipData.role,
              user_type: membershipData.userType,
              status: 'active',
            });

            const second = store.insertMembership({
              user_id: testUserId,
              organization_id: secondOrganizationId,
              role: membershipData.role,
              user_type: membershipData.userType,
              status: 'active',
            });

            expect(first.error).toBeNull();
            expect(second.error).toBeNull();
            expect(first.data).toBeTruthy();
            expect(second.data).toBeTruthy();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('User Client Access Constraints', () => {
    test('prevents duplicate user-client access grants', () => {
      fc.assert(
        fc.property(
          fc.record({
            permissions: fc.record({
              read: fc.boolean(),
              write: fc.boolean(),
            }),
            isActive: fc.boolean(),
            notes: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: null }),
          }),
          (accessData) => {
            store.reset();

            const first = store.insertUserClientAccess({
              user_id: testUserId,
              client_id: testClientId,
              organization_id: testOrganizationId,
              granted_by: testUserId,
              permissions: accessData.permissions,
              is_active: accessData.isActive,
              notes: accessData.notes,
            });

            expect(first.error).toBeNull();
            expect(first.data).toBeTruthy();

            const duplicate = store.insertUserClientAccess({
              user_id: testUserId,
              client_id: testClientId,
              organization_id: testOrganizationId,
              granted_by: testUserId,
              permissions: accessData.permissions,
              is_active: accessData.isActive,
              notes: accessData.notes,
            });

            expect(duplicate.data).toBeNull();
            expect(duplicate.error).toBeTruthy();
            expect(duplicate.error?.message).toMatch(/duplicate|unique/i);
          }
        ),
        { numRuns: 25 }
      );
    });

    test('enforces same-organization constraint for user-client access', () => {
      fc.assert(
        fc.property(
          fc.record({
            permissions: fc.record({
              read: fc.boolean(),
              write: fc.boolean(),
            }),
          }),
          (accessData) => {
            store.reset();

            const invalid = store.insertUserClientAccess({
              user_id: testUserId,
              client_id: testClientId,
              organization_id: secondOrganizationId,
              granted_by: testUserId,
              permissions: accessData.permissions,
              is_active: true,
            });

            expect(invalid.data).toBeNull();
            expect(invalid.error).toBeTruthy();
            expect(invalid.error?.message).toMatch(/same_org|constraint/i);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Role Validation', () => {
    test('rejects invalid membership role values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !['admin', 'member'].includes(s)),
          (invalidRole) => {
            store.reset();

            const result = store.insertMembership({
              user_id: testUserId,
              organization_id: testOrganizationId,
              role: invalidRole,
              user_type: 'regular',
              status: 'active',
            });

            expect(result.data).toBeNull();
            expect(result.error).toBeTruthy();
            expect(result.error?.message).toMatch(/invalid role/i);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('accepts valid membership role values', () => {
      fc.assert(
        fc.property(fc.constantFrom('admin', 'member'), (validRole) => {
          store.reset();

          const result = store.insertMembership({
            user_id: testUserId,
            organization_id: testOrganizationId,
            role: validRole,
            user_type: 'regular',
            status: 'active',
          });

          expect(result.error).toBeNull();
          expect(result.data).toBeTruthy();
          expect(result.data.role).toBe(validRole);
        }),
        { numRuns: 20 }
      );
    });
  });
});
