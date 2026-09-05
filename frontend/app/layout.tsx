import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

import { ThemeProvider, ThemeScript } from "@/components/shell/theme";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HireFlow AI — AI-powered recruiting from sourcing to interview",
    template: "%s · HireFlow AI",
  },
  description:
    "HireFlow AI sources candidates, runs AI voice outreach and conducts structured AI interviews, then hands recruiters structured, scored results.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#16161c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className:
                "!bg-[var(--surface)] !border !border-[var(--border)] !text-[var(--text-primary)] !shadow-lg !rounded-xl",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
