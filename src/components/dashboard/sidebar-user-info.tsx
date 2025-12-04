"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Crown, Shield, User } from "lucide-react";

interface UserInfo {
  email: string;
  displayName: string;
  orgName: string;
  role: string;
  planName: string;
}

export function SidebarUserInfo() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserInfo() {
      try {
        const response = await fetch('/api/user/info');
        if (response.ok) {
          const data = await response.json();
          setUserInfo(data);
        } else {
          console.error('Erro ao carregar info do usuário:', response.status);
          // Definir valores padrão em caso de erro
          setUserInfo({
            email: 'usuario@exemplo.com',
            displayName: 'Usuário',
            orgName: 'Organização',
            role: 'viewer',
            planName: 'Free'
          });
        }
      } catch (error) {
        console.error('Erro ao carregar info do usuário:', error);
        // Definir valores padrão em caso de erro
        setUserInfo({
          email: 'usuario@exemplo.com',
          displayName: 'Usuário',
          orgName: 'Organização',
          role: 'viewer',
          planName: 'Free'
        });
      } finally {
        setLoading(false);
      }
    }

    loadUserInfo();
  }, []);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="h-3 w-3 text-purple-500" />;
      case 'owner':
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-3 w-3 text-blue-500" />;
      default:
        return <User className="h-3 w-3 text-gray-500" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatRoleName = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Admin';
      case 'manager':
        return 'Manager';
      case 'analyst':
        return 'Analyst';
      case 'viewer':
        return 'Viewer';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="p-3 bg-muted/50">
        <div className="animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-muted rounded-full"></div>
            <div className="flex-1">
              <div className="h-3 bg-muted rounded w-3/4 mb-1"></div>
              <div className="h-2 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!userInfo) {
    return null;
  }

  const initials = userInfo.displayName
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="p-3 bg-muted/50">
      <div className="flex items-center space-x-3">
        <Avatar className="w-8 h-8">
          <AvatarFallback className="text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-xs font-medium text-foreground truncate">
              {userInfo.displayName}
            </p>
            {getRoleIcon(userInfo.role)}
          </div>
          
          <div className="flex items-center gap-1 mb-1">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground truncate">
              {userInfo.orgName}
            </p>
          </div>
          
          <div className="flex items-center gap-1">
            <Badge 
              variant={getRoleBadgeVariant(userInfo.role)} 
              className="text-xs px-1 py-0"
            >
              {formatRoleName(userInfo.role)}
            </Badge>
            <Badge variant="outline" className="text-xs px-1 py-0">
              {userInfo.planName}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}