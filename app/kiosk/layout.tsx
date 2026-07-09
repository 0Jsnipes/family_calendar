import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Family Hub Kiosk",
  description: "Read-only wall display for Family Hub.",
  manifest: "/manifest-kiosk.webmanifest",
};

export default function KioskLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
