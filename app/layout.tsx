import "@/app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Donut Miner",
  description: "Glaze the donut, claim the throne.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
