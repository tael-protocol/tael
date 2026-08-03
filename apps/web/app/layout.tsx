import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Delicious_Handrawn, DotGothic16 } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TaelAgent } from "./_components/agent";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Used only for the hand-drawn "t" in the wordmark and footer watermark.
const delicious = Delicious_Handrawn({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Pixel font used for the small "SECURITY" eyebrow on the CTA card.
const dot = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

const SITE_URL = "https://taelprotocol.xyz";
const TITLE = "Tael — The payment layer for autonomous AI agents";
const DESCRIPTION =
  "Tael lets AI agents pay for any API, MCP tool, model, or dataset per call in USDC on Stellar — no accounts, no API keys, no billing setup.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s — Tael",
  },
  description: DESCRIPTION,
  applicationName: "Tael",
  keywords: [
    "Tael",
    "Tael Protocol",
    "taelprotocol",
    "payment layer for AI agents",
    "AI agent payments",
    "agent payments",
    "pay per call API",
    "x402",
    "HTTP 402",
    "USDC",
    "Stellar",
    "MCP payments",
    "machine payments",
    "autonomous agents",
  ],
  authors: [{ name: "Tael", url: SITE_URL }],
  creator: "Tael",
  publisher: "Tael",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Tael",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    site: "@taelprotocol",
    creator: "@taelprotocol",
  },
};

/** Organization + WebSite structured data — helps Google attribute the brand
 *  name "Tael" and can surface the docs/community as sitelinks. */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Tael",
      alternateName: "Tael Protocol",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      description: DESCRIPTION,
      sameAs: [
        "https://x.com/taelprotocol",
        "https://github.com/tael-protocol/tael",
        "https://discord.gg/tcb6b7ZYha",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Tael",
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${delicious.variable} ${dot.variable}`}
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
        <TaelAgent />
      </body>
    </html>
  );
}
