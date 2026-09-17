import type { Metadata, Viewport } from 'next';
import './globals.css';
import './ui.css';
import './twop-home.css';
import './twop-home-carousel.css';
import './product-delivery.css';
import { CartProvider } from '@/components/cart-provider';
import { ToastProvider } from '@/components/ui/toast';
import { WhatsAppFloat } from '@/components/whatsapp-float';
import { MarketingCoupon } from '@/components/marketing-coupon';
import { MarketingPromotions } from '@/components/marketing-promotions';
import AnalyticsTracker from '@/components/analytics-tracker';
import AnalyticsDeviceExclusion from '@/components/analytics-device-exclusion';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://2pbox.com.br'),
  title: '2P Box | Tudo que você precisa, em um só lugar.',
  description: 'Papelaria, eletrônicos, acessórios para celular e Xerox.',
  openGraph: {
    title: '2P Box | Tudo que você precisa, em um só lugar.',
    description: 'Papelaria, eletrônicos, acessórios para celular e Xerox.',
    type: 'website',
    locale: 'pt_BR',
    images: ['/logo.pnh.png'],
  },
  icons: { icon: '/logo.pnh.png' },
};

export const viewport: Viewport = {
  themeColor: '#111111',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>
          <CartProvider>
            <AnalyticsTracker />
            <AnalyticsDeviceExclusion />
            {children}
            <MarketingCoupon />
            <MarketingPromotions />
            <WhatsAppFloat />
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
