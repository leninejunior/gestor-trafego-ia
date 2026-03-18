import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Obter perfil do usuário
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Se não existe perfil, criar um básico
    if (profileError && profileError.code === 'PGRST116') {
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          email: user.email,
          first_name: '',
          last_name: ''
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
      }

      return NextResponse.json({
        profile: newProfile,
        auth_user: {
          email: user.email,
          created_at: user.created_at
        }
      });
    }

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json({
      profile: profile,
      auth_user: {
        email: user.email,
        created_at: user.created_at
      }
    });

  } catch (error: any) {
    console.error('Error in profile GET:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Atualizar perfil do usuário
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { first_name, last_name, email } = body;

    // Validar dados
    if (!first_name && !last_name && !email) {
      return NextResponse.json({ 
        error: 'At least one field is required' 
      }, { status: 400 });
    }

    // Preparar dados para atualização
    const updateData: any = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;

    // Atualizar perfil na tabela user_profiles
    const { data: updatedProfile, error: profileError } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single();

    if (profileError) {
      // Se o perfil não existe, criar um novo
      if (profileError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            email: email || user.email,
            first_name: first_name || '',
            last_name: last_name || ''
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          profile: newProfile,
          message: 'Profile created successfully'
        });
      }

      console.error('Error updating profile:', profileError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Se o email foi alterado, também atualizar no Supabase Auth
    if (email && email !== user.email) {
      const { error: authUpdateError } = await supabase.auth.updateUser({
        email: email
      });

      if (authUpdateError) {
        console.error('Error updating auth email:', authUpdateError);
        // Não falhar completamente, apenas avisar
        return NextResponse.json({
          success: true,
          profile: updatedProfile,
          message: 'Profile updated, but email change requires confirmation',
          warning: 'Check your email to confirm the new address'
        });
      }
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: 'Profile updated successfully'
    });

  } catch (error: any) {
    console.error('Error in profile PATCH:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}