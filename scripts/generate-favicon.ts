import sharp from "sharp";
import fs from "fs";

async function generateFavicons() {
  const inputPath = "public/logo.png";
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Logo file not found at ${inputPath}`);
  }

  console.log("⏳ Generating favicon.ico and app icons...");

  // Load the trimmed transparent logo
  const logo = sharp(inputPath);
  const metadata = await logo.metadata();
  const { width, height } = metadata;

  // Create a square canvas (512x512) and center the logo with 6% padding
  const size = 512;
  const padding = Math.round(size * 0.06);
  const maxDim = size - padding * 2;

  const scale = Math.min(maxDim / width!, maxDim / height!);
  const targetW = Math.round(width! * scale);
  const targetH = Math.round(height! * scale);

  const resizedLogo = await logo
    .resize(targetW, targetH, { fit: "contain" })
    .toBuffer();

  const square512 = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    {
      input: resizedLogo,
      gravity: "center",
    },
  ]);

  const square512Buffer = await square512.png().toBuffer();

  // 1. app/icon.png & public/icon.png
  await sharp(square512Buffer)
    .resize(32, 32)
    .png()
    .toFile("app/icon.png");

  await sharp(square512Buffer)
    .resize(192, 192)
    .png()
    .toFile("public/icon-192.png");

  await sharp(square512Buffer)
    .resize(512, 512)
    .png()
    .toFile("public/icon-512.png");

  // 2. apple-icon.png (180x180)
  await sharp(square512Buffer)
    .resize(180, 180)
    .png()
    .toFile("app/apple-icon.png");

  await sharp(square512Buffer)
    .resize(180, 180)
    .png()
    .toFile("public/apple-touch-icon.png");

  // 3. favicon.ico
  const icoBuffer32 = await sharp(square512Buffer)
    .resize(32, 32)
    .png()
    .toBuffer();

  fs.writeFileSync("app/favicon.ico", icoBuffer32);
  fs.writeFileSync("public/favicon.ico", icoBuffer32);
  fs.writeFileSync("favicon.ico", icoBuffer32);

  console.log("✅ Successfully created all favicons and icons!");
}

generateFavicons().catch(console.error);
