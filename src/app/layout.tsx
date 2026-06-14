import type { Metadata } from "next";
import "./globals.css";
import "./dashboard-polishes.css";

export const metadata: Metadata = {
  title: "Feynduck | You've studied for hours. You still can't explain it.",
  description:
    "Feynduck combines the Feynman Technique and rubber ducking: explain what you studied, find the gap, and rebuild it until it clicks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
