/**
 * Account Creation Service
 * 
 * Automated account creation service for webhook-triggered user registration.
 * Handles user creation, organization setup, membership assignment, and welcome emails.
 * 
 * Requirements: 2.2, 2.3, 2.4
 */

import { createClient } from '@supabase/supabase-js';
import { EmailNotificationService } from '@/lib/services/email-notification-service';
import {
  AccountCreationResult,
  AccountCreationContext,
  AccountCreationError,
  WelcomeEmailData,
} from '@/lib/types/webhook';

export interface AccountCreationOptions {
  autoConfirmEmail?: boolean;
  sendWelcomeEmail?: boolean;
  generateTempPassword?: boolean;
  createOrganization?: boolean;
  assignOwnerRole?: boolean;
}

export interface UserCreationData {
  email: string;
  name: string;
  organization_name: string;
  cpf_cnpj?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export class AccountCreationService {
  private supabase;
  private emailService: EmailNotificationService;
  private defaultOptions: AccountCreationOptions = {
    autoConfirmEmail: true,
    sendWelcomeEmail: true,
    generateTempPassword: true,
    createOrganization: true,
    assignOwnerRole: true,
  };

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    options?: Partial<AccountCreationOptions>
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.emailService = new EmailNotificationService();
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Create complete account from subscription intent data
   */
  async createAccountFromIntent(
    intentData: any,
    context: AccountCreationContext,
    options?: Partial<AccountCreationOptions>
  ): Promise<AccountCreationResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      console.log('[AccountCreationService] Starting account creation for intent:', intentData.id);

      // Extract user data from intent
      const userData: UserCreationData = {
        email: intentData.user_email,
        name: intentData.user_name,
        organization_name: intentData.organization_name,
        cpf_cnpj: intentData.cpf_cnpj,
        phone: intentData.phone,
        metadata: {
          ...intentData.metadata,
          created_via: context.source,
          intent_id: intentData.id,
          plan_id: intentData.plan_id,
          billing_cycle: intentData.billing_cycle,
        },
      };

      // Check if user already exists
      const existingUser = await this.checkExistingUser(userData.email);
      if (existingUser) {
        console.log('[AccountCreationService] User already exists:', existingUser.id);
        
        // Update intent with existing user ID
        await this.updateIntentWithUser(intentData.id, existingUser.id);
        
        return {
          success: true,
          user_id: existingUser.id,
          organization_id: existingUser.organization_id,
          membership_id: existingUser.membership_id,
          welcome_email_sent: false,
          existing_user: true,
        };
      }

      // Create new user account
      const userResult = await this.createUser(userData, opts);
      console.log('[AccountCreationService] User created:', userResult.user_id);

      // Create organization if enabled
      let organizationResult = null;
      if (opts.createOrganization) {
        organizationResult = await this.createOrganization(
          userData.organization_name,
          userResult.user_id
        );
        console.log('[AccountCreationService] Organization created:', organizationResult.organization_id);
      }

      // Create membership if organization was created
      let membershipResult = null;
      if (organizationResult && opts.assignOwnerRole) {
        membershipResult = await this.createMembership(
          userResult.user_id,
          organizationResult.organization_id,
          'owner'
        );
        console.log('[AccountCreationService] Membership created:', membershipResult.membership_id);
      }

      // Update subscription intent with user info
      await this.updateIntentWithUser(
        intentData.id,
        userResult.user_id,
        organizationResult?.organization_id
      );

      // Send welcome email if enabled
      let welcomeEmailSent = false;
      if (opts.sendWelcomeEmail) {
        welcomeEmailSent = await this.sendWelcomeEmail({
          user: {
            id: userResult.user_id,
            email: userData.email,
            name: userData.name,
          },
          organization: organizationResult ? {
            id: organizationResult.organization_id,
            name: userData.organization_name,
          } : null,
          tempPassword: userResult.temp_password,
          context,
        });
      }

      console.log('[AccountCreationService] Account creation completed successfully');

      return {
        success: true,
        user_id: userResult.user_id,
        organization_id: organizationResult?.organization_id,
        membership_id: membershipResult?.membership_id,
        welcome_email_sent: welcomeEmailSent,
        existing_user: false,
      };

    } catch (error) {
      console.error('[AccountCreationService] Account creation failed:', error);
      throw new AccountCreationError(
        `Account creation failed: ${(error as Error).message}`,
        'ACCOUNT_CREATION_FAILED',
        { intent_id: intentData.id, context, error: (error as Error).message }
      );
    }
  }

  /**
   * Create user in Supabase Auth
   */
  private async createUser(
    userData: UserCreationData,
    options: AccountCreationOptions
  ): Promise<{ user_id: string; temp_password?: string }> {
    try {
      // Generate temporary password if needed
      const tempPassword = options.generateTempPassword 
        ? this.generateTempPassword()
        : undefined;

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
        email: userData.email,
        password: tempPassword || this.generateTempPassword(),
        email_confirm: options.autoConfirmEmail,
        user_metadata: {
          name: userData.name,
          organization_name: userData.organization_name,
          cpf_cnpj: userData.cpf_cnpj,
          phone: userData.phone,
          created_via: 'webhook_payment',
          ...userData.metadata,
        }
      });

      if (authError) {
        throw new Error(`Failed to create user in Auth: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('User creation returned no user data');
      }

      return {
        user_id: authData.user.id,
        temp_password: tempPassword,
      };

    } catch (error) {
      throw new Error(`User creation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Create organization
   */
  private async createOrganization(
    organizationName: string,
    userId: string
  ): Promise<{ organization_id: string }> {
    try {
      // Generate unique slug
      const slug = this.generateOrganizationSlug(organizationName);

      // Create organization
      const { data: newOrg, error: orgError } = await this.supabase
        .from('organizations')
        .insert({
          name: organizationName,
          slug: slug,
          created_by: userId,
        })
        .select()
        .single();

      if (orgError) {
        throw new Error(`Failed to create organization: ${orgError.message}`);
      }

      if (!newOrg) {
        throw new Error('Organization creation returned no data');
      }

      return {
        organization_id: newOrg.id,
      };

    } catch (error) {
      throw new Error(`Organization creation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Create organization membership
   */
  private async createMembership(
    userId: string,
    organizationId: string,
    role: string = 'owner'
  ): Promise<{ membership_id: string }> {
    try {
      const { data: membership, error: memberError } = await this.supabase
        .from('organization_memberships')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          role: role,
        })
        .select()
        .single();

      if (memberError) {
        throw new Error(`Failed to create membership: ${memberError.message}`);
      }

      if (!membership) {
        throw new Error('Membership creation returned no data');
      }

      return {
        membership_id: membership.id,
      };

    } catch (error) {
      throw new Error(`Membership creation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if user already exists
   */
  private async checkExistingUser(email: string): Promise<{
    id: string;
    organization_id?: string;
    membership_id?: string;
  } | null> {
    try {
      // Check in auth.users first
      const { data: authUsers, error: authError } = await this.supabase.auth.admin.listUsers();
      
      if (authError) {
        console.warn('Could not check existing auth users:', authError.message);
        return null;
      }

      const existingAuthUser = authUsers.users.find(user => user.email === email);
      if (!existingAuthUser) {
        return null;
      }

      // Get organization membership if exists
      const { data: membership } = await this.supabase
        .from('organization_memberships')
        .select('id, organization_id')
        .eq('user_id', existingAuthUser.id)
        .single();

      return {
        id: existingAuthUser.id,
        organization_id: membership?.organization_id,
        membership_id: membership?.id,
      };

    } catch (error) {
      console.warn('Error checking existing user:', error);
      return null;
    }
  }

  /**
   * Update subscription intent with user information
   */
  private async updateIntentWithUser(
    intentId: string,
    userId: string,
    organizationId?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        user_id: userId,
        metadata: {
          account_created_at: new Date().toISOString(),
        },
      };

      if (organizationId) {
        updateData.metadata.organization_id = organizationId;
      }

      const { error } = await this.supabase
        .from('subscription_intents')
        .update(updateData)
        .eq('id', intentId);

      if (error) {
        throw new Error(`Failed to update intent: ${error.message}`);
      }

    } catch (error) {
      console.error('Error updating intent with user info:', error);
      // Don't throw here as this is not critical for account creation
    }
  }

  /**
   * Send welcome email to new user
   */
  private async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    try {
      // Create welcome email template
      const template = this.createWelcomeEmailTemplate(data);
      
      // Send email using the email service
      const success = await this.emailService.sendEmail(data.user.email, template);
      
      if (success) {
        console.log('[AccountCreationService] Welcome email sent to:', data.user.email);
      } else {
        console.warn('[AccountCreationService] Failed to send welcome email to:', data.user.email);
      }

      return success;

    } catch (error) {
      console.error('[AccountCreationService] Error sending welcome email:', error);
      return false;
    }
  }

  /**
   * Create welcome email template
   */
  private createWelcomeEmailTemplate(data: WelcomeEmailData): {
    subject: string;
    html: string;
    text: string;
  } {
    const userName = data.user.name || data.organization?.name || 'there';
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/signin`;
    const resetPasswordUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password`;

    const subject = `🎉 Welcome to Ads Manager! Your account is ready`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb; margin: 0;">🎉 Welcome to Ads Manager!</h1>
    </div>
    
    <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hi ${userName},</h2>
        <p>Great news! Your payment has been confirmed and your Ads Manager account is now active and ready to use.</p>
    </div>

    <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #065f46; margin-top: 0;">📋 Account Details</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Email:</strong> ${data.user.email}</li>
            ${data.organization ? `<li><strong>Organization:</strong> ${data.organization.name}</li>` : ''}
            <li><strong>Account Status:</strong> Active</li>
        </ul>
    </div>

    ${data.tempPassword ? `
    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #92400e; margin-top: 0;">🔐 Set Your Password</h3>
        <p style="margin: 0;">For security, please set your own password by clicking the link below. This will ensure your account is fully secure.</p>
    </div>
    ` : ''}

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #1e40af; margin-top: 0;">🚀 Getting Started</h3>
        <ol style="margin: 0; padding-left: 20px;">
            <li>Set your password (if you haven't already)</li>
            <li>Connect your Meta Ads accounts</li>
            <li>Add your clients and organize your campaigns</li>
            <li>Set up automated reporting and alerts</li>
            <li>Explore advanced analytics and insights</li>
        </ol>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        ${data.tempPassword ? `
        <a href="${resetPasswordUrl}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500; margin-right: 10px;">
            Set Password
        </a>
        ` : ''}
        <a href="${loginUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
            Access Dashboard
        </a>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">
            Need help getting started? <a href="mailto:support@adsmanager.com" style="color: #2563eb;">Contact our support team</a><br>
            Questions about your subscription? <a href="mailto:billing@adsmanager.com" style="color: #2563eb;">Contact billing support</a>
        </p>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Ads Manager. All rights reserved.</p>
    </div>
</body>
</html>`;

    const text = `
Welcome to Ads Manager!

Hi ${userName},

Great news! Your payment has been confirmed and your Ads Manager account is now active and ready to use.

Account Details:
- Email: ${data.user.email}
${data.organization ? `- Organization: ${data.organization.name}` : ''}
- Account Status: Active

${data.tempPassword ? `
IMPORTANT: Set Your Password
For security, please set your own password by visiting: ${resetPasswordUrl}
` : ''}

Getting Started:
1. Set your password (if you haven't already)
2. Connect your Meta Ads accounts
3. Add your clients and organize your campaigns
4. Set up automated reporting and alerts
5. Explore advanced analytics and insights

Access Dashboard: ${loginUrl}
${data.tempPassword ? `Set Password: ${resetPasswordUrl}` : ''}

Need help? Contact support@adsmanager.com
Billing questions? Contact billing@adsmanager.com

© ${new Date().getFullYear()} Ads Manager. All rights reserved.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Generate temporary password
   */
  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const symbols = '!@#$%&*';
    let password = '';
    
    // Add at least one uppercase, one lowercase, one number, one symbol
    password += chars.charAt(Math.floor(Math.random() * 26)); // uppercase
    password += chars.charAt(Math.floor(Math.random() * 26) + 26); // lowercase
    password += chars.charAt(Math.floor(Math.random() * 10) + 52); // number
    password += symbols.charAt(Math.floor(Math.random() * symbols.length)); // symbol
    
    // Fill the rest randomly
    for (let i = 4; i < 12; i++) {
      const allChars = chars + symbols;
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Generate organization slug
   */
  private generateOrganizationSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    // Add timestamp suffix to ensure uniqueness
    const timestamp = Date.now().toString().slice(-6);
    return `${baseSlug}-${timestamp}`;
  }
}

// =============================================
// FACTORY FUNCTIONS
// =============================================

/**
 * Create a new AccountCreationService instance
 */
export function createAccountCreationService(
  options?: Partial<AccountCreationOptions>
): AccountCreationService {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return new AccountCreationService(supabaseUrl, supabaseKey, options);
}

// =============================================
// SINGLETON INSTANCE
// =============================================

let accountCreationServiceInstance: AccountCreationService | null = null;

/**
 * Get singleton instance of AccountCreationService
 */
export function getAccountCreationService(): AccountCreationService {
  if (!accountCreationServiceInstance) {
    accountCreationServiceInstance = createAccountCreationService();
  }
  return accountCreationServiceInstance;
}