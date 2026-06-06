import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agenthood — A full AI engineering team as plain Markdown files",
  description: "14 specialized AI agents — architect, reviewer, security expert, DevOps engineer, and more — each a single Markdown skill file any agent runtime can load into any project. No lock-in. No configuration.",
  openGraph: {
    title: "Agenthood — A full AI engineering team as plain Markdown files",
    description: "14 specialized AI agents any agent runtime can load into any software project.",
    url: "https://agenthood.flabs.tech",
    siteName: "Agenthood",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agenthood — A full AI engineering team as plain Markdown files",
    description: "14 specialized AI agents any agent runtime can load into any software project.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
