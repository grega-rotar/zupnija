import { Inter, Instrument_Serif } from "next/font/google";

/*
 * The two faces of the site and the editor (design v4):
 * Inter carries everything; Instrument Serif italic is the one sacred
 * accent, used for a single phrase in a headline.
 *
 * Kept small, because the fonts load at the same priority as the hero photo:
 * Inter without its optical-size axis (that axis alone tripled the files),
 * and only the italic of Instrument Serif (nothing uses its upright).
 */
export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: "italic",
  display: "swap",
});

export const fontVariables = `${inter.variable} ${instrumentSerif.variable}`;
