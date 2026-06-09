import Image from "next/image";
import React from "react";
import millify from "millify";
import {
  ArrowTrendingUpIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/solid";

import Countdown from "@/components/Countdown";
import LoadingSpinner from "@/components/LoadingSpinner";
import { api, type RouterOutputs } from "@/utils/api";

type FleetRocket = RouterOutputs["fleet"]["getFleet"][number];

const Rockets = () => {
  const utils = api.useContext();
  const fleet = api.fleet.getFleet.useQuery();
  const activeTrades = api.quest.getActiveTrades.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const inventory = api.user.getInventory.useQuery(undefined, {
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const [notice, setNotice] = React.useState<string | null>(null);

  const refreshFleet = React.useCallback(async () => {
    await Promise.all([
      utils.fleet.getFleet.invalidate(),
      utils.fleet.getLaunchOptions.invalidate(),
      utils.user.getInventory.invalidate(),
    ]);
  }, [utils]);

  const upgradeRocket = api.fleet.upgradeRocket.useMutation({
    onSuccess: (result) => {
      setNotice(result.message);
      void refreshFleet();
    },
    onError: (error) => setNotice(error.message),
  });

  if (fleet.isLoading || activeTrades.isLoading || inventory.isLoading) {
    return <LoadingSpinner />;
  }

  const rhoonsBalance = inventory.data?.rhoons?.amount ?? 0;
  const ownedRockets = fleet.data?.filter((rocket) => rocket.owned) ?? [];
  const movingTrades = activeTrades.data?.filter(
    (trade) => trade.status === "IN_ROUTE",
  );

  return (
    <div className="grid w-full gap-5">
      <header>
        <p className="text-xs uppercase tracking-wide text-teal-300">Fleet</p>
        <h2 className="text-2xl font-black">Rockets</h2>
      </header>

      {notice && (
        <div className="bg-teal-500/15 rounded border border-teal-500/50 px-3 py-2 text-sm text-teal-100">
          {notice}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        {ownedRockets.length ? (
          ownedRockets.map((rocket) => (
            <RocketCard
              key={rocket.id}
              rocket={rocket}
              isUpgrading={upgradeRocket.isLoading}
              rhoonsBalance={rhoonsBalance}
              onUpgrade={() => upgradeRocket.mutate({ rocketId: rocket.id })}
            />
          ))
        ) : (
          <div className="rounded border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center text-sm text-slate-400 md:col-span-2">
            No rockets owned yet. Buy rockets from the Shop.
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <h3 className="border-b border-slate-700 pb-2 text-sm font-black uppercase tracking-wide text-slate-200">
          Active Launches
        </h3>
        {movingTrades?.length ? (
          movingTrades.map((trade) => (
            <div
              key={trade.id}
              className="bg-slate-900/85 flex flex-wrap items-center justify-between gap-3 rounded border border-slate-700 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-bold">
                  {trade.rocketName ?? "Starter Shuttle"}
                </p>
                <p className="text-slate-400">{trade.planetName}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-teal-300">{trade.status}</p>
                <p className="text-slate-300">
                  {trade.arrivesAt ? (
                    <Countdown
                      target={trade.arrivesAt}
                      onDone={() =>
                        void utils.quest.getActiveTrades.invalidate()
                      }
                    />
                  ) : (
                    "Preparing"
                  )}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center text-sm text-slate-400">
            No rockets in flight.
          </div>
        )}
      </section>
    </div>
  );
};

type RocketCardProps = {
  rocket: FleetRocket;
  isUpgrading: boolean;
  rhoonsBalance: number;
  onUpgrade: () => void;
};

const RocketCard = ({
  rocket,
  isUpgrading,
  rhoonsBalance,
  onUpgrade,
}: RocketCardProps) => {
  const upgradeCost = rocket.nextUpgradeCost;
  const canAffordUpgrade = upgradeCost !== null && rhoonsBalance >= upgradeCost;

  return (
    <article className="bg-slate-900/85 grid gap-3 rounded border border-slate-700 p-3">
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-950">
          {rocket.image ? (
            <Image
              src={rocket.image}
              alt={rocket.name}
              fill
              sizes="80px"
              className="object-contain"
            />
          ) : (
            <RocketLaunchIcon className="h-full w-full p-4 text-slate-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{rocket.name}</h3>
          <p className="text-sm text-slate-400">Mk {rocket.upgrade}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <Metric label="Speed" value={millify(rocket.speed)} />
        <Metric label="Cargo" value={millify(rocket.cargoCapacity)} />
        <Metric label="Fuel" value={millify(rocket.fuelCapacity)} />
      </div>

      <button
        type="button"
        disabled={upgradeCost === null || isUpgrading || !canAffordUpgrade}
        onClick={onUpgrade}
        className="flex items-center justify-center gap-2 rounded border border-rose-300 bg-rose-500 px-4 py-2 text-sm font-bold text-white disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300"
      >
        <ArrowTrendingUpIcon className="h-4 w-4" />
        {upgradeCost === null
          ? "Max Upgrade"
          : canAffordUpgrade
            ? `Upgrade ${millify(upgradeCost)} Rhoons`
            : `Need ${millify(upgradeCost)} Rhoons`}
      </button>
    </article>
  );
};

const Metric = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="rounded bg-slate-950/70 p-3">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="font-bold text-slate-100">{value}</p>
  </div>
);

export default Rockets;
