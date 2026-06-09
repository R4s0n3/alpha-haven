import Image from "next/image";
import { useRouter } from "next/router";
import React from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

import Countdown from "@/components/Countdown";
import LoadingSpinner from "@/components/LoadingSpinner";
import MaterialIcon from "@/components/MaterialIcon";
import RouteOfferCard from "@/components/RouteOfferCard";
import { api, type RouterOutputs } from "@/utils/api";
import {
  HOME_PLANET_ID,
  formatDuration,
  getPlanetById,
} from "@/utils/gameData";

type ActiveTrade = RouterOutputs["quest"]["getActiveTrades"][number];
type CompletedTrade = RouterOutputs["quest"]["getCompletedTrades"][number];

const Quests = () => {
  const router = useRouter();
  const utils = api.useContext();
  const planetId =
    typeof router.query.planet === "string" ? router.query.planet : undefined;
  const selectedPlanet = getPlanetById(planetId);
  const isPlanetBoard = Boolean(planetId);
  const isHomeContext = !planetId || planetId === HOME_PLANET_ID;
  const offers = api.quest.getOffers.useQuery(
    planetId ? { planetId } : undefined,
    {
      refetchInterval: 15000,
    },
  );
  const activeTrades = api.quest.getActiveTrades.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const completedTrades = api.quest.getCompletedTrades.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const [notice, setNotice] = React.useState<string | null>(null);

  const invalidateTradeViews = React.useCallback(async () => {
    await Promise.all([
      utils.quest.getOffers.invalidate(),
      utils.quest.getActiveTrades.invalidate(),
      utils.quest.getCompletedTrades.invalidate(),
      utils.fleet.getFleet.invalidate(),
      utils.user.getInventory.invalidate(),
      utils.user.getOverview.invalidate(),
    ]);
  }, [utils]);

  const acceptTrade = api.quest.acceptTrade.useMutation({
    onSuccess: async (result) => {
      setNotice(result.message);
      await invalidateTradeViews();
    },
    onError: (error) => setNotice(error.message),
  });
  const launchTrade = api.quest.launchTrade.useMutation({
    onSuccess: async (result) => {
      setNotice(result.message);
      await invalidateTradeViews();
    },
    onError: (error) => setNotice(error.message),
  });
  const abandonTrade = api.quest.abandonTrade.useMutation({
    onSuccess: async (result) => {
      setNotice(result.message);
      await invalidateTradeViews();
    },
    onError: (error) => setNotice(error.message),
  });

  if (offers.isLoading || activeTrades.isLoading) {
    return <LoadingSpinner />;
  }

  const activeTradeCount = activeTrades.data?.length ?? 0;

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-teal-300">
            Route Board
          </p>
          <h2 className="text-2xl font-black">
            {planetId ? selectedPlanet.name : "Visit A Foreign Planet"}
          </h2>
        </div>
        <div className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
          {activeTradeCount} occupied port{activeTradeCount === 1 ? "" : "s"}
        </div>
      </header>

      {notice && (
        <div className="bg-teal-500/15 rounded border border-teal-500/50 px-3 py-2 text-sm text-teal-100">
          {notice}
        </div>
      )}

      <section className="grid gap-3">
        <SectionTitle title="Port Queue" />
        {activeTrades.data?.length ? (
          activeTrades.data.map((trade) => (
            <ActiveTradeCard
              key={trade.id}
              trade={trade}
              isLaunching={launchTrade.isLoading}
              isAbandoning={abandonTrade.isLoading}
              canLaunchFromHere={isHomeContext}
              onRefresh={() => void invalidateTradeViews()}
              onLaunch={() => launchTrade.mutate({ tradeId: trade.id })}
              onAbandon={() => abandonTrade.mutate({ tradeId: trade.id })}
            />
          ))
        ) : (
          <EmptyState text="No routes are using your ports." />
        )}
      </section>

      <section className="grid gap-3">
        <SectionTitle title="Available Route Events" />
        {offers.data?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {offers.data.map((offer) => (
              <RouteOfferCard
                key={offer.id}
                offer={offer}
                isAccepting={acceptTrade.isLoading}
                onAccept={(rocketId) =>
                  acceptTrade.mutate({
                    offerId: offer.id,
                    rocketId,
                  })
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            text={
              isPlanetBoard
                ? "No route event is active here for your current ports, fleet, cargo, and H3 fuel."
                : "Route events appear occasionally while visiting foreign planets."
            }
          />
        )}
      </section>

      {completedTrades.data && completedTrades.data.length > 0 && (
        <section className="grid gap-3">
          <SectionTitle title="Recent Returns" />
          <div className="grid gap-2 md:grid-cols-2">
            {completedTrades.data.map((trade) => (
              <CompletedTradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

type ActiveTradeCardProps = {
  trade: ActiveTrade;
  isLaunching: boolean;
  isAbandoning: boolean;
  canLaunchFromHere: boolean;
  onRefresh: () => void;
  onLaunch: () => void;
  onAbandon: () => void;
};

const ActiveTradeCard = ({
  trade,
  isLaunching,
  isAbandoning,
  canLaunchFromHere,
  onRefresh,
  onLaunch,
  onAbandon,
}: ActiveTradeCardProps) => {
  const isLoading = trade.status === "LOADING";
  const isReadyToLaunch = trade.status === "READY_TO_LAUNCH";
  const isInRoute = trade.status === "IN_ROUTE";
  const isLanding = trade.status === "LANDING";
  const isStopped = trade.status === "STOPPED";
  const isBuyRoute = trade.tradeKind === "BUY";
  const statusLabel = isLoading
    ? "Loading"
    : isReadyToLaunch
      ? "Ready to launch"
      : isInRoute
        ? "On route"
        : isLanding
          ? "Landing"
          : trade.statusMessage ?? "Paused at home";

  return (
    <article className="bg-slate-900/85 grid gap-4 rounded border border-slate-700 p-3 md:grid-cols-[1fr_auto]">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <PlanetBadge
            planetName={trade.planetName}
            planetTexture={trade.planetTexture}
            characterImage={trade.characterImage}
            characterName={trade.characterName}
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold">{trade.title}</h3>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Port {trade.portSlot ?? "-"} · {statusLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MaterialIcon
            id={trade.requestedMaterial.id}
            amount={trade.requestedAmount}
            image={trade.requestedMaterial.image ?? undefined}
            label={`${isBuyRoute ? "Pay" : "Ship"} ${
              trade.requestedMaterial.name
            }`}
          />
          <MaterialIcon
            id={trade.fuelMaterialId ?? "fuel"}
            amount={trade.fuelRequired}
            image="/assets/game/materials/h3.png"
            label="H3 fuel"
          />
          <MaterialIcon
            id={trade.rewardMaterial.id}
            amount={trade.rewardAmount}
            image={trade.rewardMaterial.image ?? undefined}
            label={`${isBuyRoute ? "Returns" : "Pays"} ${
              trade.rewardMaterial.name
            }`}
          />
          <Metric
            icon={<ClockIcon className="h-5 w-5" />}
            label={isInRoute ? "Return" : "Deadline"}
            value={
              isInRoute && trade.arrivesAt ? (
                <Countdown target={trade.arrivesAt} onDone={onRefresh} />
              ) : (
                <Countdown target={trade.expiresAt} onDone={onRefresh} />
              )
            }
          />
        </div>

        <div className="grid gap-2 rounded bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{trade.rocketName ?? "Assigned rocket"}</span>
            <span className="text-slate-400">
              {formatDuration(trade.travelSeconds)} route
            </span>
          </div>
          {isLoading && (
            <>
              <ProgressBar value={trade.loadProgress} />
              <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
                <span>
                  {isBuyRoute ? "Payment" : "Cargo"} {trade.cargoLoaded}/
                  {trade.requestedAmount}
                </span>
                <span>
                  Fuel {trade.fuelLoaded}/{trade.fuelRequired}
                </span>
                {trade.loadedAt && (
                  <span>
                    Ready in{" "}
                    <Countdown target={trade.loadedAt} onDone={onRefresh} />
                  </span>
                )}
              </div>
            </>
          )}
          {isInRoute && (
            <>
              <ProgressBar value={trade.routeProgress} />
              <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
                <span>{trade.routeDistance} route units</span>
                <span>Reward pays on return</span>
              </div>
            </>
          )}
          {isLanding && (
            <div className="text-xs text-teal-200">
              Touchdown confirmed. Crew is resetting the pad for the next load.
            </div>
          )}
          {isStopped && (
            <div className="text-xs text-amber-200">
              {trade.statusMessage ?? "Paused at Alpha Haven."}
            </div>
          )}
          {isReadyToLaunch && (
            <div className="text-xs text-teal-200">
              {isBuyRoute ? "Payment" : "Cargo"} and H3 are packed. Launch
              before the route event closes.
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-[10rem] flex-col justify-center gap-2">
        {isReadyToLaunch && (
          <button
            type="button"
            disabled={isLaunching || !canLaunchFromHere}
            onClick={onLaunch}
            className="rounded border border-rose-300 bg-rose-500 px-4 py-2 text-sm font-bold text-white disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300"
          >
            {canLaunchFromHere ? "Launch" : "Launch From Home"}
          </button>
        )}
        {isLoading && (
          <button
            type="button"
            disabled
            className="rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-300"
          >
            Loading
          </button>
        )}
        {isInRoute && (
          <button
            type="button"
            disabled
            className="rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-300"
          >
            In Route
          </button>
        )}
        {isStopped && (
          <button
            type="button"
            disabled={isAbandoning}
            onClick={onAbandon}
            className="flex items-center justify-center gap-2 rounded border border-amber-300 bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300"
          >
            <XMarkIcon className="h-4 w-4" />
            Clear Route
          </button>
        )}
        {!isInRoute && !isStopped && (
          <button
            type="button"
            disabled={isAbandoning}
            onClick={onAbandon}
            className="flex items-center justify-center gap-2 rounded border border-slate-600 px-4 py-2 text-xs font-bold text-slate-300 disabled:text-slate-600"
          >
            <XMarkIcon className="h-4 w-4" />
            Drop Route
          </button>
        )}
      </div>
    </article>
  );
};

const CompletedTradeRow = ({ trade }: { trade: CompletedTrade }) => (
  <div className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm">
    <div className="min-w-0">
      <p className="truncate font-bold">{trade.title}</p>
      <p className="truncate text-xs text-slate-400">
        {trade.rocketName ?? "Rocket"} · {trade.planetName}
      </p>
    </div>
    <div className="flex items-center gap-2 text-teal-300">
      <CheckCircleIcon className="h-5 w-5" />
      <span>
        +{trade.rewardAmount} {trade.rewardMaterial.name}
      </span>
    </div>
  </div>
);

const PlanetBadge = ({
  planetName,
  planetTexture,
  characterImage,
  characterName,
}: {
  planetName: string;
  planetTexture?: string | null;
  characterImage: string;
  characterName: string;
}) => (
  <div className="flex shrink-0 items-center gap-2">
    <div className="relative h-12 w-12 overflow-hidden rounded border border-slate-700 bg-slate-950">
      <Image
        src={planetTexture ? `/assets/3D/${planetTexture}` : characterImage}
        alt={planetName}
        fill
        sizes="48px"
        className="object-cover"
      />
    </div>
    <div className="hidden min-w-0 sm:block">
      <p className="truncate text-sm font-bold">{planetName}</p>
      <p className="truncate text-xs text-slate-400">{characterName}</p>
    </div>
  </div>
);

const Metric = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex min-h-[4.75rem] flex-col justify-between rounded bg-slate-950/70 p-3">
    <div className="flex items-center gap-2 text-slate-400">
      {icon}
      <span className="text-xs uppercase tracking-wide">{label}</span>
    </div>
    <div className="text-sm font-bold text-slate-100">{value}</div>
  </div>
);

const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 overflow-hidden rounded bg-slate-800">
    <div
      className="h-full rounded bg-teal-400 transition-all"
      style={{
        width: `${Math.max(0, Math.min(100, value * 100))}%`,
      }}
    />
  </div>
);

const SectionTitle = ({ title }: { title: string }) => (
  <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
    <ArrowPathIcon className="h-5 w-5 text-teal-300" />
    <h3 className="text-sm font-black uppercase tracking-wide text-slate-200">
      {title}
    </h3>
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="rounded border border-dashed border-slate-700 bg-slate-900/50 p-4 text-center text-sm text-slate-400">
    {text}
  </div>
);

export default Quests;
