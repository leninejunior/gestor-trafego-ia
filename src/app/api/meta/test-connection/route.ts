import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {
      META_APP_ID: process.env.META_APP_ID ? '✅ Configurado' : '❌ Ausente',
      META_APP_SECRET: process.env.META_APP_SECRET ? '✅ Configurado' : '❌ Ausente',
      META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN ? '✅ Configurado' : '❌ Ausente',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '❌ Ausente',
    },
    tests: {}
  };

  // Teste 1: Verificar se o App ID é válido
  try {
    const appResponse = await axios.get(`https://graph.facebook.com/v22.0/${process.env.META_APP_ID}`, {
      params: {
        fields: 'id,name',
        access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
      }
    });
    
    results.tests.appValidation = {
      status: '✅ Sucesso',
      data: appResponse.data
    };
  } catch (error: any) {
    results.tests.appValidation = {
      status: '❌ Falhou',
      error: error.response?.data || error.message
    };
  }

  // Teste 2: Verificar se o Access Token é válido
  if (process.env.META_ACCESS_TOKEN) {
    try {
      const tokenResponse = await axios.get('https://graph.facebook.com/v22.0/me', {
        params: {
          access_token: process.env.META_ACCESS_TOKEN,
          fields: 'id,name'
        }
      });
      
      results.tests.tokenValidation = {
        status: '✅ Sucesso',
        data: tokenResponse.data
      };
    } catch (error: any) {
      results.tests.tokenValidation = {
        status: '❌ Falhou',
        error: error.response?.data || error.message
      };
    }

    // Teste 3: Verificar contas de anúncios
    try {
      const accountsResponse = await axios.get('https://graph.facebook.com/v22.0/me/adaccounts', {
        params: {
          access_token: process.env.META_ACCESS_TOKEN,
          fields: 'id,name,account_status,currency'
        }
      });
      
      results.tests.adAccounts = {
        status: '✅ Sucesso',
        count: accountsResponse.data.data?.length || 0,
        accounts: accountsResponse.data.data
      };
    } catch (error: any) {
      results.tests.adAccounts = {
        status: '❌ Falhou',
        error: error.response?.data || error.message
      };
    }

    // Teste 4: Verificar permissões do token
    try {
      const permissionsResponse = await axios.get('https://graph.facebook.com/v22.0/me/permissions', {
        params: {
          access_token: process.env.META_ACCESS_TOKEN
        }
      });
      
      results.tests.permissions = {
        status: '✅ Sucesso',
        permissions: permissionsResponse.data.data
      };
    } catch (error: any) {
      results.tests.permissions = {
        status: '❌ Falhou',
        error: error.response?.data || error.message
      };
    }
  }

  return NextResponse.json(results, { status: 200 });
}
