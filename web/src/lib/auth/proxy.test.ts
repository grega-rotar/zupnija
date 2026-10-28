/** Host routing (FR-1): the proxy's pure decision function. */
import { describe, expect, it } from "vitest";
import { route } from "@/proxy";

const prod = { dev: false, adminHost: "admin.zupnija-pirnice.si" };
const dev = { dev: true, adminHost: undefined };

describe("route", () => {
  it("public host: /admin paths are 404, the site is untouched", () => {
    expect(route("zupnija-pirnice.si", "/admin", prod)).toEqual({ kind: "notFound" });
    expect(route("zupnija-pirnice.si", "/admin/teden", prod)).toEqual({ kind: "notFound" });
    expect(route("zupnija-pirnice.si", "/api/auth/get-session", prod)).toEqual({ kind: "notFound" });
    expect(route("zupnija-pirnice.si", "/", prod)).toEqual({ kind: "next" });
    expect(route("zupnija-pirnice.si", "/oznanila", prod)).toEqual({ kind: "next" });
    expect(route("zupnija-pirnice.si", "/administracija", prod)).toEqual({ kind: "next" });
    expect(route("zupnija-pirnice.si", "/api/health", prod)).toEqual({ kind: "next" });
  });

  it("admin host without a session: redirect to /prijava, except open paths", () => {
    const h = "admin.zupnija-pirnice.si";
    expect(route(h, "/", prod)).toEqual({ kind: "redirect", path: "/prijava" });
    expect(route(h, "/teden", prod)).toEqual({ kind: "redirect", path: "/prijava" });
    expect(route(h, "/prijava", prod)).toEqual({ kind: "rewrite", path: "/admin/prijava" });
    expect(route(h, "/prijava/potrdi", prod)).toEqual({ kind: "rewrite", path: "/admin/prijava/potrdi" });
    expect(route(h, "/api/auth/magic-link/verify", prod)).toEqual({ kind: "next" });
    expect(route(h, "/_next/static/chunk.js", prod)).toEqual({ kind: "next" });
    expect(route(h, "/icon.svg", prod)).toEqual({ kind: "next" });
    // dev pages are not open in production
    expect(route(h, "/dev/outbox", prod)).toEqual({ kind: "redirect", path: "/prijava" });
  });

  it("admin host with a session: rewrite under /admin", () => {
    const h = "Admin.Zupnija-Pirnice.si:443";
    expect(route(h, "/", { ...prod, hasSession: true })).toEqual({ kind: "rewrite", path: "/admin" });
    expect(route(h, "/teden", { ...prod, hasSession: true })).toEqual({ kind: "rewrite", path: "/admin/teden" });
  });

  it("development: admin.localhost on any port is the admin host, /dev is open", () => {
    expect(route("admin.localhost:3000", "/dev/outbox", dev)).toEqual({ kind: "rewrite", path: "/admin/dev/outbox" });
    expect(route("admin.localhost:4123", "/", dev)).toEqual({ kind: "redirect", path: "/prijava" });
    expect(route("localhost:3000", "/admin", dev)).toEqual({ kind: "notFound" });
    expect(route("admin.localhost:3000", "/", prod)).toEqual({ kind: "next" });
  });
});
