/**
 * Spreadsheets (xlsx/ods) and CSV become CSV text on the server, so the model
 * reads them as plain data in the prompt with no tools at all (FR-9).
 */
import * as XLSX from "xlsx";

/** CSV text of every non-empty sheet; several sheets get a "# List: <name>" header. */
export function sheetToCsv(bytes: Uint8Array, kind: "xlsx" | "ods" | "csv"): string {
  if (kind === "csv") return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "").trim();
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  const sheets = wb.SheetNames.map((name) => ({ name, csv: XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false }).trim() })).filter(
    (s) => s.csv.replace(/[,\s]/g, "") !== "",
  );
  if (sheets.length === 1) return sheets[0].csv;
  return sheets.map((s) => `# List: ${s.name}\n${s.csv}`).join("\n\n");
}
