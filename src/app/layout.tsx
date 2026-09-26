import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/context/AuthContext";
import { WalletProvider } from "@/context/WalletContext";
import { ThemeProvider, themeInitScript } from "@/context/ThemeContext";
import { LocaleProvider, localeInitScript } from "@/context/LocaleContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mergefi.app",
  ),
  title: "MergeFi | Merge code. Earn instantly.",
  description:
    "MergeFi is the financial infrastructure for open source: fund GitHub issues, escrow payment with Soroban smart contracts on Stellar, and pay contributors automatically when work is merged.",
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  // Matches the light/dark backgrounds in globals.css so mobile browser
  // chrome (the address/status bar) doesn't clash with the page the
  // instant it loads — without this, browsers fall back to their own
  // default (usually white), which visibly contradicts a near-black dark
  // mode page (#224).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /* `lang` and `dir` are written by localeInitScript before first paint
       (see the script tag below), so a right-to-left viewer never sees a
       left-to-right first frame and a screen reader never announces the
       document in the wrong language. The literal defaults here are what the
       server renders; the script upgrades them client-side, and
       suppressHydrationWarning covers the attribute swap. */
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-[#fbfbfd] text-slate-900 dark:bg-[#0a0a0f] dark:text-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <LocaleProvider>
          <ThemeProvider>
            <AuthProvider>
              <WalletProvider>
                <Navbar />
                <main id="main-content" className="flex-1">
                  {children}
                </main>
                <Footer />
              </WalletProvider>
            </AuthProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
