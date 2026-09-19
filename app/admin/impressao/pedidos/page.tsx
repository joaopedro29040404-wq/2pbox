import { redirect } from 'next/navigation';

export default function LegacyPrintOrdersRedirect() {
  redirect('/admin/impressao');
}
