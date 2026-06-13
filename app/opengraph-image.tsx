import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Agenthood — A full AI engineering team as plain Markdown files";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#09090b",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ color: "#71717a", fontSize: 18, marginBottom: 24, letterSpacing: 4, textTransform: "uppercase" }}>
          Open source · AI dev tools
        </div>
        <div style={{ color: "#ffffff", fontSize: 64, fontWeight: 600, lineHeight: 1.1, marginBottom: 32 }}>
          agenthood
        </div>
        <div style={{ color: "#71717a", fontSize: 28, lineHeight: 1.4, maxWidth: 800 }}>
          A full AI engineering team as plain Markdown files.
        </div>
        <div style={{ color: "#3f3f46", fontSize: 20, marginTop: 48 }}>
          agenthood.flabs.tech
        </div>
      </div>
    ),
    size
  );
}
