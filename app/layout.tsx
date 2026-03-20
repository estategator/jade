import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/app/components/settings-provider";
import { DashboardLayoutWrapper } from "@/app/components/dashboard-layout-wrapper";
import { createClient } from "@/utils/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Curator AI",
  description: "AI-powered estate sales management",
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
                  // 1. Get active org from cookie
                  const match = document.cookie.match(/(?:^|; )curator_active_org=([^;]*)/);
                  const orgId = match ? decodeURIComponent(match[1]) : null;
                  
                  // 2. Check localStorage for cached settings
                  const cacheKey = 'curator_settings_' + (orgId || 'default');
                  const cached = localStorage.getItem(cacheKey);
                  
                  if (cached) {
                    try {
                      const parsed = JSON.parse(cached);
                      const theme = parsed.theme || 'system';
                      
                      // Apply explicit theme attributes and dark class
                      if (theme === 'dark') {
                        document.documentElement.setAttribute('data-theme', 'dark');
                        document.documentElement.removeAttribute('data-system-dark');
                        document.documentElement.classList.add('dark');
                      } else if (theme === 'light') {
                        document.documentElement.setAttribute('data-theme', 'light');
                        document.documentElement.removeAttribute('data-system-dark');
                        document.documentElement.classList.remove('dark');
                      } else {
                        // system theme: detect and set
                        document.documentElement.setAttribute('data-theme', 'system');
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        document.documentElement.setAttribute('data-system-dark', prefersDark ? 'true' : 'false');
                        document.documentElement.classList.toggle('dark', prefersDark);
                      }
                      
                      // Apply CSS variables
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
                      // Invalid cache, fall through to system preference
                    }
                  }
                  
                  // 3. Fallback: Apply system preference (no cached theme found)
                  document.documentElement.setAttribute('data-theme', 'system');
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  document.documentElement.setAttribute('data-system-dark', prefersDark ? 'true' : 'false');
                  document.documentElement.classList.toggle('dark', prefersDark);
                } catch (e) {
                  // Silently fail; hydration will apply correct theme
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SettingsProvider userId={user?.id ?? null}>
          {isAuthenticated ? (
            <DashboardLayoutWrapper>{children}</DashboardLayoutWrapper>
          ) : (
            children
          )}
        </SettingsProvider>
      </body>
    </html>
  );
}
