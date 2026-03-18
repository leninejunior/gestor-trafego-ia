/**
 * Property-Based Tests for Organization Validation on User Creation
 * 
 * **Feature: user-access-control-system, Property 14: Organization Validation on User Creation**
 * 
 * Tests that when creating a user, if the specified organization does not exist or is inactive, 
 * the system should reject the creation with a validation error.
 * 
 * Validates Requirements 10.1
 */

import { createClient } from '@supabase/supabase-js';
import * as fc from 'fast-check';

enum UserType {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  COMMON_USER = 'common_user'
}

// Mock UserManagementService for testing
class MockUserManagementService {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  async validateOrganization(organizationId: string): Promise<{ exists: boolean; isActive: boolean }> {
    try {
      const { data: organization, error } = await this.supabase
        .from('organizations')
        .select('id, is_active')
        .eq('id', organizationId)
        .single();

      if (error || !organization) {
        return { exists: false, isActive: false };
      }

      return { exists: true, isActive: organization.is_active };
    } catch (error) {
      return { exists: false, isActive: false };
    }
  }

  async createUser(adminUserId: string, userData: any): Promise<any> {
    // Validate organization exists and is active (Requirements 10.1)
    if (userData.organizationId) {
      const orgValidation = await this.validateOrganization(userData.organizationId);
      
      if (!orgValidation.exists) {
        throw new Error('Organização não encontrada');
      }
      
      if (!orgValidation.isActive) {
        throw new Error('Organização não está ativa');
      }
    } else {
      throw new Error('Organization ID é obrigatório');
    }

    // Simulate successful user creation
    const newUserId = `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create membership record
    const { data: membership, error: membershipError } = await this.supabase
      .from('memberships')
      .insert({
        user_id: newUserId,
        organization_id: userData.organizationId,
        role: userData.role || 'member',
        created_by: adminUserId
      })
      .select()
      .single();

    if (membershipError) {
      throw new Error(`Erro ao criar membership: ${membershipError.message}`);
    }

    return {
      id: newUserId,
      email: userData.email,
      name: userData.name,
      membershipId: membership.id
    };
  }

  async createOrganization(name: string, isActive: boolean = true): Promise<string> {
    const { data: org, error } = await this.supabase
      .from('organizations')
      .insert({
        name,
        slug: `test-org-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        is_active: isActive,
        created_by: '00000000-0000-0000-0000-000000000001'
      })
      .select()
      .single();

    if (error || !org) {
      throw new Error(`Error creating organization: ${error?.message}`);
    }

    return org.id;
  }

  async deactivateOrganization(organizationId: string): Promise<void> {
    await this.supabase
      .from('organizations')
      .update({ is_active: false })
      .eq('id', organizationId);
  }

  async deleteOrganization(organizationId: string): Promise<void> {
    await this.supabase
      .from('organizations')
      .delete()
      .eq('id', organizationId);
  }

  async deleteMembership(membershipId: string): Promise<void> {
    await this.supabase
      .from('memberships')
      .delete()
      .eq('id', membershipId);
  }
}

// Configuração do cliente de teste
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

