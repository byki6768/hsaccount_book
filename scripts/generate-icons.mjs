// 저축 돼지 아이콘 생성: node scripts/generate-icons.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "icons");

const piggy = `
  <!-- sparkles -->
  <path d="M118 128 l9 22 22 9 -22 9 -9 22 -9 -22 -22 -9 22 -9z" fill="#FFFFFF"/>
  <path d="M402 168 l6 15 15 6 -15 6 -6 15 -6 -15 -15 -6 15 -6z" fill="#FFD45C"/>
  <path d="M96 238 c0-8 10-12 15-5 5-7 15-3 15 5 0 9-15 17-15 17s-15-8-15-17z" fill="#FF8FAB"/>

  <!-- coin -->
  <circle cx="262" cy="118" r="50" fill="#FFD45C" stroke="#F2B21B" stroke-width="9"/>
  <circle cx="262" cy="118" r="33" fill="none" stroke="#FFE89A" stroke-width="5"/>
  <path d="M246 112 c0-10 12-15 16-6 4-9 16-4 16 6 0 11-16 21-16 21s-16-10-16-21z" fill="#F2A900"/>

  <!-- tail -->
  <path d="M112 300 c-26 -4 -30 -34 -10 -36 18 -2 18 22 0 26" fill="none" stroke="#F48FB1" stroke-width="9" stroke-linecap="round"/>

  <!-- legs -->
  <rect x="160" y="378" width="40" height="56" rx="16" fill="#F7A1BC"/>
  <rect x="214" y="384" width="40" height="52" rx="16" fill="#FFB6C9"/>
  <rect x="290" y="384" width="40" height="52" rx="16" fill="#FFB6C9"/>
  <rect x="340" y="378" width="40" height="56" rx="16" fill="#F7A1BC"/>

  <!-- body -->
  <ellipse cx="262" cy="300" rx="150" ry="118" fill="#FFB6C9"/>
  <ellipse cx="236" cy="262" rx="90" ry="46" fill="#FFCADA" opacity="0.8"/>

  <!-- ears -->
  <path d="M190 206 l-14 -52 50 26z" fill="#F48FB1"/>
  <path d="M318 196 l28 -46 14 54z" fill="#F48FB1"/>

  <!-- coin slot -->
  <rect x="226" y="190" width="72" height="13" rx="6.5" fill="#E0789A"/>

  <!-- face -->
  <circle cx="300" cy="278" r="12" fill="#4A3B47"/>
  <circle cx="304" cy="274" r="4" fill="#FFFFFF"/>
  <ellipse cx="318" cy="324" rx="20" ry="11" fill="#FF8FAB" opacity="0.6"/>
  <ellipse cx="392" cy="300" rx="40" ry="34" fill="#FF9BB5"/>
  <ellipse cx="380" cy="300" rx="7" ry="10" fill="#E0708F"/>
  <ellipse cx="404" cy="300" rx="7" ry="10" fill="#E0708F"/>
  <path d="M336 346 q14 12 28 0" fill="none" stroke="#4A3B47" stroke-width="6" stroke-linecap="round"/>
`;

const background = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E3F7EE"/>
      <stop offset="1" stop-color="#FFF3C9"/>
    </linearGradient>
  </defs>`;

/** 모바일·마스커블: 꽉 찬 배경 (OS가 모양을 잘라냄) */
function fullBleedSvg(scale = 1) {
  const offset = (512 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${background}
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${piggy}</g>
</svg>`;
}

/** 데스크톱·파비콘: 둥근 모서리 + 투명 바깥 */
function roundedSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${background}
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#bg)"/>
  <g transform="translate(36 36) scale(0.86)">${piggy}</g>
</svg>`;
}

async function png(svg, size, file) {
  const target = path.join(OUT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await sharp(Buffer.from(svg), { density: Math.max(144, size) })
    .resize(size, size)
    .png()
    .toFile(target);
  return target;
}

/** PNG 여러 장을 담은 .ico 파일 */
function writeIco(pngPaths, target) {
  const images = pngPaths.map((p) => fs.readFileSync(p));
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((img, i) => {
    const size = img.readUInt32BE(16);
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(img.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += img.length;
  });
  fs.writeFileSync(target, Buffer.concat([header, ...images]));
}

const mobileSvg = fullBleedSvg(1);
const maskableSvg = fullBleedSvg(0.78);
const desktopSvg = roundedSvg();

// 모바일 - 안드로이드
await png(mobileSvg, 192, "mobile/android/icon-192x192.png");
await png(mobileSvg, 512, "mobile/android/icon-512x512.png");
await png(maskableSvg, 192, "mobile/android/maskable-192x192.png");
await png(maskableSvg, 512, "mobile/android/maskable-512x512.png");

// 모바일 - 아이폰·아이패드 (홈 화면 추가)
for (const size of [120, 152, 167, 180]) {
  await png(mobileSvg, size, `mobile/ios/apple-touch-icon-${size}x${size}.png`);
}

// 데스크톱 - 브라우저 탭·윈도우·맥 설치
const icoParts = [];
for (const size of [16, 32, 48]) {
  icoParts.push(await png(desktopSvg, size, `desktop/favicon-${size}x${size}.png`));
}
for (const size of [64, 128, 256, 512]) {
  await png(desktopSvg, size, `desktop/icon-${size}x${size}.png`);
}
writeIco(icoParts, path.join(OUT, "desktop", "favicon.ico"));
fs.copyFileSync(
  path.join(OUT, "desktop", "favicon.ico"),
  path.join(process.cwd(), "app", "favicon.ico"),
);
fs.writeFileSync(path.join(OUT, "desktop", "icon.svg"), desktopSvg);
fs.writeFileSync(path.join(process.cwd(), "public", "logo.svg"), desktopSvg);

// 첫 화면 대표 이미지 (CSS로 모서리를 둥글게 자르므로 배경을 꽉 채움)
await sharp(Buffer.from(fullBleedSvg(0.9)), { density: 880 })
  .resize(880, 880)
  .png()
  .toFile(path.join(process.cwd(), "public", "account-book-hero.png"));

console.log("icons written to", OUT);
