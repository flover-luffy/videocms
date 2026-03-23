// src/lib/email-blocklist.ts

// 常见的临时/一次性邮箱域名黑名单
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "temp-mail.org",
  "tempmail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "yopmail.com",
  "mailinator.com",
  "throwawaymail.com",
  "maildrop.cc",
  "trashmail.com",
  "temp-mail.io",
  "dispostable.com",
  "getairmail.com",
  "nada.ltd",
  "tempm.com",
]);

/**
 * 检查邮箱是否为临时邮箱
 * @param email 邮箱地址
 * @returns 如果是临时邮箱则返回 true
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes("@")) return true;

  const domain = email.split("@")[1].toLowerCase();

  // 检查完全匹配
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return true;
  }

  // 检查是否包含某些明显的垃圾域名前缀/后缀（可选的启发式规则）
  if (domain.includes("10minute") || domain.includes("tempmail")) {
    return true;
  }

  return false;
}
