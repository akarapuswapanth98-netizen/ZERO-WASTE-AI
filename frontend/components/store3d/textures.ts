import * as THREE from "three";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d") as CanvasRenderingContext2D };
}

/** Generic packaged-goods label: name + category band. No brands. */
export function makeLabelTexture(name: string, band: string, sub = ""): THREE.CanvasTexture {
  const { c, ctx } = canvas(256, 160);
  ctx.fillStyle = "#f5f1e6";
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, 256, 44);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Arial";
  ctx.fillText("ZERO", 12, 32);
  ctx.fillStyle = "#1c2420";
  ctx.font = "bold 25px Arial";
  const words = name.split(" ");
  ctx.fillText(words.slice(0, 2).join(" "), 12, 78, 232);
  ctx.font = "22px Arial";
  ctx.fillText(words.slice(2, 4).join(" "), 12, 106, 232);
  ctx.fillStyle = "#5b6472";
  ctx.font = "20px Arial";
  ctx.fillText(sub, 12, 138, 232);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Shelf-edge electronic label: SKU name, units, days to expiry on dark glass. */
export function makeShelfTagTexture(name: string, units: number, days: number): THREE.CanvasTexture {
  const { c, ctx } = canvas(512, 128);
  ctx.fillStyle = "#101815";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#e8f0ea";
  ctx.font = "bold 30px Arial";
  ctx.fillText(name.slice(0, 26), 14, 40, 484);
  ctx.font = "bold 34px Arial";
  ctx.fillText(`${units}u`, 14, 88);
  ctx.font = "30px Arial";
  ctx.fillStyle = days <= 2 ? "#ff9d9d" : "#cfe3d4";
  const right = days < 0 ? "expired" : `${days}d left`;
  ctx.fillText(right, 330, 88);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeSignTexture(text: string): THREE.CanvasTexture {
  const { c, ctx } = canvas(512, 128);
  ctx.fillStyle = "#0B3D2E";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#66E3A1";
  ctx.fillRect(0, 112, 512, 16);
  ctx.fillStyle = "#f2f7f2";
  ctx.font = "bold 56px Arial";
  ctx.textAlign = "center";
  ctx.fillText(text.toUpperCase(), 256, 82);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export const CAT_COLORS: Record<string, string> = {
  dairy: "#38bdf8",
  bakery: "#d9a45b",
  produce: "#4caf50",
  meat: "#e0655f",
  seafood: "#5fb4e0",
  "ready-to-eat": "#f59e0b",
};
