import "@/app/globals.css";
import type { Metadata } from "next";
import { Providers } from "@/components/providers";

const appDomain = "https://glazecorp.vercel.app";
const heroImageUrl = `${appDomain}/media/hero.png`;
const splashImageUrl = `${appDomain}/media/icon.png`;

const miniAppEmbed = {
  version: "1",
  imageUrl: heroImageUrl,
  button: {
    title: "Enter the mine",
    action: {
      type: "launch_miniapp" as const,
      name: "We Glaze The World",
      url: appDomain,
      splashImageUrl,
      splashBackgroundColor: "#FEE7EC",
    },
  },
};

export const metadata: Metadata = {
  title: "We Glaze The World",
  description: "Claim the glaze factory and earn donuts on Base.",
  openGraph: {
    title: "We Glaze The World",
    description: "Race the hive to control the donut mine and keep the glaze flowing.",
    url: appDomain,
    images: [
      {
        url: heroImageUrl,
      },
    ],
  },
  other: {
    "fc:miniapp": JSON.stringify(miniAppEmbed),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
