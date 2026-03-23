import { ScannedItem } from "@/types";

/**
 * 统一存储提供商接口
 * 所有的后端驱动（OpenList, AList, 本地系统等）都必须实现此接口
 */
export interface StorageProvider {
  /**
   * 列出指定目录下的文件与文件夹
   * @param path 绝对路径或相对于挂载点的路径（通常以 / 开头）
   */
  listDir(path: string): Promise<ScannedItem[]>;

  /**
   * 获取单个文件的详细信息及直链
   * @param path 文件完整路径
   */
  getFile(path: string): Promise<{
    raw_url: string;
    size: number;
    name: string;
    modified?: string;
  }>;

  /**
   * 获取提供商名称（识别用）
   */
  readonly providerName: string;
}

/**
 * 存储提供商配置项
 */
export interface StorageConfig {
  id: number;
  name: string;
  host: string;
  token: string;
  type?: string; // 预留：openlist | alist | local
}
