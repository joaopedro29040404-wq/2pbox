import './product-card-layout.css';
import { MobileEanScanner } from '@/components/admin/mobile-ean-scanner';

export default function ProductsAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MobileEanScanner />
    </>
  );
}
