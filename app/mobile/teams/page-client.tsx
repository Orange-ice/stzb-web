"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import styles from "./page.module.css";

type TeamPlayerSummary = {
  seasonId: string;
  seasonName: string;
  seasonCode: string;
  playerName: string;
  unionName: string | null;
  isFriendly: boolean;
  teamCount: number;
  totalStarSum: number;
  latestSnapshotTime: Date | string | null;
};

type TeamFilters = {
  seasonId: string;
  playerName: string;
};

type TeamPlayerSummaryListResult = {
  items: TeamPlayerSummary[];
  total: number;
  page: number;
  pageSize: number;
};

type MobileTeamPlayerDetail = {
  seasonId: string;
  seasonName: string;
  seasonCode: string;
  playerName: string;
  unionName: string | null;
  teams: Array<{
    id: string;
    snapshotTime: Date | string | null;
    totalStar: number | null;
    heroes: Array<{
      slotLabel: string;
      heroName: string;
      level: number | null;
      star: number | null;
      secondSkillName: string | null;
      secondSkillLevel: number | null;
      thirdSkillName: string | null;
      thirdSkillLevel: number | null;
    }>;
  }>;
};

function formatDateTime(date: Date | string | null) {
  if (!date) return "未设置";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatSkill(name: string | null, level: number | null) {
  if (!name) {
    return "-";
  }

  return level ? `${name} Lv.${level}` : name;
}

// 武将名结合红度与等级：LV.45 大乔_5
function formatHero(hero: { heroName: string; level: number | null; star: number | null }) {
  const name = hero.star != null ? `${hero.heroName}_${hero.star}` : hero.heroName;
  return hero.level != null ? `LV.${hero.level} ${name}` : name;
}

export function MobileTeamsPageClient({
  teamPlayers,
  total,
  pageSize,
  filters,
}: {
  teamPlayers: TeamPlayerSummary[];
  total: number;
  pageSize: number;
  filters: TeamFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [playerKeyword, setPlayerKeyword] = useState(filters.playerName);
  const [items, setItems] = useState(teamPlayers);
  const [nextPage, setNextPage] = useState(2);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
  const [headerHeight, setHeaderHeight] = useState(112);
  const [teamDetailOpen, setTeamDetailOpen] = useState(false);
  const [teamDetailLoading, setTeamDetailLoading] = useState(false);
  const [teamDetailError, setTeamDetailError] = useState("");
  const [teamDetail, setTeamDetail] = useState<MobileTeamPlayerDetail | null>(null);
  const [detailTarget, setDetailTarget] = useState<TeamPlayerSummary | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  const hasMore = items.length < total;

  function pushQuery(next: { playerName?: string }) {
    const params = new URLSearchParams();
    const playerName = next.playerName ?? playerKeyword;

    if (playerName.trim()) {
      params.set("playerName", playerName.trim());
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function closeTeamDetail() {
    setTeamDetailOpen(false);
    setTeamDetailLoading(false);
    setTeamDetailError("");
    setTeamDetail(null);
    setDetailTarget(null);
  }

  const loadMore = useEffectEvent(async () => {
    if (!hasMore || loadingMoreRef.current) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError("");

    try {
      const params = new URLSearchParams({
        seasonId: filters.seasonId,
        page: String(nextPage),
        pageSize: String(pageSize),
      });

      if (filters.playerName.trim()) {
        params.set("playerName", filters.playerName.trim());
      }

      const response = await fetch(`/api/mobile/teams?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: TeamPlayerSummaryListResult;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || "加载下一页失败");
      }

      setItems((current) => [...current, ...payload.data?.items || []]);
      setNextPage((current) => current + 1);
    } catch (error) {
      setLoadMoreError(error instanceof Error ? error.message : "加载下一页失败");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  });

  const openTeamDetail = useEffectEvent(async (player: TeamPlayerSummary) => {
    setDetailTarget(player);
    setTeamDetailOpen(true);
    setTeamDetailLoading(true);
    setTeamDetailError("");
    setTeamDetail(null);

    try {
      const params = new URLSearchParams({
        seasonId: player.seasonId,
        playerName: player.playerName,
        side: player.isFriendly ? "ally" : "enemy",
      });

      if (player.unionName) {
        params.set("unionName", player.unionName);
      }

      const response = await fetch(`/api/mobile/teams/detail?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: MobileTeamPlayerDetail;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || "加载队伍详情失败");
      }

      setTeamDetail(payload.data);
    } catch (error) {
      setTeamDetailError(error instanceof Error ? error.message : "加载队伍详情失败");
    } finally {
      setTeamDetailLoading(false);
    }
  });

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, nextPage, filters.seasonId, filters.playerName, pageSize]);

  useEffect(() => {
    const target = headerRef.current;
    if (!target) {
      return;
    }

    const updateHeight = () => {
      setHeaderHeight(target.getBoundingClientRect().height);
    };

    updateHeight();

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            updateHeight();
          });

    observer?.observe(target);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pushQuery({
      playerName: playerKeyword,
    });
  }

  const dialogSeasonLabel = teamDetail
    ? `${teamDetail.seasonName} / ${teamDetail.seasonCode}`
    : detailTarget
      ? `${detailTarget.seasonName} / ${detailTarget.seasonCode}`
      : "队伍详情";
  const dialogUnionName = teamDetail?.unionName ?? detailTarget?.unionName ?? null;

  return (
    <>
      <main className={styles.page}>
        <section className={styles.listPanel} style={{ paddingTop: headerHeight }}>
          <div ref={headerRef} className={styles.fixedHeaderShell}>
            <div className={styles.fixedHeader}>
              <div className={styles.listTopbar}>
                <form className={styles.searchForm} onSubmit={handleSubmit}>
                  <input
                    value={playerKeyword}
                    onChange={(event) => setPlayerKeyword(event.target.value)}
                    placeholder="请输入玩家名"
                  />
                  <button type="submit" disabled={isPending}>
                    {isPending ? "搜索中" : "搜索"}
                  </button>
                </form>
              </div>

              <div className={styles.headerRow}>
                <span>玩家</span>
                <span>同盟</span>
                <span>队伍数</span>
                <span>更新时间</span>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <div className={styles.empty}>
              <strong>没有匹配的玩家</strong>
              <span>请调整玩家名，或先从桌面端同步敌方队伍数据。</span>
            </div>
          ) : (
            <>
              <div className={styles.rows}>
                {items.map((player) => (
                  <button
                    type="button"
                    className={styles.rowButton}
                    key={`${player.seasonId}:${player.playerName}:${player.unionName ?? ""}:enemy`}
                    onClick={() => void openTeamDetail(player)}
                    aria-label={`查看 ${player.playerName} 的队伍详情`}
                  >
                    <span className={styles.playerName}>{player.playerName}</span>
                    <span className={styles.unionName}>{player.unionName || "-"}</span>
                    <span className={styles.teamCount}>
                      {player.teamCount}({player.totalStarSum})
                    </span>
                    <span className={styles.updateTime}>{formatDateTime(player.latestSnapshotTime)}</span>
                  </button>
                ))}
              </div>

              <div className={styles.listFooter}>
                <span>
                  已加载 {items.length} / {total}
                </span>
                {loadingMore ? <span>正在加载下一页...</span> : null}
                {!hasMore && total > 0 ? <span>已经到底了</span> : null}
                {loadMoreError ? <span className={styles.loadError}>{loadMoreError}</span> : null}
              </div>

              <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
            </>
          )}
        </section>
      </main>

      {teamDetailOpen ? (
        <div className={styles.dialogBackdrop} onClick={closeTeamDetail}>
          <div
            className={styles.dialogCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-team-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.dialogHeader}>
              <div className={styles.dialogHeading}>
                <h2 id="mobile-team-detail-title">
                  {(teamDetail?.playerName ?? detailTarget?.playerName ?? "玩家")}的队伍详情
                </h2>
                <p className={styles.dialogMeta}>
                  {dialogSeasonLabel}
                  {dialogUnionName ? ` / ${dialogUnionName}` : ""}
                </p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeTeamDetail}>
                关闭
              </button>
            </div>

            <div className={styles.dialogBody}>
              {teamDetailLoading ? (
                <div className={styles.statusCard}>
                  <strong>正在加载队伍详情</strong>
                </div>
              ) : teamDetailError ? (
                <div className={styles.statusCard}>
                  <strong>加载失败</strong>
                  <span>{teamDetailError}</span>
                </div>
              ) : teamDetail?.teams.length ? (
                <div className={styles.detailList}>
                  {teamDetail.teams.map((team, index) => (
                    <article className={styles.detailCard} key={team.id}>
                      <div className={styles.detailCardHeader}>
                        <strong>队伍 {index + 1}</strong>
                        <span>总红度 {team.totalStar ?? "-"}</span>
                        <span>{formatDateTime(team.snapshotTime)}</span>
                      </div>

                      <div className={styles.teamGrid}>
                        {team.heroes.map((hero) => (
                          <span className={styles.heroLine} key={`${team.id}-h-${hero.slotLabel}`}>
                            {formatHero(hero)}
                          </span>
                        ))}
                        {team.heroes.map((hero) => (
                          <span className={styles.skillLine} key={`${team.id}-s2-${hero.slotLabel}`}>
                            {formatSkill(hero.secondSkillName, hero.secondSkillLevel)}
                          </span>
                        ))}
                        {team.heroes.map((hero) => (
                          <span className={styles.skillLine} key={`${team.id}-s3-${hero.slotLabel}`}>
                            {formatSkill(hero.thirdSkillName, hero.thirdSkillLevel)}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.statusCard}>
                  <strong>没有找到队伍详情</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
