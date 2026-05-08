import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { NavPrefsProvider } from "@/lib/nav-prefs";
import { ProfilePrefsProvider } from "@/lib/profile-prefs";
import { Toaster } from "@/components/ui/sonner";
import { DemoBanner } from "@/components/DemoBanner";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "doska" },
      {
        name: "description",
        content:
          "A calm, editorial taskboard with custom tags, day notes, and reports.",
      },
      { property: "og:title", content: "doska" },
      { name: "twitter:title", content: "doska" },
      {
        property: "og:description",
        content:
          "A calm, editorial taskboard with custom tags, day notes, and reports.",
      },
      {
        name: "twitter:description",
        content:
          "A calm, editorial taskboard with custom tags, day notes, and reports.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/95f482b6-fd17-4122-a47f-333e31a766e2",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/95f482b6-fd17-4122-a47f-333e31a766e2",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@300;400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <NavPrefsProvider>
        <ProfilePrefsProvider>
          <DemoBanner />
          <Outlet />
          <Toaster position="top-center" />
          <Analytics />
        </ProfilePrefsProvider>
      </NavPrefsProvider>
    </AuthProvider>
  );
}
