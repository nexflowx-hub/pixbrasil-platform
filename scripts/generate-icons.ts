import sharp from "sharp";
import { readFile } from "fs/promises";

async function generateIcons() {
  const svg = await readFile("public/icons/icon.svg", "utf-8");

  // Standard icons
  for (const [size, name] of [
    [512, "icon-512.png"],
    [192, "icon-192.png"],
    [180, "apple-touch-icon.png"],
    [32, "favicon-32.png"],
  ] as const) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(`public/icons/${name}`);
    console.log(`✓ ${name}`);
  }

  // Maskable icon (safe zone: content within 80%)
  const maskableSvg = svg.replace(
    '<rect width="512" height="512" rx="112" fill="url(#bg)"/>',
    '<rect width="512" height="512" rx="0" fill="#02090B"/>'
  );
  const maskable = Buffer.from(maskableSvg);
  const inner = await sharp(maskable).resize(380, 380).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: "#02090B" },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile("public/icons/maskable-512.png");
  console.log("✓ maskable-512.png");
}

generateIcons().catch((e) => {
  console.error(e);
  process.exit(1);
});
