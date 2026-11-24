import * as THREE from "three";

const GLYPH: Record<string, number[]> = {
  "0": [1, 1, 1, 1, 1, 1, 0],
  "1": [0, 1, 1, 0, 0, 0, 0],
  "2": [1, 1, 0, 1, 1, 0, 1],
  "3": [1, 1, 1, 1, 0, 0, 1],
  "4": [0, 1, 1, 0, 0, 1, 1],
  "5": [1, 0, 1, 1, 0, 1, 1],
  "6": [1, 0, 1, 1, 1, 1, 1],
  "7": [1, 1, 1, 0, 0, 0, 0],
  "8": [1, 1, 1, 1, 1, 1, 1],
  "9": [1, 1, 1, 1, 0, 1, 1],
  "-": [0, 0, 0, 0, 0, 0, 1],
};

export function createLcd() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 200;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { canvas, tex };
}

export function drawLcd(canvas: HTMLCanvasElement, digits: string, tone: "arm" | "safe" | "dead" | "idle") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#120c09";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,176,32,0.05)";
  for (let y = 0; y < canvas.height; y += 4) ctx.fillRect(0, y, canvas.width, 2);

  if (tone === "dead") {
    ctx.fillStyle = "#3a2a1c";
    ctx.font = "600 42px sans-serif";
    ctx.fillText("NO SIGNAL", 96, 118);
    return;
  }

  const color = tone === "safe" ? "#d6e38a" : tone === "idle" ? "#8a5a28" : "#ffb020";
  const chars = digits.padStart(4, "0").slice(-4).split("");
  chars.forEach((ch, i) => {
    const x = 48 + i * 100 + (i > 1 ? 28 : 0);
    drawDigit(ctx, GLYPH[ch] ?? GLYPH["-"]!, x, 36, 64, 128, color);
  });
  ctx.fillStyle = color;
  ctx.fillRect(248, 78, 14, 14);
  ctx.fillRect(248, 112, 14, 14);
}

function drawDigit(
  ctx: CanvasRenderingContext2D,
  glyph: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  const t = Math.max(8, h * 0.1);
  const [a, b, c, d, e, f, g] = glyph;
  ctx.fillStyle = color;
  const hseg = (sx: number, sy: number, on: number | undefined) => {
    if (!on) return;
    ctx.fillRect(sx, sy, w - t * 2, t);
  };
  const vseg = (sx: number, sy: number, hh: number, on: number | undefined) => {
    if (!on) return;
    ctx.fillRect(sx, sy, t, hh);
  };
  hseg(x + t, y, a);
  vseg(x + w - t, y + t, h / 2 - t, b);
  vseg(x + w - t, y + h / 2, h / 2 - t, c);
  hseg(x + t, y + h - t, d);
  vseg(x, y + h / 2, h / 2 - t, e);
  vseg(x, y + t, h / 2 - t, f);
  hseg(x + t, y + h / 2 - t / 2, g);
}
