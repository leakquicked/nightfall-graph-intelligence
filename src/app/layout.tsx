import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NIGHTFALL — Ghost Protocol",
  description: "Пространство исследования связей и цифровых активов. Данные графа явно помечены как Demo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}

