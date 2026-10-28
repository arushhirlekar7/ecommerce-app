import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register New Inventory',
  description: 'Add new items and assign stock quantities to the warehouse vault',
};

export default function AddProductLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

