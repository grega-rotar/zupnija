import { describe, expect, it } from "vitest";
import { assetUrl, checkFile, extension, fileValue, hotspotAt, imageSize, withImage } from "./ImageField.media";

const IMG = "image-04fb30d344234886b7ad01f1a50d9f02b42ddc52-3840x2634-jpg";
const PDF = "file-92e11eb0fb18d9ebf907d1e55e695021f632d8ce-pdf";

describe("asset ids", () => {
  it("builds the /media URL in @sanity/image-url's path shape", () => {
    expect(assetUrl(IMG)).toBe(`/media/images/hnwav9pa/production/04fb30d344234886b7ad01f1a50d9f02b42ddc52-3840x2634.jpg`);
    expect(assetUrl(PDF)).toBe(`/media/files/hnwav9pa/production/92e11eb0fb18d9ebf907d1e55e695021f632d8ce.pdf`);
    expect(assetUrl("nonsense")).toBeNull();
    expect(assetUrl(undefined)).toBeNull();
  });
  it("reads the size and extension", () => {
    expect(imageSize(IMG)).toEqual({ width: 3840, height: 2634 });
    expect(imageSize(PDF)).toBeNull();
    expect(extension(PDF)).toBe("PDF");
    expect(extension(IMG)).toBe("JPG");
    expect(extension("Oznanila november.docx")).toBe("DOCX");
    expect(extension("brez")).toBeNull();
  });
});

describe("hotspotAt", () => {
  it("stores the point Sanity-style with the largest box inside the image", () => {
    expect(hotspotAt(0.5, 0.5)).toEqual({ _type: "sanity.imageHotspot", x: 0.5, y: 0.5, width: 1, height: 1 });
    expect(hotspotAt(0.25, 0.9)).toEqual({ _type: "sanity.imageHotspot", x: 0.25, y: 0.9, width: 0.5, height: 0.2 });
  });
  it("clamps to the image and rounds", () => {
    const h = hotspotAt(-0.3, 1.4);
    expect([h.x, h.y]).toEqual([0, 1]);
    expect(h.width).toBeGreaterThan(0);
    expect(hotspotAt(0.123456, 0.5).x).toBe(0.123);
    expect(hotspotAt(Number.NaN, 0.5).x).toBe(0.5);
  });
});

describe("withImage / fileValue", () => {
  const up = { id: "image-ab-10x20-png", url: "/x", width: 10, height: 20, filename: "a.png" };
  it("a new picture keeps alt, caption, _type and _key, and drops the old focal point", () => {
    const prev = { _type: "imageWithAlt", _key: "k", asset: { _type: "reference" as const, _ref: IMG }, alt: "A", caption: "C", hotspot: hotspotAt(0.1, 0.1), crop: { top: 0.1 } };
    expect(withImage(prev, up)).toEqual({ _type: "imageWithAlt", _key: "k", asset: { _type: "reference", _ref: up.id }, alt: "A", caption: "C" });
  });
  it("a first picture gets the given _type", () => {
    expect(withImage(null, up)).toEqual({ _type: "image", asset: { _type: "reference", _ref: up.id } });
  });
  it("file value in the studio's shape", () => {
    expect(fileValue({ id: PDF, url: "/f" })).toEqual({ _type: "file", asset: { _type: "reference", _ref: PDF } });
    expect(fileValue({ id: PDF, url: "/f" }, "k")).toMatchObject({ _key: "k" });
  });
});

describe("checkFile", () => {
  const f = (name: string, type: string, size = 1000) => ({ name, type, size }) as File;
  it("refuses big files, non-images for pictures and types outside accept", () => {
    expect(checkFile(f("a.jpg", "image/jpeg", 21 * 1024 * 1024), "image")).toMatch(/prevelika/);
    expect(checkFile(f("a.pdf", "application/pdf"), "image")).toMatch(/ni slika/);
    expect(checkFile(f("a.jpg", "image/jpeg"), "image")).toBeNull();
    expect(checkFile(f("a.exe", "application/x-msdownload"), "file", ".pdf,.docx")).toMatch(/PDF, DOCX/);
    expect(checkFile(f("A.PDF", "application/pdf"), "file", ".pdf,.docx")).toBeNull();
    expect(checkFile(f("a.png", "image/png"), "file", "image/*")).toBeNull();
  });
});
