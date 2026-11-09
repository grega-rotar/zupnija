import { Inter } from "next/font/google";

/*
 * The one face of the site and the editor (design v4): Inter carries
 * everything, headings included (ZUP-14 retired the serif italic accent).
 *
 * Kept small, because the font loads at the same priority as the hero photo:
 * Inter without its optical-size axis (that axis alone tripled the files).
 */
export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const fontVariables = inter.variable;
