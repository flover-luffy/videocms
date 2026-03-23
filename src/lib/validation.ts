import { z } from "zod";

/**
 * 身份验证相关校验
 */
export const LoginSchema = z.object({
  email: z.string().email("无效的邮箱格式"),
  password: z.string().min(1, "密码不能为空"),
});

export const RegisterSchema = z.object({
  email: z.string().email("无效的邮箱格式"),
  code: z.string().length(6, "验证码必须是 6 位数字"),
  password: z
    .string()
    .min(12, "密码至少需要 12 位")
    .regex(/[A-Z]/, "必须包含大写字母")
    .regex(/[0-9]/, "必须包含数字")
    .regex(/[!@#$%^&*]/, "必须包含特殊字符"),
});

/**
 * 媒体导入相关校验
 */
export const ImportSchema = z.object({
  configId: z.number().int().positive(),
  path: z
    .string()
    .min(1, "路径不能为空")
    .max(500, "路径过长")
    .refine((p) => !p.includes(".."), "路径不能包含 .."),
  title: z.string().max(255, "标题过长").optional(),
});

/**
 * 播放进度相关校验
 */
export const ProgressSchema = z.object({
  episodeId: z.number().int().positive(),
  position: z.number().nonnegative().max(999999, "播放位置无效"),
  duration: z.number().nonnegative().max(999999, "时长无效").optional(),
});

/**
 * 搜索相关校验
 */
export const SearchSchema = z.object({
  q: z.string().min(1, "搜索词不能为空").max(100, "搜索词过长").trim(),
  type: z.enum(["all", "series", "album"]).optional(),
});

/**
 * OpenList 配置校验
 */
export const ConfigSchema = z.object({
  name: z.string().min(1),
  host: z.string().url("无效的 Host 地址"),
  token: z.string().min(1),
});
