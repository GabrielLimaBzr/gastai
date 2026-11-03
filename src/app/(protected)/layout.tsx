import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/AppShell'
import { MonthProvider } from '@/contexts/month'
import { DialogProvider } from '@/contexts/dialogs'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <MonthProvider>
      <DialogProvider>
        <AppShell email={user.email}>{children}</AppShell>
      </DialogProvider>
    </MonthProvider>
  )
}
