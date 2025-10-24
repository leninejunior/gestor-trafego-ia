import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  name: z.string().min(1, 'Nome é obrigatório'),
  organization_name: z.string().min(1, 'Nome da organização é obrigatório'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = signupSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { email, password, name, organization_name } = validationResult.data;

    const supabase = await createClient();

    // 1. Criar usuário no Supabase Auth
    console.log('📝 Creating user:', email);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        }
      }
    });

    if (authError) {
      console.error('❌ Auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      console.error('❌ No user returned from signup');
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    console.log('✅ User created:', authData.user.id);

    // 2. Aguardar e verificar se o usuário está realmente no banco
    console.log('⏳ Waiting for user to be fully persisted...');
    const serviceSupabase = createServiceClient();
    
    let userExists = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!userExists && attempts < maxAttempts) {
      attempts++;
      console.log(`🔍 Attempt ${attempts}/${maxAttempts}: Checking if user exists...`);
      
      const { data: userData, error: userError } = await serviceSupabase.auth.admin.getUserById(authData.user.id);
      
      if (userData && userData.user) {
        userExists = true;
        console.log('✅ User confirmed in database!');
      } else {
        console.log('⏳ User not yet available, waiting 1s...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!userExists) {
      console.error('❌ User not found after', maxAttempts, 'attempts');
      return NextResponse.json(
        { error: 'User creation timeout - please try again' },
        { status: 500 }
      );
    }

    // 4. Perfil será criado automaticamente via trigger do Supabase
    console.log('✅ User profile will be created via trigger');

    // 5. Usar service client para criar organização (bypassa RLS)
    
    const slug = organization_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + Date.now();

    console.log('📝 Creating organization:', organization_name);
    const { data: organization, error: orgError } = await serviceSupabase
      .from('organizations')
      .insert({
        name: organization_name,
        slug,
      })
      .select()
      .single();

    if (orgError) {
      console.error('❌ Organization error:', orgError);
      return NextResponse.json(
        { error: 'Failed to create organization: ' + orgError.message },
        { status: 400 }
      );
    }

    console.log('✅ Organization created:', organization.id);

    // 7. Criar membership (owner) usando service client
    console.log('📝 Creating membership for user:', authData.user.id);
    const { error: membershipError } = await serviceSupabase
      .from('memberships')
      .insert({
        user_id: authData.user.id,
        org_id: organization.id,
        organization_id: organization.id,
        role: 'owner',
        accepted_at: new Date().toISOString(),
        status: 'active',
      });

    if (membershipError) {
      console.error('❌ Membership error:', membershipError);
      
      // Rollback: deletar usuário e organização criados
      console.log('🔄 Rolling back: deleting user and organization...');
      
      try {
        await serviceSupabase.auth.admin.deleteUser(authData.user.id);
        await serviceSupabase.from('organizations').delete().eq('id', organization.id);
        console.log('✅ Rollback completed');
      } catch (rollbackError) {
        console.error('❌ Rollback error:', rollbackError);
      }
      
      return NextResponse.json(
        { error: 'Failed to create membership: ' + membershipError.message },
        { status: 400 }
      );
    }

    console.log('✅ Membership created successfully');

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      }
    });

  } catch (error) {
    console.error('❌ Signup error:', error);
    
    // Log detalhado do erro
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
