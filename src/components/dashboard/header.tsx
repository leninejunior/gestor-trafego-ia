"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, Search, User, LogOut, Settings, Menu, Shield, Home } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";

export function DashboardHeader() {
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const isAdminPage = pathname ? pathname.startsWith('/admin') : false;

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error("Erro ao fazer logout");
      } else {
        toast.success("Logout realizado com sucesso");
        router.push("/login");
      }
    } catch (error) {
      toast.error("Erro inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  const getPageTitle = () => {
    if (pathname?.includes('/admin/campaigns')) return 'Dashboard de Campanhas'
    if (pathname?.includes('/admin/balance')) return 'Verificação de Saldo'
    if (pathname?.includes('/admin/utm')) return 'UTM Manager'
    if (pathname?.includes('/admin/ai-agent')) return 'Agente de IA'
    if (pathname?.includes('/admin/llm-config')) return 'Configuração LLM'
    if (pathname?.includes('/admin/monitoring')) return 'Monitoramento'
    if (pathname?.includes('/admin/api-docs')) return 'API para IA'
    if (pathname?.includes('/admin/organizations')) return 'Organizações'
    if (pathname?.includes('/admin/users')) return 'Usuários'
    if (pathname?.includes('/admin/billing')) return 'Faturamento'
    if (pathname?.includes('/admin')) return 'Painel Administrativo'
    if (pathname?.includes('/dashboard/campaigns')) return 'Dashboard de Campanhas'
    if (pathname?.includes('/dashboard/campaign-squad')) return 'Campaign Squad'
    if (pathname?.includes('/dashboard/analytics/advanced')) return 'Analytics Avançado'
    if (pathname?.includes('/dashboard/analytics')) return 'Analytics'
    if (pathname?.includes('/dashboard/clients')) return 'Clientes'
    if (pathname?.includes('/dashboard/reports')) return 'Relatórios'
    if (pathname?.includes('/dashboard/team')) return 'Equipe'
    if (pathname?.includes('/dashboard/billing')) return 'Planos & Cobrança'
    if (pathname?.includes('/dashboard/settings')) return 'Configurações'
    if (pathname?.includes('/dashboard/meta')) return 'Meta Ads'
    if (pathname?.includes('/dashboard/google')) return 'Google Ads'
    if (pathname?.includes('/dashboard/whatsapp')) return 'WhatsApp'
    if (pathname?.includes('/dashboard')) return 'Dashboard'
    return 'Ads Manager'
  }

  return (
    <header className="bg-background shadow-sm border-b border-border sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        {/* Left side - Mobile menu + Title */}
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Page title with admin badge */}
          <div className="flex items-center space-x-3">
            <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
              {getPageTitle()}
            </h1>
            {isAdminPage && (
              <Badge variant="destructive" className="hidden sm:flex items-center space-x-1">
                <Shield className="w-3 h-3" />
                <span>ADMIN</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Center - Search (hidden on mobile) */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar clientes, campanhas..."
              className="pl-10 pr-4 py-2 w-full bg-muted/50 border-border focus:bg-background"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Quick navigation for admin */}
          {isAdminPage && (
            <div className="hidden sm:flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <Home className="w-4 h-4 mr-1" />
                  Dashboard
                </Link>
              </Button>
            </div>
          )}

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              3
            </span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Super Admin</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    admin@adsmanager.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Navigation shortcuts */}
              {!isAdminPage && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Painel Admin</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                disabled={isLoading}
                className="text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{isLoading ? "Saindo..." : "Sair"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="md:hidden px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder="Buscar..."
            className="pl-10 pr-4 py-2 w-full bg-muted/50 border-border"
          />
        </div>
      </div>
    </header>
  );
}
