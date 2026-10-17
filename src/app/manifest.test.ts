import manifest from "./manifest";

describe("web app manifest", () => {
  it("provides standalone MergeFi install metadata and app icons", () => {
    expect(manifest()).toMatchObject({
      name: "MergeFi",
      short_name: "MergeFi",
      start_url: "/",
      display: "standalone",
      background_color: "#0a0a0f",
      theme_color: "#0a0a0f",
      icons: expect.arrayContaining([
        expect.objectContaining({ src: "/icon-192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/icon.png", sizes: "512x512" }),
        expect.objectContaining({ src: "/icon-maskable.png", purpose: "maskable" }),
        expect.objectContaining({ src: "/apple-icon.png", sizes: "180x180" }),
      ]),
    });
  });
});
