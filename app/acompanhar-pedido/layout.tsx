import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acompanhar pedido | 2P Box',
  description: 'Acompanhe o andamento do seu pedido na 2P Box.',
  robots: { index: false, follow: false },
};

export default function TrackingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
