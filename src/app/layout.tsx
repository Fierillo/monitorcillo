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
  title: "Monitorcillo Imperial",
  description: "Datos económicos bajo la luz del imperio",
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
      </body>
    </html>
  );
}
