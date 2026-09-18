import './globals.css';
import type { ReactNode } from 'react';
import AuthGate from '@/components/AuthGate';

export const metadata = {
  title: 'Painel NT ALPHA',
  description: 'Gestão de imóveis NT ALPHA',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
