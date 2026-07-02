import { listTeamPlayerSummaries } from "@/lib/team-query";
import { listSeasons } from "@/lib/seasons";
import { TeamsPageClient } from "./teams-page-client";

export default async function TeamsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const seasons = await listSeasons();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const latestSeasonId = seasons[0]?.id ?? "";
  const seasonIdParam = Array.isArray(resolvedSearchParams.seasonId)
    ? resolvedSearchParams.seasonId[0]
    : resolvedSearchParams.seasonId;
  const playerNameParam = Array.isArray(resolvedSearchParams.playerName)
    ? resolvedSearchParams.playerName[0]
    : resolvedSearchParams.playerName;
  const unionNameParam = Array.isArray(resolvedSearchParams.unionName)
    ? resolvedSearchParams.unionName[0]
    : resolvedSearchParams.unionName;
  const sideParam = Array.isArray(resolvedSearchParams.side) ? resolvedSearchParams.side[0] : resolvedSearchParams.side;
  const pageParam = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const seasonId = seasonIdParam || latestSeasonId;
  const selectedSide = sideParam === "ally" ? "ally" : "enemy";
  const page = Number.isFinite(Number(pageParam)) ? Math.max(1, Number(pageParam)) : 1;
  const teamPlayerResult = await listTeamPlayerSummaries({
    seasonId,
    playerName: playerNameParam || undefined,
    unionName: unionNameParam || undefined,
    isFriendly: selectedSide === "ally",
    page,
    pageSize: 20,
  });

  return (
    <TeamsPageClient
      seasons={seasons}
      teamPlayers={teamPlayerResult.items}
      total={teamPlayerResult.total}
      page={teamPlayerResult.page}
      pageSize={teamPlayerResult.pageSize}
      filters={{
        seasonId,
        playerName: playerNameParam || "",
        unionName: unionNameParam || "",
        side: selectedSide,
      }}
    />
  );
}
