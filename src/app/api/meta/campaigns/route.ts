// Dados de teste para campanhas - REMOVIDO
// const testCampaigns = []; // Removido completamente

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const adAccountId = searchParams.get('adAccountId');
  
  console.log('🔍 [CAMPAIGNS API] Iniciando busca de campanhas...');
  console.log('📋 [CAMPAIGNS API] Parâmetros recebidos:', { clientId, adAccountId });
  
  if (!clientId || !adAccountId) {
    console.log('❌ [CAMPAIGNS API] Parâmetros obrigatórios ausentes');
    return NextResponse.json({ error: 'Client ID e Ad Account ID são obrigatórios' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    console.log('✅ [CAMPAIGNS API] Cliente Supabase criado');
    
    // Verificar autenticação do usuário (modo permissivo para debug)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('⚠️ [CAMPAIGNS API] Usuário não autenticado');
      return NextResponse.json({ 
        campaigns: [],
        isTestData: false,
        message: 'Usuário não autenticado. Faça login para acessar os dados reais.'
      });
    }
    
    console.log('✅ [CAMPAIGNS API] Usuário autenticado:', user.email);

    // Buscar conexão do Meta para este cliente
    console.log('🔍 [CAMPAIGNS API] Buscando conexão Meta...');
    const { data: connection, error: connectionError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('ad_account_id', adAccountId)
      .eq('is_active', true)
      .single();

    console.log('📊 [CAMPAIGNS API] Resultado da busca de conexão:', { connection, connectionError });

    if (connectionError || !connection) {
      console.log('⚠️ [CAMPAIGNS API] Conexão não encontrada');
      return NextResponse.json({ 
        campaigns: [],
        isTestData: false,
        message: 'Conexão com Meta não encontrada. Conecte sua conta do Meta Ads.'
      });
    }

    console.log('✅ [CAMPAIGNS API] Conexão encontrada, buscando campanhas reais...');

    // Buscar campanhas usando o Meta Ads Client
    try {
      const metaClient = new MetaAdsClient(connection.access_token);
      console.log('🔗 [CAMPAIGNS API] Cliente Meta criado, fazendo requisição...');
      
      const campaigns = await metaClient.getCampaigns(adAccountId);
      console.log('✅ [CAMPAIGNS API] Campanhas reais obtidas:', campaigns);
      
      // Verificar se há campanhas
      if (!campaigns || campaigns.length === 0) {
        console.log('📭 [CAMPAIGNS API] Nenhuma campanha encontrada na conta');
        return NextResponse.json({ 
          campaigns: [],
          isTestData: false,
          message: 'Nenhuma campanha encontrada na conta Meta Ads. Verifique se a conta conectada tem campanhas ativas ou reconecte com uma conta diferente.'
        });
      }

      return NextResponse.json({ campaigns, isTestData: false });
    } catch (metaError: any) {
      console.log('❌ [CAMPAIGNS API] Erro ao buscar campanhas reais:', metaError);
      
      // Verificar se é erro de token expirado
      const errorMessage = metaError.message || metaError.toString().toLowerCase();
      
      if (errorMessage && (
        errorMessage.includes('token') || 
        errorMessage.includes('session') ||
        errorMessage.includes('access') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('400') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403') ||
        errorMessage.includes('The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons')
      )) {
        console.log('🔐 [CAMPAIGNS API] Erro possivelmente relacionado a token expirado');
        return NextResponse.json({ 
          campaigns: [],
          isTestData: false,
          requiresReconnection: true,
          errorType: 'TOKEN_EXPIRED',
          message: 'Sua conexão com o Meta Ads expirou. Por favor, reconecte sua conta para continuar acessando os dados.',
          detailedMessage: 'O token de acesso do Facebook expirou ou foi invalidado. Isso acontece normalmente por motivos de segurança. Clique em "Reconectar Conta" para restaurar o acesso.',
          action: 'RECONNECT',
          actionLabel: 'Reconectar Conta'
        });
      }
      
      console.log('❌ [CAMPAIGNS API] Erro genérico ao buscar campanhas reais');
      
      return NextResponse.json({ 
        campaigns: [],
        isTestData: false,
        message: 'Erro ao buscar campanhas reais. Tente novamente ou reconecte sua conta.',
        error: metaError.message
      });
    }

  } catch (error) {
    console.error('💥 [CAMPAIGNS API] Erro geral:', error);
    
    return NextResponse.json({ 
      campaigns: [],
      isTestData: false,
      message: 'Erro interno ao buscar campanhas. Tente novamente mais tarde.',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}