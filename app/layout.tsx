import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feynduck | You've studied for hours. You still can't explain it.",
  description:
    "Feynduck combines the Feynman Technique and rubber ducking into an AI-powered study loop. Explain what you studied, discover where your reasoning breaks, and rebuild the explanation until it finally clicks.",
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
