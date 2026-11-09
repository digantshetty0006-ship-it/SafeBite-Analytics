import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SafeBite — Prevent unsafe food before it reaches people",
  description:
    "AI-assisted food safety inspection management for FSSAI and Maharashtra FDA. Deterministic risk prioritisation, district heat maps, and rule-based network signals.",
};

const THEME_SCRIPT = `(function(){try{var c=document.cookie.match(/(?:^|;\\s*)safebite_theme=([^;]*)/);var t=c?c[1]:"";if(t!=="light"){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
