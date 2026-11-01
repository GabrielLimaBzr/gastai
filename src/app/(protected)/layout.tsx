import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/Nav'
import { MonthProvider } from '@/contexts/month'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:py-6 md:pb-6">
      <MonthProvider>
        <Nav email={user.email} />
        {children}
      </MonthProvider>
    </div>
  )
}
