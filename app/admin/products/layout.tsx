import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inventory Database',
  description: 'Warehouse stock tracking and inline inventory management',
};

export default function AdminProductsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

