"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SidebarUserInfo } from "./sidebar-user-info";
import { 
  Users, 
  BarChart3, 
  Settings, 
  CreditCard,
  Target,
  Crown,
  Lock,
  TrendingUp,
  AlertCircle,
  Database,
  Search,
  DollarSign,
  Eye,
  Zap,
  CheckCircle,
  XCircle,
  X,
  Edit,
  Plus,
  UserPlus
} from "lucide-react";
import { Badge } from "../ui/badge";
import { useFeatureMatrix } from "@/hooks/use-feature-gate";
import { Button } from "../ui/button";
import { usePlatformConnections } from "@/hooks/use-platform-connections";
import { Logo } from "../ui/logo";
import { ThemeToggle } from "../ui/theme-toggle";

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  adminOnly?: boolean;
  requiresFeature?: string; // Feature key required to access this item
  platform?: 'meta' | 'google'; // Platform connection indicator
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

const navigationSections: NavigationSection[] = [
  {
    title: "Principal",
    items: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: BarChart3,
      },
      {
        name: "Campanhas",
        href: "/dashboard/campaigns",
        icon: Target,
        platform: 'meta',
      },
      {
        name: "Clientes",
        href: "/dashboard/clients",
        icon: Users,
      },
      {
        name: "Saldo das Contas",
        href: "/dashboard/balance",
        icon: DollarSign,
      },
      {
        name: "Relatórios",
        href: "/dashboard/reports",
        icon: Database,
      },
      {
        name: "Analytics",
        href: "/dashboard/analytics",
        icon: TrendingUp,
        platform: 'meta',
      },
    ]
  },
  {
    title: "Plataformas",
    items: [
      {
        name: "Meta Ads",
        href: "/dashboard/meta",
        icon: Target,
        platform: 'meta',
      },
      {
        name: "Leads Meta",
        href: "/dashboard/meta/leads",
        icon: UserPlus,
        platform: 'meta',
      },
      {
        name: "Google Ads",
        href: "/dashboard/google",
        icon: Search,
        platform: 'google',
      },
      {
        name: "Insights Google",
        href: "/dashboard/analytics/google",
        icon: TrendingUp,
        platform: 'google',
      },
      {
        name: "WhatsApp",
        href: "/dashboard/whatsapp",
        icon: Zap,
      },
    ]
  },
  {
    title: "Avançado",
    items: [
      {
        name: "Métricas Personalizadas",
        href: "/dashboard/metrics",
        icon: BarChart3,
      },
      {
        name: "Dashboard Personalizável",
        href: "/dashboard/custom-views",
        icon: Settings,
      },
      {
        name: "Monitoring Google Ads",
        href: "/dashboard/google/monitoring",
        icon: AlertCircle,
        platform: 'google',
      },
      {
        name: "Objetivos Inteligentes",
        href: "/dashboard/objectives",
        icon: Target,
      },
    ]
  },
  {
    title: "Gestão",
    items: [
      {
        name: "Usuários",
        href: "/dashboard/users",
        icon: Users,
      },
      {
        name: "Equipe",
        href: "/dashboard/team",
        icon: Users,
      },
      {
        name: "Planos & Cobrança",
        href: "/dashboard/billing",
        icon: CreditCard,
      },
      {
        name: "Configurações",
        href: "/dashboard/settings",
        icon: Settings,
      },
      {
        name: "Política de Privacidade",
        href: "/privacy-policy",
        icon: Eye,
      },
      {
        name: "Termos de Uso",
        href: "/terms-of-service",
        icon: Lock,
      },
    ]
  },

  {
    title: "Administração",
    items: [
      {
        name: "Painel Admin",
        href: "/admin",
        icon: Lock,
        adminOnly: true,
      },
      {
        name: "Super Admin",
        href: "/admin/super-admin",
        icon: Crown,
        adminOnly: true,
      },
      {
        name: "Organizações",
        href: "/admin/organizations",
        icon: Database,
        adminOnly: true,
      },
      {
        name: "Usuários",
        href: "/admin/users",
        icon: Users,
        adminOnly: true,
      },
      {
        name: "Planos",
        href: "/admin/plans",
        icon: CreditCard,
        adminOnly: true,
      },
      {
        name: "Assinaturas",
        href: "/admin/subscriptions",
        icon: Crown,
        adminOnly: true,
      },
      {
        name: "Gerenciamento Manual",
        href: "/admin/subscription-management",
        icon: Edit,
        adminOnly: true,
      },
      {
        name: "Gestão de Cobrança",
        href: "/admin/billing-management",
        icon: DollarSign,
        adminOnly: true,
      },
      {
        name: "Leads",
        href: "/admin/leads",
        icon: Plus,
        adminOnly: true,
      },
      {
        name: "Monitoramento",
        href: "/admin/monitoring",
        icon: Eye,
        adminOnly: true,
      },
    ]
  }
];

