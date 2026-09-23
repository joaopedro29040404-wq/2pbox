import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Central de Impressão | 2P Box',
  description: 'Envie seus arquivos para impressão de forma rápida e acompanhe seu pedido pela 2P Box.',
  alternates: { canonical: '/impressao' },
};

export default function ImpressaoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
