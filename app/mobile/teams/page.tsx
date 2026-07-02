import { getMobileTeamSeason } from "@/lib/seasons";
import { listTeamPlayerSummaries } from "@/lib/team-query";
import { MobileTeamsPageClient } from "./page-client";

export const dynamic = "force-dynamic";

export default async function MobileTeamsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const season = await getMobileTeamSeason();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const playerNameParam = Array.isArray(resolvedSearchParams.playerName)
    ? resolvedSearchParams.playerName[0]
    : resolvedSearchParams.playerName;
  const seasonId = season?.id ?? "";
  const teamPlayerResult = seasonId
    ? await listTeamPlayerSummaries({
        seasonId,
        playerName: playerNameParam || undefined,
        isFriendly: false,
        page: 1,
        pageSize: 20,
      })
    : {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      };

  return (
    <MobileTeamsPageClient
      key={`${seasonId}:${playerNameParam || ""}`}
      teamPlayers={teamPlayerResult.items}
      total={teamPlayerResult.total}
      pageSize={teamPlayerResult.pageSize}
      filters={{
        seasonId,
        playerName: playerNameParam || "",
      }}
    />
  );
}
