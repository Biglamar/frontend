import { renderSocialImage } from "./social-image";

export const alt = "MergeFi: Fund open source work. Pay on merge.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderSocialImage();
}
