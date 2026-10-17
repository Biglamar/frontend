import { ImageResponse } from "next/og";
import { fetchBounty } from "@/lib/api";
import { mockBounties } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";

export const alt = "MergeFi bounty";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function BountyOpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: bounty } = await fetchBounty(
    id,
    mockBounties.find((b) => b.id === id),
  );

  const title = bounty?.title ?? "Bounty not found";
  const repo = bounty ? `${bounty.org}/${bounty.repo}` : "MergeFi";
  const reward = bounty ? formatCurrency(bounty.reward, bounty.asset) : "";
  const status = bounty ? bounty.status.replace(/_/g, " ").toUpperCase() : "";

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
        <div style={{ display: "flex", color: "#a1a1aa", fontSize: "28px" }}>
          {repo}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "56px",
            fontWeight: 700,
            lineHeight: 1.1,
            maxHeight: "190px",
            overflow: "hidden",
          }}
        >
          {title.length > 100 ? `${title.slice(0, 97)}...` : title}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", color: "#a3e635", fontSize: "48px", fontWeight: 700 }}>
          {reward}
        </div>
        <div style={{ display: "flex", color: "#71717a", fontSize: "24px" }}>
          {status}
        </div>
      </div>
    </div>,
    size,
  );
}
