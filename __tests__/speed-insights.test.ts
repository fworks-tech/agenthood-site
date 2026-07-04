import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Vercel Speed Insights", () => {
  it("is listed in package.json dependencies", async () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.dependencies["@vercel/speed-insights"]).toBeDefined();
  });

  it("is imported in root layout", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "app", "layout.tsx"), "utf8");
    expect(layout).toContain('import { SpeedInsights } from "@vercel/speed-insights/next"');
  });

  it("is rendered as JSX component in root layout", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "app", "layout.tsx"), "utf8");
    expect(layout).toContain("<SpeedInsights />");
  });
});

describe("Navbar analytics", () => {
  it("imports track from @vercel/analytics", () => {
    const navbar = fs.readFileSync(
      path.join(process.cwd(), "app", "components", "Navbar.tsx"),
      "utf8",
    );
    expect(navbar).toContain('import { track } from "@vercel/analytics"');
  });

  it("fires nav_click events on link clicks", () => {
    const navbar = fs.readFileSync(
      path.join(process.cwd(), "app", "components", "Navbar.tsx"),
      "utf8",
    );
    expect(navbar).toContain('track("nav_click"');
    expect(navbar).toContain("trackNav(link.label)");
  });
});

describe("middleware logging", () => {
  it("logs CORS rejections", () => {
    const middleware = fs.readFileSync(
      path.join(process.cwd(), "app", "middleware.ts"),
      "utf8",
    );
    expect(middleware).toContain('console.warn("middleware.cors_rejected"');
  });

  it("logs rate-limit hits", () => {
    const middleware = fs.readFileSync(
      path.join(process.cwd(), "app", "middleware.ts"),
      "utf8",
    );
    expect(middleware).toContain('console.warn("middleware.rate_limited"');
  });

  it("logs Upstash unavailability", () => {
    const middleware = fs.readFileSync(
      path.join(process.cwd(), "app", "middleware.ts"),
      "utf8",
    );
    expect(middleware).toContain('console.warn("middleware.upstash_unavailable"');
  });
});

describe("feedback route logging", () => {
  it("logs validation failures", async () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "app", "api", "studio", "feedback", "route.ts"),
      "utf8",
    );
    expect(content).toContain('logger.warn("feedback.validation_failed"');
    expect(content).toContain('logger.error("feedback.parse_failed"');
  });
});
