import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { NextAuthProvider } from "@/components/session-provider";
import { HideValuesProvider } from "@/components/hide-values-provider";
import { QuickCaptureProvider } from "@/components/quick-capture-provider";
import { AtalhosGlobais } from "@/components/atalhos-globais";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "SAL Hub",
  description: "Sistema de gestão da SAL Estratégias de Marketing",
  icons: { icon: "/sal-logo.svg" },
};

/**
 * Viewport — mobile-first.
 * `viewportFit: "cover"` permite usar env(safe-area-inset-*) pra
 * notches do iPhone (necessário pro Portal do Cliente onde
 * usamos safe-area-inset-top/bottom).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0E0E14" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${interTight.variable} ${jetbrains.variable} font-sans antialiased`}>
        <NextAuthProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <HideValuesProvider>
              <QuickCaptureProvider>
                <AtalhosGlobais />
                {children}
                <Toaster />
              </QuickCaptureProvider>
            </HideValuesProvider>
          </ThemeProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
