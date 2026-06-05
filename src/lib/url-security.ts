import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "./errors";

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  const mappedV4Match = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(normalized);
  if (mappedV4Match) {
    return isBlockedIPv4(mappedV4Match[1]);
  }

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fec0:")
  );
}

function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIPv4(ip);
  if (family === 6) return isBlockedIPv6(ip);
  return true;
}

export async function assertAllowedOutboundUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw AppError.badRequest(`URL 格式无效：无法解析 "${rawUrl}"`);
  }

  if (parsed.username || parsed.password) {
    throw AppError.badRequest("URL 不允许包含用户名或密码凭据");
  }

  const allowInsecureHttp = process.env.OPENLIST_ALLOW_INSECURE_HTTP === "true";
  if (parsed.protocol !== "https:" && !(allowInsecureHttp && parsed.protocol === "http:")) {
    throw AppError.badRequest("仅允许使用 HTTPS 协议访问 OpenList 主机");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw AppError.badRequest(`不允许访问私有主机名：${hostname}`);
  }

  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw AppError.badRequest(`不允许访问私有 IP 地址：${hostname}`);
    }
    return parsed;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: false });
  if (addresses.length === 0 || addresses.some((entry) => isBlockedIp(entry.address))) {
    throw AppError.badRequest(`主机 ${hostname} 解析到私有或不支持的 IP 地址`);
  }

  return parsed;
}