interface DashboardSidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function DashboardSidebar({ isMobileOpen = false, onMobileClose }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { matrix, loading: featureLoading } = useFeatureMatrix();
  const { meta, google, loading: connectionsLoading } = usePlatformConnections();

  // Function to get connection indicator for platform items
  const getConnectionIndicator = (platform?: 'meta' | 'google') => {
    if (!platform || connectionsLoading) return null;
    
    const connection = platform === 'meta' ? meta : google;
    
    if (connection.isConnected) {
      return (
        <div title={`${connection.connectionCount} conexão(ões) ativa(s)`}>
          <CheckCircle className="w-3 h-3 text-green-500 ml-1" />
        </div>
      );
    } else {
      return (
        <div title="Não conectado">
          <XCircle className="w-3 h-3 text-gray-400 ml-1" />
        </div>
      );
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Toggle button for desktop - positioned outside sidebar to avoid overflow clipping */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "hidden lg:flex fixed top-7 z-[60] w-7 h-7 bg-primary text-primary-foreground rounded-full items-center justify-center hover:bg-primary/90 transition-all duration-300 shadow-lg border-2 border-background",
          isCollapsed ? "left-[68px]" : "left-[252px]"
        )}
        title={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
      >
        <svg 
          className="w-4 h-4 transition-transform duration-200" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 bg-background border-r border-border shadow-xl transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col overflow-hidden",
        isCollapsed ? "w-20" : "w-64",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg flex-shrink-0 relative">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 p-1">
              <Logo size={28} />
            </div>
            {!isCollapsed && (
              <h1 className="text-xl font-bold text-white whitespace-nowrap">
                Ads Manager
              </h1>
            )}
          </Link>
          
          {/* Close button for mobile */}
          <button
            onClick={onMobileClose}
            className="lg:hidden text-white hover:text-gray-200 p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto overflow-x-hidden custom-scrollbar-hover">
          {navigationSections.map((section) => {
            // Filtrar itens admin apenas para super admins e verificar features
            const visibleItems = section.items.filter((item: NavigationItem) => {
              if (item.adminOnly) {
                // Por enquanto, mostrar para todos - depois implementaremos verificação real
                return true;
              }
              
              // Check feature requirements
              if (item.requiresFeature && !featureLoading) {
                return matrix[item.requiresFeature] === true;
              }
              
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                {/* Section Title */}
                {!isCollapsed && (
                  <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {section.title}
                  </h3>
                )}
                
                {/* Section Items */}
                <div className="space-y-1">
                  {visibleItems.map((item: NavigationItem) => {
                    const isActive = pathname === item.href || 
                      (item.href !== "/dashboard" && pathname && pathname.startsWith(item.href));
                    
                    const hasFeatureAccess = !item.requiresFeature || matrix[item.requiresFeature] === true;
                    
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={onMobileClose}
                        title={isCollapsed ? item.name : undefined}
                        className={cn(
                          "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group relative",
                          isActive
                            ? item.adminOnly 
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-l-4 border-red-500"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-l-4 border-blue-500"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground hover:border-l-4 hover:border-border",
                          item.adminOnly && !isActive && "hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300",
                          isCollapsed && "justify-center"
                        )}
                      >
                        <item.icon className={cn(
                          "w-5 h-5 transition-colors flex-shrink-0",
                          !isCollapsed && "mr-3",
                          isActive 
                            ? item.adminOnly ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
                            : "text-muted-foreground group-hover:text-foreground"
                        )} />
                        {!isCollapsed && (
                          <>
                            <span className="flex-1">{item.name}</span>
                            <div className="flex items-center space-x-1">
                              {item.platform && getConnectionIndicator(item.platform)}
                              {item.adminOnly && (
                                <Badge 
                                  variant="destructive" 
                                  className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 border-red-200"
                                >
                                  ADMIN
                                </Badge>
                              )}
                              {item.requiresFeature && !hasFeatureAccess && (
                                <Crown className="w-4 h-4 text-orange-500" />
                              )}
                            </div>
                          </>
                        )}
                        
                        {/* Tooltip for collapsed state */}
                        {isCollapsed && (
                          <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground border border-border text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                            {item.name}
                            {item.platform && (
                              <>
                                {" • "}
                                {item.platform === 'meta' 
                                  ? (meta.isConnected ? `${meta.connectionCount} Meta` : "Meta desconectado")
                                  : (google.isConnected ? `${google.connectionCount} Google` : "Google desconectado")
                                }
                              </>
                            )}
                            {item.adminOnly && " (ADMIN)"}
                            {item.requiresFeature && !hasFeatureAccess && " (UPGRADE)"}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Theme Toggle */}
        <div className={cn(
          "px-4 py-3 border-t border-border flex-shrink-0",
          isCollapsed && "px-2"
        )}>
          <ThemeToggle collapsed={isCollapsed} />
        </div>

        {/* User Info */}
        <div className="border-t border-border flex-shrink-0">
          <SidebarUserInfo />
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-border bg-muted/50 flex-shrink-0">
            <div className="text-xs text-muted-foreground text-center">
              <div className="font-semibold text-foreground">Ads Manager SaaS</div>
              <div className="mt-1 flex items-center justify-center space-x-1">
                <span>v2.0</span>
                <span>•</span>
                <span className="text-green-600 dark:text-green-400 font-medium">Sistema Completo</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
