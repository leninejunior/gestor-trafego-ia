"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PlatformConnection {
  platform: 'meta' | 'google';
  isConnected: boolean;
  connectionCount: number;
  lastSync?: Date;
  status: 'active' | 'expired' | 'error' | 'disconnected';
}

interface PlatformConnectionsState {
  meta: PlatformConnection;
  google: PlatformConnection;
  loading: boolean;
  error: string | null;
}

export function usePlatformConnections() {
  const [state, setState] = useState<PlatformConnectionsState>({
    meta: {
      platform: 'meta',
      isConnected: false,
      connectionCount: 0,
      status: 'disconnected'
    },
    google: {
      platform: 'google',
      isConnected: false,
      connectionCount: 0,
      status: 'disconnected'
    },
    loading: true,
    error: null
  });

  const checkConnections = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const supabase = createClient();
      
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setState(prev => ({ 
          ...prev, 
          loading: false,
          error: 'Usuário não autenticado'
        }));
        return;
      }

      // Get user's organizations
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_memberships')
        .select('organization_id')
        .eq('user_id', user.id);

      if (membershipError || !memberships || memberships.length === 0) {
        setState(prev => ({ 
          ...prev, 
          loading: false,
          error: 'Nenhuma organização encontrada'
        }));
        return;
      }

      // Get clients for user's organizations
      const organizationIds = memberships.map(m => m.organization_id);
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id')
        .in('org_id', organizationIds);

      if (clientsError) {
        setState(prev => ({ 
          ...prev, 
          loading: false,
          error: 'Erro ao buscar clientes'
        }));
        return;
      }

      // Extract client IDs
      const clientIds = clients ? clients.map(c => c.id) : [];

      // Check Meta connections
      const { data: metaConnections, error: metaError } = await supabase
        .from('client_meta_connections')
        .select('id, is_active, last_sync_at, status')
        .in('client_id', clientIds);

      // Check Google connections (skip if table doesn't exist)
      let googleConnections: any[] = [];
      let googleError = null;
      
      try {
        const { data, error } = await supabase
          .from('google_ads_connections')
          .select('id, status, last_sync_at')
          .in('client_id', clientIds);
        googleConnections = data || [];
        googleError = error;
      } catch (error) {
        // Table might not exist yet, ignore error
        console.log('Google Ads connections table not available yet');
      }

      if (metaError) {
        console.error('Error fetching Meta connections:', metaError);
      }

      if (googleError) {
        console.error('Error fetching Google connections:', googleError);
      }

      // Process Meta connections
      const activeMetaConnections = metaConnections?.filter(conn => conn.is_active) || [];
      const metaStatus = activeMetaConnections.length > 0 ? 'active' : 'disconnected';
      const metaLastSync = activeMetaConnections.length > 0 
        ? new Date(Math.max(...activeMetaConnections.map(conn => 
            conn.last_sync_at ? new Date(conn.last_sync_at).getTime() : 0
          )))
        : undefined;

      // Process Google connections
      const activeGoogleConnections = googleConnections?.filter(conn => conn.status === 'active') || [];
      const googleStatus = activeGoogleConnections.length > 0 ? 'active' : 'disconnected';
      const googleLastSync = activeGoogleConnections.length > 0 
        ? new Date(Math.max(...activeGoogleConnections.map(conn => 
            conn.last_sync_at ? new Date(conn.last_sync_at).getTime() : 0
          )))
        : undefined;

      setState({
        meta: {
          platform: 'meta',
          isConnected: activeMetaConnections.length > 0,
          connectionCount: activeMetaConnections.length,
          lastSync: metaLastSync,
          status: metaStatus as any
        },
        google: {
          platform: 'google',
          isConnected: activeGoogleConnections.length > 0,
          connectionCount: activeGoogleConnections.length,
          lastSync: googleLastSync,
          status: googleStatus as any
        },
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Error checking platform connections:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: 'Erro ao verificar conexões'
      }));
    }
  };

  useEffect(() => {
    checkConnections();
  }, []);

  return {
    ...state,
    refresh: checkConnections
  };
}