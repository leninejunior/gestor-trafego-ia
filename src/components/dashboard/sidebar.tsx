"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SidebarUserInfo } from "./sidebar-user-info";
import { 
  Users, 
  BarChart3, 
  Settings, 
  Home,
  FileText,
  MessageSquare,
  CreditCard,
  UserPlus,
  Shield,
  Building2,
  DollarSign
} from "lucide-react";
import { Badge } from "../ui/badge";

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  adminOnly?: boolean;
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
        icon: Home,
      },
      {
        name: "Clientes",
        href: "/dashboard/clients",
        icon: Users,
      },
      {
        name: "Relatórios",
        href: "/dashboard/reports",
        icon: FileText,
      },
      {
        name: "Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
      },
    ]
  },
  {
    title: "Plataformas",
    items: [
      {
        name: "Meta Ads",
        href: "/dashboard/meta",
        icon: Building2,
      },
      {
        name: "Google Ads",
        href: "/dashboard/google",
        icon: BarChart3,
      },
      {
        name: "WhatsApp",
        href: "/dashboard/whatsapp",
        icon: MessageSquare,
      },
    ]
  },
  {
    title: "Gestão",
    items: [
      {
        name: "Equipe",
        href: "/dashboard/team",
        icon: UserPlus,
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
    ]
  },
  {
    title: "Administração",
    items: [
      {
        name: "Painel Admin",
        href: "/admin",
        icon: Shield,
        adminOnly: true,
      },
      {
        name: "Organizações",
        href: "/admin/organizations",
        icon: Building2,
        adminOnly: true,
      },
      {
        name: "Financeiro",
        href: "/admin/billing",
        icon: DollarSign,
        adminOnly: true,
      },
    ]
  }
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col w-64 bg-white shadow-lg">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 bg-blue-600">
        <h1 className="text-xl font-bold text-white">
          Ads Manager
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
        {navigationSections.map((section) => {
          // Filtrar itens admin apenas para super admins
          const visibleItems = section.items.filter((item: NavigationItem) => {
            if (item.adminOnly) {
              // Por enquanto, mostrar para todos - depois implementaremos verificação real
              return true;
            }
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              {/* Section Title */}
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {section.title}
              </h3>
              
              {/* Section Items */}
              <div className="space-y-1">
                {visibleItems.map((item: NavigationItem) => {
                  const isActive = pathname === item.href || 
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        isActive
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                        item.adminOnly && "border-l-2 border-red-500"
                      )}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                      {item.adminOnly && (
                        <Badge variant="destructive" className="ml-auto text-xs px-1 py-0">
                          ADMIN
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Info */}
      <SidebarUserInfo />

      {/* Footer */}
      <div className="p-3 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          <div className="font-medium">Ads Manager SaaS</div>
          <div className="mt-1">v2.0 - Sistema Completo</div>
        </div>
      </div>
    </div>
  );
}