/**
 * 应用常量定义
 * 避免魔法数字和硬编码值
 */

// ============ 时间常量（毫秒） ============
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

// ============ WebSocket常量 ============
export const WEBSOCKET = {
  HEARTBEAT_INTERVAL: 20 * TIME.SECOND,
  HEARTBEAT_TIMEOUT: 60 * TIME.SECOND,
  HEARTBEAT_CHECK_INTERVAL: 30 * TIME.SECOND,
  RECONNECT_MAX_ATTEMPTS: 5,
  RECONNECT_BASE_DELAY: 1000,
  RECONNECT_MAX_DELAY: 16000,
} as const;

// ============ 缓存常量 ============
export const CACHE = {
  DEFAULT_TTL: 5 * TIME.MINUTE,
  STALE_MULTIPLIER: 3,
  MAX_SIZE: 10000,
} as const;

// ============ 认证常量 ============
export const AUTH = {
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_BCRYPT_ROUNDS: 12,
  RESET_TOKEN_EXPIRES: 15 * TIME.MINUTE,
  ACCESS_TOKEN_MAX_AGE: 2 * TIME.HOUR,
  REFRESH_TOKEN_MAX_AGE: 7 * TIME.DAY,
  TOKEN_BLACKLIST_TTL: 7 * TIME.DAY,
} as const;

// ============ 速率限制常量 ============
export const RATE_LIMIT = {
  AUTH_WINDOW: TIME.MINUTE,
  AUTH_MAX_REQUESTS: 5,
  PASSWORD_RESET_WINDOW: TIME.MINUTE,
  PASSWORD_RESET_MAX: 3,
  API_WINDOW: TIME.MINUTE,
  API_MAX_REQUESTS: 100,
  DANMAKU_WINDOW: TIME.MINUTE,
  DANMAKU_MAX: 30,
  SEARCH_WINDOW: TIME.MINUTE,
  SEARCH_MAX: 20,
} as const;

// ============ 播放器常量 ============
export const PLAYER = {
  PROGRESS_SAVE_INTERVAL: 10 * TIME.SECOND,
  CONTROLS_HIDE_DELAY: 3 * TIME.SECOND,
  SEEK_PREVIEW_WIDTH: 160,
  SEEK_PREVIEW_HEIGHT: 90,
  VOLUME_STEP: 0.1,
  PLAYBACK_SPEEDS: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
  STALL_DETECTION_TIMEOUT: 5 * TIME.SECOND,
  BUFFER_AHEAD_TIME: 0.5, // 秒
} as const;

// ============ HLS配置常量 ============
export const HLS = {
  MAX_BUFFER_LENGTH: 30, // 秒
  MAX_BUFFER_SIZE: 60 * 1024 * 1024, // 60MB
  MAX_BUFFER_HOLE: 0.5, // 秒
  MANIFEST_LOADING_MAX_RETRY: 4,
  LEVEL_LOADING_MAX_RETRY: 4,
  MEDIA_ERROR_RECOVERY_MAX: 2,
} as const;

// ============ 弹幕常量 ============
export const DANMAKU = {
  DEFAULT_OPACITY: 1,
  DEFAULT_FONT_SIZE: 25,
  DEFAULT_SPEED: 1,
  DEFAULT_AREA: 0.5,
  DEFAULT_UNLIMITED: false,
  FETCH_LIMIT: 1000,
  ROLLING_DURATION: 10000, // 滚动弹幕持续时间（毫秒）
  FIXED_DURATION: 5000, // 顶部/底部弹幕持续时间（毫秒）
} as const;

// ============ 媒体处理常量 ============
export const MEDIA = {
  POSTER_WIDTH: 500,
  BACKDROP_WIDTH: 1280,
  THUMBNAIL_WIDTH: 300,
  MAX_FILE_SIZE: 10 * 1024 * 1024 * 1024, // 10GB
  SUPPORTED_VIDEO_FORMATS: ['.mp4', '.mkv', '.avi', '.mov', '.webm'],
  SUPPORTED_SUBTITLE_FORMATS: ['.srt', '.vtt', '.ass'],
} as const;

// ============ 分页常量 ============
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
} as const;

// ============ 文件系统常量 ============
export const FS = {
  TEMP_DIR: '/tmp',
  UPLOAD_DIR: '/uploads',
  MAX_FILENAME_LENGTH: 255,
} as const;

// ============ HTTP状态码 ============
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============ WebSocket消息类型 ============
export const WS_MESSAGE_TYPE = {
  JOIN: 'join',
  LEAVE: 'leave',
  SYNC: 'sync',
  CHAT: 'chat',
  ROOM_STATE: 'room_state',
  ERROR: 'error',
  HEARTBEAT: 'heartbeat',
} as const;
