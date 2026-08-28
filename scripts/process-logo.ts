import sharp from "sharp";

async function makeTransparent() {
  const inputPath =
    "C:/Users/SokPhal/.gemini/antigravity/brain/86531338-f539-402e-b4f8-3c32473acda6/.user_uploaded/media_1787810544997.jpg";

  console.log("⏳ Processing logo image for complete clean transparent cutout...");

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width, height } = metadata;
  const w = width!;
  const h = height!;

  const raw = await image.ensureAlpha().raw().toBuffer();

  // Let's sample corner pixels to see black level
  console.log("Top-left pixel [0,0]:", raw[0], raw[1], raw[2], raw[3]);
  console.log("Top-right pixel [w-1,0]:", raw[(w - 1) * 4], raw[(w - 1) * 4 + 1], raw[(w - 1) * 4 + 2]);

  // Flood fill / color distance from pure black & dark backgrounds:
  // For each pixel:
  for (let i = 0; i < raw.length; i += 4) {
    const r = raw[i];
    const g = raw[i + 1];
    const b = raw[i + 2];

    // Perceived brightness or maximum channel
    const maxVal = Math.max(r, g, b);
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

    // The background in the image is black with JPEG noise up to ~35.
    // The colorful artwork (pink, white, crown, silver) has much higher saturation or brightness.
    if (brightness < 30 && maxVal < 40) {
      raw[i + 3] = 0; // Completely transparent!
    } else if (brightness < 60 && maxVal < 75) {
      // Smooth anti-aliased edge
      const factor = (maxVal - 35) / (75 - 35);
      raw[i + 3] = Math.min(255, Math.max(0, Math.round(factor * 255)));
    }
  }

  const processed = sharp(raw, {
    raw: { width: w, height: h, channels: 4 },
  })
    .trim({ threshold: 10 })
    .png({ compressionLevel: 9, quality: 100 });

  const buffer = await processed.toBuffer();

  await sharp(buffer).toFile("public/logo.png");
  await sharp(buffer).toFile("public/logo.png");
  await sharp(buffer).toFile("public/dytopup-logo.png");
  await sharp(buffer).toFile("public/logo.png");

  console.log("✅ Perfectly transparent logo generated!");
}

makeTransparent().catch(console.error);

