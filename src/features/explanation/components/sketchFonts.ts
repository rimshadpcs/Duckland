import { Bricolage_Grotesque, Caveat } from "next/font/google";

// Display and handwriting faces for the Sketchbook landing page; body text stays on Geist.
export const sketchDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-sketch-display",
  display: "swap",
});

export const sketchHand = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-sketch-hand",
  display: "swap",
});
