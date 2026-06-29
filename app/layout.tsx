import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Hub",
  description: "Home Command Center for a family wall display.",
  manifest: "/manifest.webmanifest",
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
