import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notificationService } from '@/lib/notifications/notification-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');

    // Buscar notificações
    const notifications = await notificationService.getUserNotifications(user.id, {
      limit,
      offset,
      unreadOnly,
      category: category || undefined,
      priority: priority || undefined
    });

    // Buscar contagem de não lidas
    const unreadCount = await notificationService.getUnreadCount(user.id);

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          limit,
          offset,
          total: notifications.length
        }
      }
    });

  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, notificationId, notificationIds } = body;

    switch (action) {
      case 'mark_read':
        if (notificationId) {
          const success = await notificationService.markAsRead(notificationId, user.id);
          return NextResponse.json({
            success,
            message: success ? 'Notificação marcada como lida' : 'Erro ao marcar como lida'
          });
        }
        break;

      case 'mark_all_read':
        const success = await notificationService.markAllAsRead(user.id);
        return NextResponse.json({
          success,
          message: success ? 'Todas as notificações marcadas como lidas' : 'Erro ao marcar todas como lidas'
        });

      case 'delete':
        if (notificationId) {
          const success = await notificationService.deleteNotification(notificationId, user.id);
          return NextResponse.json({
            success,
            message: success ? 'Notificação deletada' : 'Erro ao deletar notificação'
          });
        }
        break;

      case 'delete_multiple':
        if (notificationIds && Array.isArray(notificationIds)) {
          let deletedCount = 0;
          for (const id of notificationIds) {
            const success = await notificationService.deleteNotification(id, user.id);
            if (success) deletedCount++;
          }
          return NextResponse.json({
            success: true,
            message: `${deletedCount} notificações deletadas`,
            deletedCount
          });
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        );
    }

    return NextResponse.json(
      { error: 'Parâmetros inválidos' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Erro ao processar ação de notificação:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}