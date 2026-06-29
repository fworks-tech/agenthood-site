import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const SITE_URL = "https://agenthood.flabs.tech";
const TITLE = "Agenthood — A full AI engineering team as plain Markdown files";
const DESCRIPTION =
  "14 specialized AI agents — architect, reviewer, security expert, DevOps engineer, and more — each a single Markdown skill file any agent runtime can load into any project. No lock-in. No configuration.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "AI agents",
    "developer tools",
    "Claude Code",
    "Cursor",
    "Markdown skill files",
    "AI engineering team",
    "open source",
  ],
  authors: [{ name: "Fabio Ritzel Borges", url: "https://flabs.tech" }],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Agenthood — AI engineering team as Markdown files",
    description: "14 specialized AI agents any runtime can load into any project. No lock-in. No config.",
    url: SITE_URL,
    siteName: "Agenthood",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Agenthood" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agenthood — AI engineering team as Markdown files",
    description: "14 specialized AI agents any runtime can load into any project. No lock-in. No config.",
    images: ["/opengraph-image"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Agenthood",
  description: DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Fabio Ritzel Borges", url: "https://flabs.tech" },
  codeRepository: "https://github.com/fworks-tech/agenthood",
  license: "https://github.com/fworks-tech/agenthood/blob/main/LICENSE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <head>
        <meta property="og:author" content="Fabio Ritzel Borges" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white focus:outline-none"
        >
          Skip to main content
        </a>
        <div id="main-content" className="flex flex-col flex-1">
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  );
}
