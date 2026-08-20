import type { Metadata } from "next";
import { Archivo, Archivo_Black, Geist, Geist_Mono, Noto_Sans_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SiteFooter } from "./components/SiteFooter";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* Poster type. Archivo Black sets Latin headlines and Archivo's variable width axis stretches the
   wordmark; neither ships Greek glyphs, so Noto Sans Display — variable up to weight 900, with a
   Greek subset — sits behind them in the stacks defined in globals.css and picks up Greek
   per glyph.

   adjustFontFallback is off on the Archivo faces deliberately: next/font otherwise registers a
   `local(Arial)` face into the *same* family, and Arial does have Greek, so it would capture
   every Greek glyph before Noto was ever reached. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  adjustFontFallback: false,
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
  adjustFontFallback: false,
});

const notoDisplay = Noto_Sans_Display({
  variable: "--font-noto-display",
  subsets: ["greek", "latin"],
});

export const metadata: Metadata = {
  title: "Culture Fest 2026",
  description:
    "Help shape Culture Fest 2026 at DIO Beach Club — tell us what you want from the night",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${archivoBlack.variable} ${notoDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          {/* The footer is a sibling of the page, not a child of it: body is the flex column, so
              the page keeps its own full-height shell and the footer lands underneath whatever
              that shell ends up being. It needs the translations but not the session. */}
          <AuthProvider>
            {children}
            <Analytics />
            <SpeedInsights />
          </AuthProvider>
          <SiteFooter />
        </LanguageProvider>
      </body>
    </html>
  );
}
