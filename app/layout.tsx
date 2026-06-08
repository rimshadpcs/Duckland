import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feynduck | You've studied for hours. You still can't explain it.",
  description:
    "Explain the concept to your AI duck. Feynduck finds exactly where your understanding breaks and fixes it before the exam does.",
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
