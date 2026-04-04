import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server'
import { syncPendingInvitesForUser } from '@/app/notifications/actions'
import { ensureDefaultOrg } from '@/app/organizations/actions'
import { recordSessionSignal } from '@/lib/abuse-detection'
import { resolveAuthorizedRoute } from '@/lib/rbac'

const ACTIVE_ORG_COOKIE = 'curator_active_org';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

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

      let defaultOrgId: string | null = null;

      if (user?.id && user?.email) {
        syncPendingInvitesForUser(user.id, user.email).catch(() => {});

        // Ensure user has at least one organization
        const result = await ensureDefaultOrg(user.id, {
          fullName: user.user_metadata?.full_name ?? '',
          email: user.email,
        });
        if ('orgId' in result) {
          defaultOrgId = result.orgId;
        }

        // Record session signal for anti-sharing detection (fire-and-forget)
        const ipAddress =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          request.headers.get('x-real-ip') ??
          'unknown';
        const userAgent = request.headers.get('user-agent') ?? 'unknown';

        recordSessionSignal({
          userId: user.id,
          orgId: defaultOrgId,
          ipAddress,
          userAgent,
        }).catch(() => {});
      }

      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'

      // ── RBAC-aware destination ─────────────────────────────
      // Resolve whether user is authorized for the requested route.
      // Members without analytics:view are redirected away from /dashboard
      // and /pricing-optimization before they ever see those pages.
      const authorizedNext = user?.id
        ? await resolveAuthorizedRoute(user.id, next, defaultOrgId)
        : next;
      
      // Build redirect URL with intent and tier params
      const redirectParams = new URLSearchParams()
      if (intent) redirectParams.set('intent', intent)
      if (tier) redirectParams.set('tier', tier)
      const redirectPath = redirectParams.toString() ? `${authorizedNext}?${redirectParams.toString()}` : authorizedNext
      
      let redirectUrl: string;
      if (isLocalEnv) {
        redirectUrl = `${origin}${redirectPath}`;
      } else if (forwardedHost) {
        redirectUrl = `https://${forwardedHost}${redirectPath}`;
      } else {
        redirectUrl = `${origin}${redirectPath}`;
      }

      const response = NextResponse.redirect(redirectUrl);

      // Set active org cookie so first page load is org-scoped
      if (defaultOrgId) {
        response.cookies.set(ACTIVE_ORG_COOKIE, defaultOrgId, {
          path: '/',
          maxAge: COOKIE_MAX_AGE,
          sameSite: 'lax',
        });
      }

      return response;
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
