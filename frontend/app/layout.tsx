import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BackgroundGlow from "@/components/BackgroundGlow";
import Navbar from "@/components/Navbar";
import { SessionProvider } from "@/lib/session";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Notedr.",
  description: "Patient registration, management and doctor consultations.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-grain relative min-h-screen overflow-x-hidden">
        <SessionProvider>
          {/* Background layer (shared across all pages) */}
          <BackgroundGlow />

          {/* Foreground */}
          <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6">
            <Navbar />
            {children}
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
