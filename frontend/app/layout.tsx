import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Heavy grotesque for headlines. Inter at 900 rather than a dedicated poster face such as
// Archivo Black, because those cover Latin only — Greek headings would silently fall back to a
// different typeface. Inter ships both scripts, so EN and EL headlines are set identically.
const display = Inter({
  variable: "--font-archivo-black",
  weight: ["800", "900"],
  subsets: ["latin", "greek"],
});

export const metadata: Metadata = {
  title: "Culture Fest Survey",
  description:
    "Help shape Culture Fest in Hersonissos — tell us what you want from the lineup, the pricing and the night.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
