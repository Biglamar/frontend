import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MergeFi",
    short_name: "MergeFi",
    description:
      "Fund open source work and track contributor rewards through MergeFi.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#fbfbfd",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
