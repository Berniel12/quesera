export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeInit } from "@/components/theme-init";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QUESERA",
  description: "Your personal future-casting tool. Track what signals point to next.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {process.env.NEXT_PUBLIC_POSTHOG_KEY && (
          <script
            async
            src="https://us-assets.i.posthog.com/static/array.js"
          />
        )}
        {process.env.NEXT_PUBLIC_POSTHOG_KEY && (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.posthog=window.posthog||[];window.posthog.init('${process.env.NEXT_PUBLIC_POSTHOG_KEY}',{api_host:'https://us.i.posthog.com',person_profiles:'identified_only'});`,
            }}
          />
        )}
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
