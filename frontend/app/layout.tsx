import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Bebas_Neue, Geist, Geist_Mono } from "next/font/google";
import { BgmPlayer } from "@/components/shared/BgmPlayer";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { isLang, LANG_COOKIE } from "@/lib/i18n/types";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Bebas_Neue({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Jalur APEXGP — Sepang race engineer",
  description:
    "Pick a Sepang session and get conservative vs aggressive strategy reads from a live weather blend.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read upfront on the server so the first client render already knows
  // the visitor's language — see LanguageProvider's initialLang comment
  // for why this is what actually removes the flash without a hydration
  // mismatch (a plain localStorage read can't run here; the server has
  // no access to it).
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(LANG_COOKIE)?.value;
  const initialLang = isLang(cookieLang) ? cookieLang : "en";

  return (
    <html lang="en" className="overflow-x-clip">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} min-w-0 overflow-x-clip bg-asphalt font-sans text-paper`}
      >
        <LanguageProvider initialLang={initialLang}>
          {children}
          <BgmPlayer />
        </LanguageProvider>
      </body>
    </html>
  );
}
