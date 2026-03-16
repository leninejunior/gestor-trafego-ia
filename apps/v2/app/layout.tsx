import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flying Fox V2",
  description: "Base V2 com Next.js + Prisma + Postgres local",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

