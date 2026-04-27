import { NextRequest } from "next/server";

const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_PATTERN = new RegExp(`^${IPV4_OCTET}(?:\\.${IPV4_OCTET}){3}$`);
const IPV6_PATTERN = /^[0-9a-f:]+$/i;

function getTrustedProxyCount(): number {
  const parsed = Number.parseInt(process.env.TRUSTED_PROXY_COUNT || "1", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

function normalizeIp(value: string): string {
  let normalized = value.trim();
  if (!normalized) return "";

  if (normalized.toLowerCase().startsWith("for=")) {
    normalized = normalized.slice(4).trim();
  }

  normalized = normalized.replace(/^"|"$/g, "");

  if (normalized.startsWith("[")) {
    const bracketEnd = normalized.indexOf("]");
    if (bracketEnd > 0) {
      normalized = normalized.slice(1, bracketEnd);
    }
  } else if (normalized.includes(".") && normalized.includes(":")) {
    const lastColon = normalized.lastIndexOf(":");
    const port = normalized.slice(lastColon + 1);
    if (/^\d+$/.test(port)) {
      normalized = normalized.slice(0, lastColon);
    }
  }

  const zoneIndex = normalized.indexOf("%");
  if (zoneIndex > -1) {
    normalized = normalized.slice(0, zoneIndex);
  }

  const mappedMatch = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(normalized);
  if (mappedMatch) {
    return mappedMatch[1];
  }

  return normalized;
}

function isValidIp(value: string): boolean {
  if (IPV4_PATTERN.test(value)) return true;
  return value.includes(":") && value.length <= 45 && IPV6_PATTERN.test(value);
}

function parseForwardedFor(value: string): string[] {
  return value
    .split(",")
    .map(normalizeIp)
    .filter((ip) => ip.length > 0 && isValidIp(ip))
    .slice(-16);
}

/**
 * 获取客户端真实 IP 地址
 * 仅在服务端环境使用
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const trustedProxyCount = getTrustedProxyCount();

  if (forwarded && trustedProxyCount > 0) {
    const ips = parseForwardedFor(forwarded);
    if (ips.length > trustedProxyCount) {
      const clientIpIndex = ips.length - trustedProxyCount - 1;
      return ips[clientIpIndex] ?? "unknown";
    }
  }

  if (realIp && trustedProxyCount > 0) {
    const normalizedRealIp = normalizeIp(realIp);
    if (isValidIp(normalizedRealIp)) {
      return normalizedRealIp;
    }
  }

  return "unknown";
}
