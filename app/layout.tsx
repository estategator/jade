import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Serif_Display, DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import "./globals.css";
import { SettingsProvider } from "@/app/components/settings-provider";
import { PublicThemeProvider } from "@/app/components/public-theme-provider";
import { DashboardLayoutWrapper } from "@/app/components/dashboard-layout-wrapper";
import { SidebarServer } from "@/app/components/sidebar-server";
import { createClient } from "@/utils/supabase/server";
import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, organizationJsonLd } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  weight: "400",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sidebar visibility is controlled by DashboardLayoutWrapper based on route
  const isAuthenticated = !!user?.id;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var match = document.cookie.match(/(?:^|; )curator_active_org=([^;]*)/);
                  var orgId = match ? decodeURIComponent(match[1]) : null;

                  // Authenticated surface: use org-scoped cached settings.
                  if (orgId) {
                    var cacheKey = 'curator_settings_' + orgId;
                    var cached = localStorage.getItem(cacheKey);
                    if (cached) {
                      try {
                        var parsed = JSON.parse(cached);
                        var theme = parsed.theme === 'dark' ? 'dark' : 'light';
                        document.documentElement.setAttribute('data-theme', theme);
                        if (theme === 'dark') {
                          document.documentElement.classList.add('dark');
                        } else {
                          document.documentElement.classList.remove('dark');
                        }
                        if (parsed.fontSize) {
                          document.documentElement.style.setProperty('--app-font-size', parsed.fontSize);
                        }
                        if (parsed.brandPrimary) {
                          document.documentElement.style.setProperty('--brand-primary', parsed.brandPrimary);
                        }
                        if (parsed.brandAccent) {
                          document.documentElement.style.setProperty('--brand-accent', parsed.brandAccent);
                        }
                        return;
                      } catch (e) {
                        // Invalid cache, fall through to public theme
                      }
                    }
                  }

                  // Public/marketing surface: use public theme (localStorage or system).
                  var publicTheme = localStorage.getItem('curator_public_theme');
                  if (publicTheme !== 'dark' && publicTheme !== 'light') {
                    publicTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
                      ? 'dark'
                      : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', publicTheme);
                  if (publicTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  // Silently fail; hydration will apply correct theme
                }
              })();
            `,
          }}
        />

      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmSerifDisplay.variable} ${dmSans.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <SettingsProvider userId={user?.id ?? null}>
          <PublicThemeProvider enabled={!isAuthenticated}>
            {isAuthenticated ? (
              <DashboardLayoutWrapper sidebar={<SidebarServer />}>{children}</DashboardLayoutWrapper>
            ) : (
              children
            )}
          </PublicThemeProvider>
        </SettingsProvider>
        <Toaster position="top-right" richColors closeButton />
        <Analytics />
      </body>
    </html>
  );
}
