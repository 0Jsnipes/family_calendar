import type { Metadata } from "next";
import Link from "next/link";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Hub",
  description: "Home Command Center for a family wall display.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
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
        {children}
        <nav className="legal-links" aria-label="Legal">
          <Link href="/privacy">Privacy Policy</Link>
          <span aria-hidden="true">•</span>
          <Link href="/terms">Terms of Service</Link>
        </nav>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
