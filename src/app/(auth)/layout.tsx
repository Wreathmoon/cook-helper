import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <AppLayout>{children}</AppLayout>;
}
