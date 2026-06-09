import Image from "next/image";
import React from "react";
import millify from "millify";
import {
  ArrowTrendingUpIcon,
  BoltIcon,
  BuildingOffice2Icon,
  BanknotesIcon,
} from "@heroicons/react/24/solid";

import Countdown from "@/components/Countdown";
import LoadingSpinner from "@/components/LoadingSpinner";
import MaterialIcon from "@/components/MaterialIcon";
import { api, type RouterOutputs } from "@/utils/api";

type UserBuilding = RouterOutputs["building"]["getUserBuildings"][number];

type BuildingsProps = {
  variant?: "default" | "compact";
};

const Buildings = ({ variant = "default" }: BuildingsProps) => {
  const isCompact = variant === "compact";
  const utils = api.useContext();
  const userBuildings = api.building.getUserBuildings.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const inventory = api.user.getInventory.useQuery(undefined, {
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const [notice, setNotice] = React.useState<string | null>(null);

  const invalidateBuildings = React.useCallback(async () => {
    await Promise.all([
      utils.building.getUserBuildings.invalidate(),
      utils.quest.getActiveTrades.invalidate(),
      utils.user.getInventory.invalidate(),
    ]);
  }, [utils]);

  const upgradeBuilding = api.building.upgradeBuilding.useMutation({
    onSuccess: (result) => {
      setNotice(result.message);
      void invalidateBuildings();
    },
    onError: (error) => setNotice(error.message),
  });
  const toggleAutoRoute = api.building.toggleAutoRoute.useMutation({
    onSuccess: (result) => {
      setNotice(result.message);
      void invalidateBuildings();
    },
    onError: (error) => setNotice(error.message),
  });

  if (userBuildings.isLoading || inventory.isLoading) {
    return <LoadingSpinner />;
  }

  const rhoonsBalance = inventory.data?.rhoons?.amount ?? 0;

  return (
    <div className={isCompact ? "grid w-full gap-3" : "grid w-full gap-5"}>
      {!isCompact && (
        <header className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-teal-300">
            Home Industry
          </p>
          <h2 className="text-2xl font-black">Buildings</h2>
        </header>
      )}

      {notice && (
        <div className="bg-teal-500/15 rounded border border-teal-500/50 px-3 py-2 text-sm text-teal-100">
          {notice}
        </div>
      )}

      {userBuildings.data?.length ? (
        <div className="grid gap-3">
          {userBuildings.data.map((userBuilding) => (
            <BuildingCard
              key={userBuilding.id}
              userBuilding={userBuilding}
              isCompact={isCompact}
              isUpgrading={upgradeBuilding.isLoading}
              isTogglingAutoRoute={toggleAutoRoute.isLoading}
              rhoonsBalance={rhoonsBalance}
              onRefresh={() => void invalidateBuildings()}
              onUpgrade={() => upgradeBuilding.mutate({ id: userBuilding.id })}
              onToggleAutoRoute={(enabled) =>
                toggleAutoRoute.mutate({ id: userBuilding.id, enabled })
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded border border-dashed border-slate-700 bg-slate-900/60 p-5 text-center text-sm text-slate-400">
          No buildings purchased yet.
        </div>
      )}
    </div>
  );
};

type BuildingCardProps = {
  userBuilding: UserBuilding;
  isCompact: boolean;
  isUpgrading: boolean;
  isTogglingAutoRoute: boolean;
  rhoonsBalance: number;
  onRefresh: () => void;
  onUpgrade: () => void;
  onToggleAutoRoute: (enabled: boolean) => void;
};

const BuildingCard = ({
  userBuilding,
  isCompact,
  isUpgrading,
  isTogglingAutoRoute,
  rhoonsBalance,
  onRefresh,
  onUpgrade,
  onToggleAutoRoute,
}: BuildingCardProps) => {
  const { building } = userBuilding;
  const claimableByMaterial = new Map(
    userBuilding.claimable.map((claimable) => [
      claimable.materialId,
      claimable.amount,
    ]),
  );
  const hasClaimable = userBuilding.claimable.some(
    (claimable) => claimable.amount > 0,
  );
  const isLaunchPad = building.name === "Launch Pad";
  const upgradeCost = userBuilding.nextUpgradeCost;
  const canAffordUpgrade = upgradeCost !== null && rhoonsBalance >= upgradeCost;

  return (
    <article
      className={
        isCompact
          ? "bg-slate-900/85 grid gap-2 rounded border border-slate-700 p-2"
          : "bg-slate-900/85 grid gap-4 rounded border border-slate-700 p-3 md:grid-cols-[auto_1fr_auto]"
      }
    >
      <div className="flex items-center gap-3">
        <div
          className={`relative shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-950 ${
            isCompact ? "h-12 w-12" : "h-20 w-20"
          }`}
        >
          {building.image ? (
            <Image
              src={building.image}
              alt={building.name}
              fill
              sizes={isCompact ? "48px" : "80px"}
              className="object-cover"
            />
          ) : (
            <BuildingOffice2Icon className="h-full w-full p-4 text-slate-600" />
          )}
        </div>
        <div>
          <h3 className={isCompact ? "text-sm font-bold" : "text-lg font-bold"}>
            {building.name}
          </h3>
          <p
            className={
              isCompact ? "text-xs text-slate-400" : "text-sm text-slate-400"
            }
          >
            Lvl {userBuilding.level} · {userBuilding.amount}x owned
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <div
          className={
            isCompact
              ? "grid grid-cols-3 gap-2"
              : "grid grid-cols-2 gap-3 sm:grid-cols-4"
          }
        >
          <Metric
            icon={<BoltIcon className="h-5 w-5" />}
            label="Output"
            value={`${millify(userBuilding.productionMultiplier)}x`}
            isCompact={isCompact}
          />
          <Metric
            icon={<BanknotesIcon className="h-5 w-5" />}
            label="Rhoons"
            value={`${millify(userBuilding.rhoonsPerSecond)}/sec`}
            isCompact={isCompact}
          />
          <Metric
            icon={<ArrowTrendingUpIcon className="h-5 w-5" />}
            label="Next"
            value={
              userBuilding.isInputBlocked ? (
                "Needs input"
              ) : hasClaimable ? (
                "Ready"
              ) : (
                <Countdown
                  seconds={userBuilding.secondsUntilNext}
                  onDone={onRefresh}
                />
              )
            }
            isCompact={isCompact}
          />
          {userBuilding.inputRequirements.map((input) => (
            <MaterialIcon
              key={`input-${input.materialId}`}
              id={input.materialId}
              amount={input.amount}
              image={input.material?.image ?? undefined}
              label={`Consumes ${input.material?.name ?? "Input"}`}
            />
          ))}
          {building.recOutput.map((output) => (
            <MaterialIcon
              key={output.material.id}
              id={output.material.id}
              amount={
                claimableByMaterial.get(output.materialId) ?? output.amount
              }
              image={output.material.image ?? undefined}
              label={hasClaimable ? "Ready" : output.material.name}
            />
          ))}
        </div>
      </div>

      <div
        className={
          isCompact
            ? "grid gap-2"
            : "flex min-w-[10rem] flex-col justify-center gap-2"
        }
      >
        <div
          className={`rounded border px-3 py-2 text-xs font-bold ${
            userBuilding.isInputBlocked
              ? "border-amber-400/50 bg-amber-500/10 text-amber-100"
              : "border-teal-400/40 bg-teal-500/10 text-teal-100"
          }`}
        >
          {userBuilding.isInputBlocked
            ? "Waiting for input"
            : "Auto collecting"}
        </div>
        <button
          type="button"
          disabled={upgradeCost === null || isUpgrading || !canAffordUpgrade}
          onClick={onUpgrade}
          className="rounded border border-rose-300 bg-rose-500 px-3 py-2 text-xs font-bold text-white disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300"
        >
          {upgradeCost === null
            ? "Max Level"
            : canAffordUpgrade
              ? `Upgrade ${millify(upgradeCost)} Rhoons`
              : `Need ${millify(upgradeCost)} Rhoons`}
        </button>
        {isLaunchPad && (
          <button
            type="button"
            disabled={!userBuilding.canUseAutoRoute || isTogglingAutoRoute}
            onClick={() => onToggleAutoRoute(!userBuilding.autoRouteEnabled)}
            className="rounded border border-sky-300 bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300"
            title={
              userBuilding.canUseAutoRoute
                ? "Automatically launch this route after loading."
                : `Unlocks at level ${userBuilding.autoRouteUnlockLevel}`
            }
          >
            {userBuilding.canUseAutoRoute
              ? userBuilding.autoRouteEnabled
                ? "Auto On"
                : "Auto Off"
              : `Auto L${userBuilding.autoRouteUnlockLevel}`}
          </button>
        )}
      </div>
    </article>
  );
};

const Metric = ({
  icon,
  label,
  value,
  isCompact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  isCompact?: boolean;
}) => (
  <div
    className={`flex flex-col justify-between rounded bg-slate-950/70 ${
      isCompact ? "min-h-[3.5rem] p-2" : "min-h-[4.75rem] p-3"
    }`}
  >
    <div className="flex items-center gap-1 text-slate-400">
      {icon}
      <span className="text-[0.65rem] uppercase tracking-wide">{label}</span>
    </div>
    <div
      className={
        isCompact
          ? "text-xs font-bold text-slate-100"
          : "text-sm font-bold text-slate-100"
      }
    >
      {value}
    </div>
  </div>
);

export default Buildings;
