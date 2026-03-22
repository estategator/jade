import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
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
                  var match = document.cookie.match(/(?:^|; )curator_active_org=([^;]*)/);
                  var orgId = match ? decodeURIComponent(match[1]) : null;
                  
                  // 2. Check localStorage for cached settings
                  var cacheKey = 'curator_settings_' + (orgId || 'default');
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
                      // Invalid cache, fall through to default
                    }
                  }
                  
                  // 3. Fallback: light theme
                  document.documentElement.setAttribute('data-theme', 'light');
                  document.documentElement.classList.remove('dark');
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
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
