import type { ReactNode } from "react";
import Link from "next/link";

import { logoutAction } from "@/app/auth/actions";

import styles from "./dashboard-shell.module.css";

type DashboardShellProps = {
  activePath: string;
  userEmail: string;
  children: ReactNode;
};

type NavigationItem = {
  href: string;
  label: string;
};

const navigationItems: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
  },
  {
    href: "/dashboard/clients",
    label: "Clientes",
  },
  {
    href: "/dashboard/meta",
    label: "Meta",
  },
  {
    href: "/dashboard/google",
    label: "Google",
  },
];

function isActiveLink(itemHref: string, activePath: string): boolean {
  if (itemHref === "/dashboard") {
    return activePath === "/dashboard";
  }

  return activePath === itemHref || activePath.startsWith(`${itemHref}/`);
}

export function DashboardShell({ activePath, userEmail, children }: DashboardShellProps) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandBadge}>V2</span>
          <div>
            <strong>Flying Fox</strong>
            <p>Painel operacional</p>
          </div>
        </div>

        <nav className={styles.nav}>
          {navigationItems.map((item) => {
            const active = isActiveLink(item.href, activePath);
            const className = active
              ? `${styles.navLink} ${styles.navLinkActive}`
              : styles.navLink;

            return (
              <Link key={item.href} href={item.href} className={className}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/private" className={styles.secondaryLink}>
            Area privada
          </Link>
          <form action={logoutAction}>
            <button type="submit" className={styles.logoutButton}>
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.topbarKicker}>Sessao ativa</p>
            <strong>{userEmail}</strong>
          </div>
          <span className={styles.dot} aria-hidden>
            •
          </span>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
