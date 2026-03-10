#!/bin/bash

# ============================================================
# VideoCMS 数据库备份脚本（含异地推送）
# 用法: ./scripts/backup-db.sh
#
# 定时任务配置（Cron）:
#   0 */6 * * * cd /path/to/videocms && ./scripts/backup-db.sh >> /var/log/videocms-backup.log 2>&1
#
# 支持的异地推送方式（通过环境变量控制）:
#   - BACKUP_S3_BUCKET:    推送到 S3 / MinIO / Cloudflare R2
#   - BACKUP_REMOTE_HOST:  通过 rsync 推送到远端服务器
# ============================================================

set -euo pipefail

# ---------- 配置 ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql"
MAX_LOCAL_DAYS=7

# ---------- 本地备份 ----------

mkdir -p "$BACKUP_DIR"

# 使用 docker exec 调用 PostgreSQL 容器内的 pg_dump
if docker ps | grep -q 'videocms_db'; then
    echo "   使用 docker exec videocms_db 进行 pg_dump"
    # 加载 .env 环境变量以获取用户名和库名
    if [ -f "${PROJECT_DIR}/.env" ]; then
        export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
    fi
    # 提取 Postgres 信息，若未在 env 定义则使用默认值
    DB_USER="postgres"
    DB_NAME="videocms"

    # 执行备份
    docker exec videocms_db pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
else
    echo "❌ [$(date)] 错误：未找到运行中的 videocms_db 容器"
    exit 1
fi

echo "🗜️  正在压缩备份..."
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ 本地备份完成: ${BACKUP_FILE} (${SIZE})"

# ---------- 异地推送 ----------

REMOTE_PUSHED=false

# 方案 A：推送到 S3 / MinIO / Cloudflare R2
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
    echo "☁️  正在推送到 S3: ${BACKUP_S3_BUCKET} ..."
    if command -v aws &> /dev/null; then
        aws s3 cp "$BACKUP_FILE" "s3://${BACKUP_S3_BUCKET}/videocms-backups/" --quiet
        echo "☁️  S3 推送成功"
        REMOTE_PUSHED=true
    else
        echo "⚠️  已配置 BACKUP_S3_BUCKET 但未安装 aws cli，跳过 S3 推送"
    fi
fi

# 方案 B：通过 rsync 推送到远端服务器
if [ -n "${BACKUP_REMOTE_HOST:-}" ]; then
    REMOTE_DIR="${BACKUP_REMOTE_DIR:-~/videocms-backups}"
    echo "☁️  正在推送到远程主机: ${BACKUP_REMOTE_HOST}:${REMOTE_DIR} ..."
    if command -v rsync &> /dev/null; then
        rsync -az "$BACKUP_FILE" "${BACKUP_REMOTE_HOST}:${REMOTE_DIR}/"
        echo "☁️  远程推送成功"
        REMOTE_PUSHED=true
    else
        echo "⚠️  已配置 BACKUP_REMOTE_HOST 但未安装 rsync，跳过远程推送"
    fi
fi

if [ "$REMOTE_PUSHED" = false ]; then
    echo "ℹ️  未配置异地推送（设置 BACKUP_S3_BUCKET 或 BACKUP_REMOTE_HOST 以启用）"
fi

# ---------- 清理旧备份 ----------

echo "🧹 清理 ${MAX_LOCAL_DAYS} 天前的本地旧备份..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +${MAX_LOCAL_DAYS} -delete -print | wc -l)
echo "   已清理 ${DELETED_COUNT} 个旧备份文件"

echo "✨ [$(date)] 备份流程全部完成！"
