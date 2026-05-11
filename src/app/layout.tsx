import type { Metadata } from "next";
import { Cinzel, Libre_Baskerville } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Monitorcillo",
  description: "El precio de la paz es la eterna vigilancia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${cinzel.variable} ${libreBaskerville.variable}`}>
      <body className={`${cinzel.variable} ${libreBaskerville.variable} antialiased`}>
        {children}
        <footer className="border-t border-imperial-gold/40 px-4 py-5 text-center text-xs font-bold tracking-widest text-imperial-cyan sm:text-sm">
          <a
            href="https://github.com/Fierillo/monitorcillo"
            target="_blank"
            rel="noreferrer"
            className="text-imperial-gold transition-colors hover:text-white focus-visible:text-white"
          >
            Monitorcillo
          </a>{' '}
          fue hecho con amor por{' '}
          <a
            href="https://github.com/Fierillo"
            target="_blank"
            rel="noreferrer"
            className="text-imperial-gold transition-colors hover:text-white focus-visible:text-white"
          >
            Fierillo
          </a>
        </footer>
      </body>
    </html>
  );
}
