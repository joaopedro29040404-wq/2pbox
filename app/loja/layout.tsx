import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Produtos | 2P Box',
  description: 'Explore o catálogo da 2P Box com papelaria, eletrônicos, acessórios para celular e variedades.',
  alternates: { canonical: '/loja' },
};

export default function LojaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
