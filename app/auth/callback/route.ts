import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server'
import { syncPendingInvitesForUser } from '@/app/notifications/actions'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'
  const intent = searchParams.get('intent')
  const tier = searchParams.get('tier')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Sync pending email invites into notifications for this user
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id && user?.email) {
        syncPendingInvitesForUser(user.id, user.email).catch(() => {});
      }

      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      // Build redirect URL with intent and tier params
      const redirectParams = new URLSearchParams()
      if (intent) redirectParams.set('intent', intent)
      if (tier) redirectParams.set('tier', tier)
      const redirectPath = redirectParams.toString() ? `${next}?${redirectParams.toString()}` : next
      
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${redirectPath}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`)
      } else {
        return NextResponse.redirect(`${origin}${redirectPath}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
