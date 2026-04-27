import { LRUCache } from "lru-cache";
import { randomInt, timingSafeEqual } from "node:crypto";

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
  for (let i = 0; i < 6; i++) {
    text += chars[randomInt(chars.length)];
  }

  // 生成 SVG
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

  // 背景噪声点
  for (let i = 0; i < 30; i++) {
    const x = randomInt(width * 1000) / 1000;
    const y = randomInt(height * 1000) / 1000;
    svg += `<circle cx="${x}" cy="${y}" r="1" fill="#3b82f6" fill-opacity="0.2" />`;
  }

  // 干扰线
  for (let i = 0; i < 3; i++) {
    svg += `<line x1="${randomInt(width * 1000) / 1000}" y1="${randomInt(height * 1000) / 1000}" x2="${randomInt(width * 1000) / 1000}" y2="${randomInt(height * 1000) / 1000}" stroke="#3b82f6" stroke-opacity="0.3" stroke-width="1" />`;
  }

  // 绘制文字 (分散排列并有随机倾斜)
  const colors = ["#ffffff", "#60a5fa", "#93c5fd"];
  const spacing = width / (text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const x = spacing * (i + 1) - 6;
    const y = 25 + (randomInt(5000) / 1000 - 2.5);
    const fontSize = 24 + randomInt(4000) / 1000;
    const rotate = randomInt(30000) / 1000 - 15;
    const color = colors[randomInt(colors.length)];

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

  const input = (userInput || "").trim();
  const answerBuffer = Buffer.from(answer, "utf8");
  const inputBuffer = Buffer.from(
    input.padEnd(answer.length, "\0").slice(0, answer.length),
    "utf8",
  );

  return input.length === answer.length && timingSafeEqual(answerBuffer, inputBuffer);
}
