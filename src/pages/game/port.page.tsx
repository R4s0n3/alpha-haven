import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import React from "react";
import {
  BriefcaseIcon,
  GlobeAltIcon,
  RocketLaunchIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

import Countdown from "@/components/Countdown";
import DynamicBackground from "@/components/Background/DynamicBackground";
import InventoryHeader from "@/components/InventoryHeader";
import LandingPad from "@/components/LandingPad";
import LoadingSpinner from "@/components/LoadingSpinner";
import MainNavigation from "@/components/MainNavigation";
import RouteOfferCard from "@/components/RouteOfferCard";
import { api, type RouterOutputs } from "@/utils/api";
import { HOME_PLANET_ID, getPlanetById } from "@/utils/gameData";

type PortOffer = RouterOutputs["quest"]["getOffers"][number];
type PortTrade = RouterOutputs["quest"]["getActiveTrades"][number];
type LandingTrade = Pick<
  PortTrade,
  "id" | "portSlot" | "rocketName" | "rocketImage"
> & {
  status: "LANDING";
};

const ACTIVE_ROUTE_STATUSES = new Set([
  "LOADING",
  "READY_TO_LAUNCH",
  "IN_ROUTE",
  "LANDING",
  "STOPPED",
]);
const LANDING_ANIMATION_MS = 5000;
const LAUNCH_ANIMATION_MS = 2600;

export default function Port() {
  const { status } = useSession();
  const router = useRouter();
  const utils = api.useContext();
  const planetId =
    typeof router.query.planet === "string"
      ? router.query.planet
      : HOME_PLANET_ID;
  const planet = getPlanetById(planetId);
  const isHomePort = planet.id === HOME_PLANET_ID;
  const [notice, setNotice] = React.useState<string | null>(null);
  const [selectedJobPadSlot, setSelectedJobPadSlot] = React.useState<
    number | null
  >(null);
  const [launchingTradeIds, setLaunchingTradeIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [landingTrades, setLandingTrades] = React.useState<
    Map<string, LandingTrade>
  >(() => new Map());
  const previousRouteTradesRef = React.useRef<Map<string, PortTrade>>(
    new Map(),
  );
  const landingTimeoutsRef = React.useRef<Map<string, number>>(new Map());
  const activeTrades = api.quest.getActiveTrades.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchInterval: 2000,
  });
  const userBuildings = api.building.getUserBuildings.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchInterval: 15000,
  });
  const localOffers = api.quest.getOffers.useQuery(
    { planetId: planet.id },
    {
      enabled: status === "authenticated",
    },
  );
  const allRouteOffers = api.quest.getOffers.useQuery(
    { includeAllForeignPlanets: true },
    {
      enabled: status === "authenticated" && isHomePort,
      refetchInterval: 15000,
    },
  );
  const padAutoRoutes = api.quest.getPortAutoRoutes.useQuery(undefined, {
    enabled: status === "authenticated" && isHomePort,
  });
  const acceptTrade = api.quest.acceptTrade.useMutation({
    onSuccess: async (result) => {
      setNotice(result.message);
      setSelectedJobPadSlot(null);
      await Promise.all([
        utils.quest.getOffers.invalidate(),
        utils.quest.getActiveTrades.invalidate(),
        utils.user.getInventory.invalidate(),
      ]);
    },
    onError: (error) => setNotice(error.message),
  });
  const setPadAutoRoute = api.quest.setPortAutoRoute.useMutation({
    onSuccess: async (result) => {
      setNotice(result.message);
      await Promise.all([
        utils.quest.getPortAutoRoutes.invalidate(),
        utils.quest.getActiveTrades.invalidate(),
      ]);
    },
    onError: (error) => setNotice(error.message),
  });
  const startLaunchAnimation = React.useCallback((tradeId: string) => {
    setLaunchingTradeIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(tradeId);
      return nextIds;
    });
    window.setTimeout(() => {
      setLaunchingTradeIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(tradeId);
        return nextIds;
      });
    }, LAUNCH_ANIMATION_MS);
  }, []);
  const launchTrade = api.quest.launchTrade.useMutation({
    onSuccess: async (result, variables) => {
      setNotice(result.message);
      startLaunchAnimation(variables.tradeId);
      await Promise.all([
        utils.quest.getOffers.invalidate(),
        utils.quest.getActiveTrades.invalidate(),
        utils.quest.getCompletedTrades.invalidate(),
        utils.user.getInventory.invalidate(),
      ]);
    },
    onError: (error) => setNotice(error.message),
  });
  const abandonTrade = api.quest.abandonTrade.useMutation({
    onSuccess: async (result) => {
      setNotice(result.message);
      await Promise.all([
        utils.quest.getOffers.invalidate(),
        utils.quest.getActiveTrades.invalidate(),
        utils.quest.getCompletedTrades.invalidate(),
        utils.user.getInventory.invalidate(),
      ]);
    },
    onError: (error) => setNotice(error.message),
  });

  React.useEffect(() => {
    if (status === "unauthenticated") {
      void router.push("/");
    }
  }, [status, router]);

  React.useEffect(() => {
    if (router.query.payment === "success") {
      setNotice("Payment completed. Bloons arrive after Stripe confirms it.");
      void utils.user.getInventory.invalidate();
      return;
    }

    if (router.query.payment === "cancelled") {
      setNotice("Stripe checkout cancelled.");
    }
  }, [router.query.payment, utils.user.getInventory]);

  React.useEffect(() => {
    const landingTimeouts = landingTimeoutsRef.current;

    return () => {
      landingTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      landingTimeouts.clear();
    };
  }, []);

  React.useEffect(() => {
    if (!isHomePort) {
      previousRouteTradesRef.current = new Map();
      landingTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
      landingTimeoutsRef.current.clear();
      setLandingTrades((currentTrades) =>
        currentTrades.size > 0 ? new Map() : currentTrades,
      );
      return;
    }

    if (!activeTrades.data) {
      return;
    }

    const previousTradesById = previousRouteTradesRef.current;
    const hadPreviousSnapshot = previousTradesById.size > 0;
    const currentTradesById = new Map(
      activeTrades.data
        .filter((trade) => ACTIVE_ROUTE_STATUSES.has(trade.status))
        .map((trade) => [trade.id, trade] as const),
    );
    const returningTrades: LandingTrade[] = [];
    const launchingTrades: PortTrade[] = [];

    currentTradesById.forEach((currentTrade, tradeId) => {
      const previousTrade = previousTradesById.get(tradeId);

      if (
        hadPreviousSnapshot &&
        currentTrade.status === "IN_ROUTE" &&
        previousTrade?.status !== "IN_ROUTE"
      ) {
        launchingTrades.push(currentTrade);
      }
    });

    previousTradesById.forEach((previousTrade, tradeId) => {
      if (
        previousTrade.status === "IN_ROUTE" &&
        !currentTradesById.has(tradeId)
      ) {
        returningTrades.push({
          id: previousTrade.id,
          portSlot: previousTrade.portSlot,
          rocketName: previousTrade.rocketName,
          rocketImage: previousTrade.rocketImage,
          status: "LANDING",
        });
      }
    });

    previousRouteTradesRef.current = currentTradesById;

    launchingTrades.forEach((trade) => startLaunchAnimation(trade.id));

    if (returningTrades.length === 0) {
      return;
    }

    setLandingTrades((currentTrades) => {
      const nextTrades = new Map(currentTrades);

      returningTrades.forEach((trade) => {
        nextTrades.set(trade.id, trade);
      });

      return nextTrades;
    });

    returningTrades.forEach((trade) => {
      const existingTimeout = landingTimeoutsRef.current.get(trade.id);

      if (existingTimeout) {
        window.clearTimeout(existingTimeout);
      }

      const timeoutId = window.setTimeout(() => {
        setLandingTrades((currentTrades) => {
          if (!currentTrades.has(trade.id)) {
            return currentTrades;
          }

          const nextTrades = new Map(currentTrades);
          nextTrades.delete(trade.id);

          return nextTrades;
        });
        landingTimeoutsRef.current.delete(trade.id);
      }, LANDING_ANIMATION_MS);

      landingTimeoutsRef.current.set(trade.id, timeoutId);
    });

    void Promise.all([
      utils.quest.getCompletedTrades.invalidate(),
      utils.user.getInventory.invalidate(),
      utils.user.getOverview.invalidate(),
    ]);
  }, [activeTrades.data, isHomePort, startLaunchAnimation, utils]);

  if (status === "loading") {
    return <LoadingSpinner />;
  }

  const activeRouteTrades =
    activeTrades.data?.filter((trade) =>
      ACTIVE_ROUTE_STATUSES.has(trade.status),
    ) ?? [];
  const portTrades = isHomePort ? activeRouteTrades : [];
  const readyLaunchTrades = isHomePort
    ? activeTrades.data?.filter(
      (trade) => trade.status === "READY_TO_LAUNCH",
    ) ?? []
    : [];
  const readyLaunchCount = readyLaunchTrades.length;
  const launchPadCount = isHomePort
    ? userBuildings.data?.find(
      (userBuilding) => userBuilding.building.name === "Launch Pad",
    )?.amount ?? 0
    : 0;
  const landingTradeList = Array.from(landingTrades.values());
  const rightPanelOffers = localOffers.data?.slice(0, 2) ?? [];
  const rightPanelTrades = isHomePort ? portTrades.slice(0, 3) : [];
  const hasRightPanelContent =
    Boolean(notice) ||
    rightPanelOffers.length > 0 ||
    rightPanelTrades.length > 0;
  const autoRouteByPadSlot = new Map(
    padAutoRoutes.data?.map((padAutoRoute) => [
      padAutoRoute.portSlot,
      padAutoRoute,
    ]) ?? [],
  );
  const padSlots = Array.from({ length: launchPadCount }, (_, index) => {
    const slot = index + 1;
    const activeTrade =
      portTrades.find((trade) => trade.portSlot === slot) ??
      portTrades.find((trade) => trade.portSlot === null) ??
      null;
    const landingTrade =
      landingTradeList.find((trade) => trade.portSlot === slot) ??
      landingTradeList.find((trade) => trade.portSlot === null) ??
      null;

    return {
      slot,
      trade: landingTrade ?? activeTrade,
      isLanding: Boolean(landingTrade),
      isIdle: !activeTrade && !landingTrade,
      autoRoute: autoRouteByPadSlot.get(slot),
    };
  });

  return (
    <>
      <Head>
        <title>Alpha Haven | Port</title>
        <meta name="description" content="Space Haven trade port" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="relative flex min-h-screen w-full flex-col items-center justify-end overflow-hidden text-white">
        <div className="bg-sky absolute left-0 top-0" />

        <MainNavigation />
        <InventoryHeader />

        <section className="pointer-events-none absolute left-3 top-16 z-30 w-[min(24rem,calc(100vw-1.5rem))] rounded border border-slate-700 bg-slate-950/95 p-3 shadow-2xl ring-1 ring-black/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-900">
              <Image
                src={`/assets/3D/${planet.texture}`}
                alt={planet.name}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-teal-300">
                {planet.id === HOME_PLANET_ID ? "Home Port" : "Visiting"}
              </p>
              <h1 className="truncate text-xl font-black">{planet.name}</h1>
              <p className="truncate text-sm text-slate-300">
                {planet.character.name} · {planet.focus}
              </p>
            </div>
          </div>
          <div className="pointer-events-auto mt-3 flex gap-2">
            <Link
              href="/game/map"
              className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-slate-100"
            >
              <GlobeAltIcon className="h-4 w-4" />
              Map
            </Link>
            <Link
              href={`/game/port?planet=${planet.id}`}
              className="flex items-center gap-2 rounded border border-teal-400 bg-teal-500 px-3 py-2 text-sm font-bold text-slate-950"
            >
              <RocketLaunchIcon className="h-4 w-4" />
              Port
            </Link>
          </div>
        </section>

        {hasRightPanelContent && (
          <section className="absolute right-3 top-52 z-30 grid w-[min(24rem,calc(100vw-1.5rem))] gap-2 rounded border border-slate-700 bg-slate-950/95 p-2 shadow-2xl ring-1 ring-black/40 backdrop-blur-md md:top-16">
            {notice && (
              <div className="rounded border border-teal-500/50 bg-slate-900/95 px-3 py-2 text-sm text-teal-100 shadow-lg">
                {notice}
              </div>
            )}

            {rightPanelOffers.map((offer) => (
              <RouteOfferCard
                key={offer.id}
                offer={offer}
                isAccepting={acceptTrade.isLoading}
                variant="compact"
                onAccept={(rocketId) =>
                  acceptTrade.mutate({
                    offerId: offer.id,
                    rocketId,
                  })
                }
              />
            ))}

            {rightPanelTrades.map((trade) => (
              <div
                key={trade.id}
                className="rounded border border-slate-700 bg-slate-900/95 px-3 py-2 text-sm shadow-lg"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{trade.title}</p>
                    <p className="truncate text-xs text-slate-400">
                      {trade.planetName}
                    </p>
                  </div>
                  <p className="shrink-0 text-teal-300">
                    {trade.status === "READY_TO_LAUNCH" ? (
                      <button
                        type="button"
                        disabled={launchTrade.isLoading}
                        onClick={() =>
                          launchTrade.mutate({ tradeId: trade.id })
                        }
                        className="rounded border border-rose-300 bg-rose-500 px-2 py-1 text-xs font-bold text-white disabled:border-slate-600 disabled:bg-slate-700"
                      >
                        Launch
                      </button>
                    ) : trade.status === "STOPPED" ? (
                      <button
                        type="button"
                        disabled={abandonTrade.isLoading}
                        onClick={() =>
                          abandonTrade.mutate({ tradeId: trade.id })
                        }
                        className="rounded border border-amber-300 bg-amber-500 px-2 py-1 text-xs font-bold text-slate-950 disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300"
                      >
                        Clear
                      </button>
                    ) : trade.status === "LOADING" && trade.loadedAt ? (
                      <Countdown
                        target={trade.loadedAt}
                        onDone={() => void activeTrades.refetch()}
                      />
                    ) : trade.status === "LANDING" && trade.completedAt ? (
                      <Countdown
                        target={trade.completedAt}
                        onDone={() => void activeTrades.refetch()}
                      />
                    ) : trade.arrivesAt ? (
                      <Countdown
                        target={trade.arrivesAt}
                        onDone={() => void activeTrades.refetch()}
                      />
                    ) : (
                      trade.status
                    )}
                  </p>
                </div>
                {trade.statusMessage && (
                  <p className="mt-1 rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs leading-4 text-amber-100">
                    {trade.statusMessage}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {isHomePort && selectedJobPadSlot !== null && (
          <HomeJobBoard
            padSlot={selectedJobPadSlot}
            offers={allRouteOffers.data}
            isLoading={allRouteOffers.isLoading}
            isAccepting={acceptTrade.isLoading}
            onClose={() => setSelectedJobPadSlot(null)}
            onAccept={(offerId, rocketId) =>
              acceptTrade.mutate({
                offerId,
                rocketId,
                portSlot: selectedJobPadSlot,
              })
            }
          />
        )}

        {isHomePort && (
          <section className="absolute bottom-24 left-3 z-30 flex w-[min(32rem,calc(100vw-1.5rem))] flex-wrap gap-2 p-2">
            <button
              type="button"
              disabled={readyLaunchCount === 0 || launchTrade.isLoading}
              onClick={() => {
                const firstReadyTrade = readyLaunchTrades[0];

                if (firstReadyTrade) {
                  launchTrade.mutate({ tradeId: firstReadyTrade.id });
                }
              }}
              className="flex items-center gap-2 rounded border border-rose-300 bg-rose-500 px-3 py-2 text-sm font-bold text-white shadow-lg disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-400"
            >
              <RocketLaunchIcon className="h-4 w-4" />
              Launch {readyLaunchCount}
            </button>
          </section>
        )}

        <div className="relative z-0 flex h-full w-full items-center justify-center bg-bottom">
          {isHomePort && (
            <div className="flex h-full w-full max-w-6xl items-center justify-center gap-2 px-4 pb-20 pt-24 md:gap-3 md:px-8">
              {padSlots.map(({ slot, trade, isLanding, isIdle, autoRoute }) => (
                <LandingPad
                  key={trade?.id ?? `empty-${slot}`}
                  rocket={
                    trade
                      ? {
                        name: trade.rocketName ?? trade.status,
                        status:
                          isLanding || trade.status === "LANDING"
                            ? "LANDING"
                            : trade.status,
                        image: trade.rocketImage ?? undefined,
                      }
                      : undefined
                  }
                  animateLaunch={
                    trade ? launchingTradeIds.has(trade.id) : false
                  }
                  animateLanding={isLanding || trade?.status === "LANDING"}
                  statusDetail={
                    trade && "statusMessage" in trade
                      ? trade.statusMessage
                      : null
                  }
                  autoRouteEnabled={autoRoute?.enabled ?? false}
                  canUseAutoRoute={autoRoute?.canUseAutoRoute ?? false}
                  isTogglingAutoRoute={setPadAutoRoute.isLoading}
                  onToggleAutoRoute={(enabled) =>
                    setPadAutoRoute.mutate({
                      portSlot: slot,
                      enabled,
                    })
                  }
                  onClick={
                    isIdle ? () => setSelectedJobPadSlot(slot) : undefined
                  }
                />
              ))}
            </div>
          )}
          <DynamicBackground
            seed={planet.id}
            surfaceTexture={`/assets/3D/${planet.texture}`}
          />
        </div>
      </main>
    </>
  );
}

const HomeJobBoard = ({
  padSlot,
  offers,
  isLoading,
  isAccepting,
  onClose,
  onAccept,
}: {
  padSlot: number;
  offers: PortOffer[] | undefined;
  isLoading: boolean;
  isAccepting: boolean;
  onClose: () => void;
  onAccept: (offerId: string, rocketId: string) => void;
}) => {
  const regularOfferCount =
    offers?.filter((offer) => !offer.isSpecialOffer).length ?? 0;
  const specialOfferCount =
    offers?.filter((offer) => offer.isSpecialOffer).length ?? 0;

  return (
    <section className="absolute inset-x-2 bottom-3 top-14 z-50 mx-auto flex max-h-[calc(100vh-4.25rem)] w-[min(72rem,calc(100vw-1rem))] flex-col overflow-hidden rounded border border-slate-700 bg-slate-950/95 shadow-2xl ring-1 ring-black/40 backdrop-blur-md md:inset-x-3 md:bottom-6 md:top-16 md:w-[min(72rem,calc(100vw-1.5rem))]">
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-teal-300">
            Launch Pad {padSlot}
          </p>
          <h2 className="truncate text-xl font-black">Available Jobs</h2>
        </div>
        <div className="hidden min-w-0 items-center gap-2 text-xs text-slate-300 sm:flex">
          <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1">
            {regularOfferCount} route offers
          </span>
          <span className="rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-amber-100">
            {specialOfferCount}/2 special
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-200"
          aria-label="Close jobs"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="bg-slate-900/55 hidden border-r border-slate-800 p-4 lg:grid lg:auto-rows-min lg:gap-3">
          <div className="rounded border border-teal-400/40 bg-teal-500/10 p-3">
            <div className="flex items-center gap-2 text-sm font-black text-teal-100">
              <BriefcaseIcon className="h-5 w-5" />
              Route Board
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Pick a contract, compare the rocket loadout, then commit this pad
              to the run.
            </p>
          </div>
          <div className="grid gap-2 text-xs text-slate-300">
            <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
              <span>Event slots</span>
              <span className="font-black text-slate-100">
                {regularOfferCount}/6
              </span>
            </div>
            <div className="flex items-center justify-between rounded border border-amber-400/30 bg-amber-500/10 px-3 py-2">
              <span>Special slots</span>
              <span className="font-black text-amber-100">
                {specialOfferCount}/2
              </span>
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/70 p-3 text-xs leading-5 text-slate-400">
            <div className="mb-1 flex items-center gap-2 font-bold text-slate-200">
              <SparklesIcon className="h-4 w-4 text-amber-300" />
              Dispatch flow
            </div>
            Browse demand, choose the rocket with the best capacity and travel
            time, then accept the route.
          </div>
        </aside>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <LoadingSpinner />
          ) : offers?.length ? (
            <div className="grid min-w-0 gap-3 xl:grid-cols-2">
              {offers.map((offer) => (
                <RouteOfferCard
                  key={offer.id}
                  offer={offer}
                  isAccepting={isAccepting}
                  variant="compact"
                  onAccept={(rocketId) => onAccept(offer.id, rocketId)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded border border-dashed border-slate-700 bg-slate-900/70 p-4 text-center text-sm text-slate-400">
              No route events match your open ports, fleet, cargo, and H3 fuel.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
