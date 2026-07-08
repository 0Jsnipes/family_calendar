import type { Metadata } from "next";
import Link from "next/link";
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
      <body>
        {children}
        <nav className="legal-links" aria-label="Legal">
          <Link href="/privacy">Privacy Policy</Link>
          <span aria-hidden="true">•</span>
          <Link href="/terms">Terms of Service</Link>
        </nav>
      </body>
    </html>
  );
}
