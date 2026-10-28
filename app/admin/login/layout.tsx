import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Portal Login',
  description: 'Secure Staff & Wizard Authentication',
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

