import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Add Admin Wizard',
  description: 'Create and authorize staff accounts for the warehouse command center',
};

export default function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

