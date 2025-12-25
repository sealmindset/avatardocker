import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SessionProvider } from "@/components/SessionContext";
import { AuthProvider } from "@/components/AuthContext";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";

const enableTraining =
  process.env.NEXT_PUBLIC_ENABLE_TRAINING === "true" &&
  process.env.NEXT_PUBLIC_ENV_NAME !== "prod";

export const metadata: Metadata = {
  title: "PULSE Selling Behavioral Certification",
  description: "PULSE Training Platform - MLX-powered local AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SessionProvider>
              <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                  <div className="font-semibold">PULSE/H2</div>
                  <ul className="flex items-center gap-4 text-sm">
                    <li><Link href="/pre-session">Pre-Session</Link></li>
                    <li><Link href="/session">Session</Link></li>
                    {enableTraining && <li><Link href="/training">Training</Link></li>}
                    <li><Link href="/feedback">Feedback</Link></li>
                    <li><Link href="/admin">Admin</Link></li>
                    <li className="ml-2"><ModeToggle /></li>
                  </ul>
                </nav>
              </header>
              <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
            </SessionProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
