import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const svgRaw = fs.readFileSync('public/relaylogo.svg', 'utf8');

  // Launch browser via system Edge
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({
    viewport: { width: 800, height: 800 },
    deviceScaleFactor: 2 // Gives 1600x1600 crisp resolution
  });

  // Twitter circular crop safety: Twitter crops avatars into a circle of diameter 800px.
  // The center is (400, 400).
  // A logo of width ~480px fits comfortably inside the circle (480 / 800 = 60% of circle diameter).
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 800px;
            height: 800px;
            background-color: #000000;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          .logo-wrapper {
            width: 480px;
            height: 480px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <div class="logo-wrapper">
          ${svgRaw}
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);

  // Take screenshot for Twitter PFP (1600x1600 high res PNG)
  const outputPathPng = 'public/twitter-profile.png';
  await page.screenshot({ path: outputPathPng });
  console.log('Generated:', outputPathPng);

  // Also generate 800x800 standard version
  const page800 = await browser.newPage({
    viewport: { width: 800, height: 800 },
    deviceScaleFactor: 1
  });
  await page800.setContent(html);
  await page800.screenshot({ path: 'public/relay-logo-black-pfp.png' });
  console.log('Generated: public/relay-logo-black-pfp.png');

  // Also create a standalone SVG with black background
  // Notice relaylogo.svg viewBox is 0 0 487 513. Let's create a square viewBox 0 0 512 512 with a black rect
  const svgBlackBg = `<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <rect width="800" height="800" fill="#000000" />
  <g transform="translate(156.5, 143.5)">
    <!-- Inner Relay Logo -->
    ${svgRaw.replace(/<\?xml.*?\?>/, '').replace(/<!--.*?-->/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
  </g>
</svg>
`;
  fs.writeFileSync('public/relaylogo-black-bg.svg', svgBlackBg);
  console.log('Generated: public/relaylogo-black-bg.svg');

  // Copy to brain artifacts folder so user can view/embed directly
  const artifactDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\f447708a-6330-42cf-a054-da6a8c78d162';
  if (fs.existsSync(artifactDir)) {
    fs.copyFileSync('public/twitter-profile.png', path.join(artifactDir, 'twitter-profile.png'));
    fs.copyFileSync('public/relay-logo-black-pfp.png', path.join(artifactDir, 'relay-logo-black-pfp.png'));
    fs.copyFileSync('public/relaylogo-black-bg.svg', path.join(artifactDir, 'relaylogo-black-bg.svg'));
    console.log('Copied to artifact directory');
  }

  await browser.close();
}

main().catch(console.error);
