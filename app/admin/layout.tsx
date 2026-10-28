import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Warehouse Command Center | FlashCart Admin',
    template: '%s | FlashCart Admin',
  },
  description: 'Warehouse Command Center & Inventory Management',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

