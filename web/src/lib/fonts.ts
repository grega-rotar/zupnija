import { Inter, Instrument_Serif } from "next/font/google";

/*
 * The two faces of the site and the editor (design v4):
 * Inter carries everything; Instrument Serif italic is the one sacred
 * accent, used for a single phrase in a headline.
 */
export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  axes: ["opsz"],
});

export const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const fontVariables = `${inter.variable} ${instrumentSerif.variable}`;
