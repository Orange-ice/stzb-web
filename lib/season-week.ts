// 赛季周计算：纯函数，不落库。
// 规则（见 members_sync_claude.md §3）：
// 1. 开服日 = 赛季第 1 天；开服日所在自然周不算第 1 周。
// 2. 开服后下一个自然周一 00:00:00 = 第 1 周起点。
// 3. 每 7 天递增一周，周一 00:00:00 ~ 周日 23:59:59。
// 所有计算以中国时区(UTC+8)为基准，避免部署服务器时区影响。

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 返回该时刻所在自然周「周一 00:00:00（中国时区）」对应的真实 UTC 时刻。
function chinaWeekMondayStart(date: Date): Date {
  const shifted = new Date(date.getTime() + CHINA_OFFSET_MS);
  const dow = (shifted.getUTCDay() + 6) % 7; // 周一=0 ... 周日=6
  const mondayShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  ) - dow * DAY_MS;
  return new Date(mondayShifted - CHINA_OFFSET_MS);
}

// 赛季第 1 周起点（真实 UTC 时刻）。
export function firstWeekStart(startAt: Date): Date {
  return new Date(chinaWeekMondayStart(startAt).getTime() + 7 * DAY_MS);
}

// 计算 capturedAt 落在赛季第几周。
// 第 1 周之前（开服当周）返回 0。
export function weekNoOf(startAt: Date, capturedAt: Date): number {
  const first = firstWeekStart(startAt);
  if (capturedAt.getTime() < first.getTime()) {
    return 0;
  }
  const diffDays = Math.floor((capturedAt.getTime() - first.getTime()) / DAY_MS);
  return Math.floor(diffDays / 7) + 1;
}
