import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TheoVoice from "@/components/TheoVoice";
import SessionProvider from "@/components/SessionProvider";
import { auth } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TheoSYN Command Center",
  description: "TheoSYN Labs OS — multi-agent command center",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth()

  return (
    <html lang="en">
      <body className={`${inter.className} bg-zinc-950 text-white`}>
        <SessionProvider>
          {session ? (
            <div className="flex min-h-screen">
              <Sidebar user={session.user} />
              <main className="flex-1 overflow-auto pt-12 pb-16 md:pt-0 md:pb-0">{children}</main>
            </div>
          ) : (
            <main className="flex-1 overflow-auto">{children}</main>
          )}
          {session && <TheoVoice />}
        </SessionProvider>
      </body>
    </html>
  );
}
