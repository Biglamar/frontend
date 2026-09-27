import { ImageResponse } from "next/og";

export function renderSocialImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#0a0a0f",
        color: "#ffffff",
        padding: "72px",
        fontFamily: "Arial",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <div
          style={{
            display: "flex",
            width: "44px",
            height: "44px",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "12px",
            backgroundColor: "#a3e635",
            color: "#0a0a0f",
            fontSize: "27px",
            fontWeight: 700,
          }}
        >
          M
        </div>
        <span style={{ fontSize: "28px", fontWeight: 700 }}>MergeFi</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div
          style={{
            width: "88px",
            height: "6px",
            borderRadius: "3px",
            backgroundColor: "#a3e635",
          }}
        />
        {/* Satori (the /opengraph-image renderer) requires an explicit
            `display` on any element with more than one child. This heading had
            three (text, <br/>, text) and no display, which failed prerendering
            of /opengraph-image and took the whole production build down with
            it. Two spans in a flex column produce the same two-line layout
            without depending on <br/>. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: "64px",
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          <span>Merge code.</span>
          <span>Earn instantly.</span>
        </div>
        <div style={{ color: "#a1a1aa", fontSize: "26px" }}>
          Fund open source work. Pay on merge.
        </div>
      </div>
      <div style={{ color: "#71717a", fontSize: "20px" }}>
        STELLAR-POWERED OPEN SOURCE FUNDING
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