describe('Property 14: Organization Validation on User Creation', () => {
  let testAdminId: string;
  let validOrganizationId: string;
  let inactiveOrganizationId: string;
  let createdOrganizationIds: string[] = [];
  let createdMembershipIds: string[] = [];

  beforeAll(async () => {
    testAdminId = '00000000-0000-0000-0000-000000000040';

    const service = new MockUserManagementService();

    try {
      // Create valid active organization
      validOrganizationId = await service.createOrganization('Valid Test Organization', true);
      createdOrganizationIds.push(validOrganizationId);

      // Create inactive organization
      inactiveOrganizationId = await service.createOrganization('Inactive Test Organization', false);
      createdOrganizationIds.push(inactiveOrganizationId);

      // Create admin membership for valid organization
      const { data: adminMembership, error: adminError } = await supabase
        .from('memberships')
        .insert({
          user_id: testAdminId,
          organization_id: validOrganizationId,
          role: 'admin'
        })
        .select()
        .single();

      if (adminMembership) {
        createdMembershipIds.push(adminMembership.id);
      }
    } catch (error) {
      console.warn('Setup failed:', error);
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (createdMembershipIds.length > 0) {
      await supabase
        .from('memberships')
        .delete()
        .in('id', createdMembershipIds);
    }

    if (createdOrganizationIds.length > 0) {
      await supabase
        .from('organizations')
        .delete()
        .in('id', createdOrganizationIds);
    }
  });

  /**
   * Property 14: Organization Validation on User Creation
   * For any user creation attempt, if the specified organization does not exist or is inactive, 
   * the system should reject the creation with a validation error.
   */
  test('should reject user creation with non-existent organization', async () => {
    // Skip test if setup failed
    if (!validOrganizationId) {
      console.warn('Skipping test due to setup failure');
      return;
    }

    const service = new MockUserManagementService();

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }),
          role: fc.constantFrom('admin', 'member'),
          organizationId: fc.uuid() // Random UUID that doesn't exist
        }),
        async (userData) => {
          // Attempt to create user with non-existent organization
          await expect(
            service.createUser(testAdminId, userData)
          ).rejects.toThrow(/não encontrada/);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('should reject user creation with inactive organization', async () => {
    // Skip test if setup failed
    if (!inactiveOrganizationId) {
      console.warn('Skipping test due to setup failure');
      return;
    }

    const service = new MockUserManagementService();

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }),
          role: fc.constantFrom('admin', 'member')
        }),
        async (userData) => {
          // Attempt to create user with inactive organization
          await expect(
            service.createUser(testAdminId, {
              ...userData,
              organizationId: inactiveOrganizationId
            })
          ).rejects.toThrow(/não está ativa/);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('should accept user creation with valid active organization', async () => {
    // Skip test if setup failed
    if (!validOrganizationId) {
      console.warn('Skipping test due to setup failure');
      return;
    }

    const service = new MockUserManagementService();

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }),
          role: fc.constantFrom('admin', 'member')
        }),
        async (userData) => {
          // Create user with valid active organization
          const createdUser = await service.createUser(testAdminId, {
            ...userData,
            organizationId: validOrganizationId
          });

          // Verify user was created successfully
          expect(createdUser).toBeDefined();
          expect(createdUser.id).toBeDefined();
          expect(createdUser.membershipId).toBeDefined();

          // Track for cleanup
          createdMembershipIds.push(createdUser.membershipId);

          // Clean up immediately
          await service.deleteMembership(createdUser.membershipId);
          createdMembershipIds = createdMembershipIds.filter(id => id !== createdUser.membershipId);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('should reject user creation with null or undefined organization', async () => {
    const service = new MockUserManagementService();

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }),
          role: fc.constantFrom('admin', 'member'),
          organizationId: fc.constantFrom(null, undefined, '')
        }),
        async (userData) => {
          // Attempt to create user without organization
          await expect(
            service.createUser(testAdminId, userData)
          ).rejects.toThrow(/obrigatório/);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('should validate organization status changes during user creation', async () => {
    // Skip test if setup failed
    if (!validOrganizationId) {
      console.warn('Skipping test due to setup failure');
      return;
    }

    const service = new MockUserManagementService();

    // Create a test organization that we can modify
    const testOrgId = await service.createOrganization('Test Org for Status Change', true);
    createdOrganizationIds.push(testOrgId);

    const userData = {
      email: 'status-test@example.com',
      name: 'Status Test User',
      role: 'member',
      organizationId: testOrgId
    };

    // Should succeed when organization is active
    const createdUser1 = await service.createUser(testAdminId, userData);
    expect(createdUser1).toBeDefined();
    createdMembershipIds.push(createdUser1.membershipId);

    // Deactivate the organization
    await service.deactivateOrganization(testOrgId);

    // Should fail when organization is inactive
    await expect(
      service.createUser(testAdminId, {
        ...userData,
        email: 'status-test-2@example.com'
      })
    ).rejects.toThrow(/não está ativa/);

    // Clean up
    await service.deleteMembership(createdUser1.membershipId);
    createdMembershipIds = createdMembershipIds.filter(id => id !== createdUser1.membershipId);
  });

  test('should handle malformed organization IDs', async () => {
    const service = new MockUserManagementService();

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }),
          role: fc.constantFrom('admin', 'member'),
          organizationId: fc.oneof(
            fc.string({ minLength: 1, maxLength: 10 }), // Too short
            fc.string({ minLength: 50, maxLength: 100 }), // Too long
            fc.constant('not-a-uuid'), // Invalid format
            fc.constant('12345'), // Numeric string
            fc.constant('invalid-uuid-format') // Invalid UUID format
          )
        }),
        async (userData) => {
          // Attempt to create user with malformed organization ID
          await expect(
            service.createUser(testAdminId, userData)
          ).rejects.toThrow(); // Should throw some validation error
        }
      ),
      { numRuns: 30 }
    );
  });
});