import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '2P Box | Tudo que você precisa, em um só lugar.',
  description: 'Papelaria, eletrônicos e impressão.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
