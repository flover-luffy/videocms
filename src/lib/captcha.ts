import { LRUCache } from "lru-cache";

declare global {
  var captchaCache: LRUCache<string, string> | undefined;
}

/**
 * 验证码存储 (Key: captcha_id, Value: answer)
 * 有效期 5 分钟
 * 使用 global 变量防止 Next.js 开发环境下 HMR 导致缓存丢失
 */
const captchaCache =
  globalThis.captchaCache ||
  new LRUCache<string, string>({
    max: 1000,
    ttl: 1000 * 60 * 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.captchaCache = captchaCache;
}

/**
 * 简单的 SVG 图形验证码生成器
 * 业务层逻辑处理。
 */

interface CaptchaResult {
  text: string; // 验证码文本
  data: string; // SVG 字符串
}

/**
 * 生成 4 位数字验证码及对应的 SVG
 * @param width 宽度
 * @param height 高度
 */
export function generateCaptcha(width = 120, height = 40): CaptchaResult {
  const chars = "0123456789";
  let text = "";
  for (let i = 0; i < 4; i++) {
    text += chars[Math.floor(Math.random() * chars.length)];
  }

  // 生成 SVG
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

  // 背景噪声点
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    svg += `<circle cx="${x}" cy="${y}" r="1" fill="#3b82f6" fill-opacity="0.2" />`;
  }

  // 干扰线
  for (let i = 0; i < 3; i++) {
    svg += `<line x1="${Math.random() * width}" y1="${Math.random() * height}" x2="${Math.random() * width}" y2="${Math.random() * height}" stroke="#3b82f6" stroke-opacity="0.3" stroke-width="1" />`;
  }

  // 绘制文字 (分散排列并有随机倾斜)
  const colors = ["#ffffff", "#60a5fa", "#93c5fd"];
  for (let i = 0; i < text.length; i++) {
    const x = 15 + i * 25;
    const y = 25 + (Math.random() * 5 - 2.5);
    const fontSize = 24 + Math.random() * 4;
    const rotate = Math.random() * 30 - 15;
    const color = colors[Math.floor(Math.random() * colors.length)];

    svg += `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-weight="900" font-size="${fontSize}" fill="${color}" transform="rotate(${rotate}, ${x}, ${y})">${text[i]}</text>`;
  }

  svg += `</svg>`;

  return { text, data: svg };
}

/**
 * 存入验证码答案
 */
export function setCaptcha(captchaId: string, text: string) {
  captchaCache.set(captchaId, text);
}

/**
 * 校验验证码且由于一次性性质会立即删除
 */
export function validateCaptcha(captchaId: string, userInput: string): boolean {
  const answer = captchaCache.get(captchaId);
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[CAPTCHA-LIB] Validating ID: ${captchaId}. Found answer in cache: ${answer}`,
    );
  }

  if (!answer) return false;

  captchaCache.delete(captchaId);
  return answer === (userInput || "").trim();
}
