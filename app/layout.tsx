import type { Metadata } from 'next';
import './globals.css';
import './twop-home.css';
import './led-services.css';
import { CartProvider } from '@/components/cart-provider';

export const metadata: Metadata = {
  title: '2P Box | Tudo que você precisa, em um só lugar.',
  description: 'Papelaria, eletrônicos e impressão.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><CartProvider>{children}</CartProvider></body></html>;
}
