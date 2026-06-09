import {
  ClockIcon,
  CubeTransparentIcon,
  RocketLaunchIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import Image from "next/image";
import React from "react";
import millify from "millify";

import MaterialIcon from "@/components/MaterialIcon";
import { type RouterOutputs } from "@/utils/api";
import { formatDuration } from "@/utils/gameData";

type RouteOffer = RouterOutputs["quest"]["getOffers"][number];
type OfferMaterial = RouteOffer["requestedMaterial"];

type RouteOfferCardProps = {
  offer: RouteOffer;
  isAccepting: boolean;
  onAccept: (rocketId: string) => void;
  variant?: "full" | "compact";
};

const RouteOfferCard = ({
  offer,
  isAccepting,
  onAccept,
  variant = "full",
}: RouteOfferCardProps) => {
  const isCompact = variant === "compact";
  const isBuyRoute = offer.tradeKind === "BUY";
  const isSpecialOffer = offer.isSpecialOffer;
  const defaultRocketId =
    offer.recommendedRocketId ?? offer.eligibleRockets[0]?.id ?? "";
  const [selectedRocketId, setSelectedRocketId] =
    React.useState(defaultRocketId);
  const selectedRocket =
    offer.eligibleRockets.find((rocket) => rocket.id === selectedRocketId) ??
    offer.eligibleRockets[0];
  const shipmentAmount =
    selectedRocket?.shipmentAmount ?? offer.requestedAmount;
  const fuelRequired = selectedRocket?.fuelRequired ?? offer.fuelRequired;
  const rewardAmount = selectedRocket?.rewardAmount ?? offer.rewardAmount;
  const loadSeconds = selectedRocket?.loadSeconds ?? offer.loadSeconds;
  const routeCompletionPercent = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        ((offer.totalRequestedAmount - offer.remainingAmount) /
          Math.max(1, offer.totalRequestedAmount)) *
          100,
      ),
    ),
  );

  React.useEffect(() => {
    setSelectedRocketId(defaultRocketId);
  }, [defaultRocketId, offer.id]);

  return (
    <article
      className={`grid min-w-0 gap-3 overflow-hidden rounded border shadow-lg transition hover:border-teal-400/70 ${
        isSpecialOffer
          ? "bg-amber-950/35 border-amber-400/50"
          : "bg-slate-900/85 border-slate-700"
      } ${isCompact ? "p-3" : "p-4"}`}
    >
      <header className="flex items-start gap-3">
        <PlanetBadge
          planetName={offer.planet.name}
          planetTexture={offer.planet.texture}
          characterName={offer.planet.character.name}
          size={isCompact ? "sm" : "md"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={`text-xs uppercase tracking-wide ${
                  isSpecialOffer ? "text-amber-300" : "text-teal-300"
                }`}
              >
                {isSpecialOffer
                  ? "Special Offer"
                  : isBuyRoute
                    ? "Buy Route"
                    : "Limited Contract"}
              </p>
              <h3 className="line-clamp-2 break-words text-base font-black leading-5 text-slate-100">
                {offer.title}
              </h3>
            </div>
            <span className="shrink-0 rounded bg-slate-950 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-slate-300">
              {formatDuration(offer.durationSeconds)}
            </span>
          </div>
          {!isCompact && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-300">
              {offer.description}
            </p>
          )}
        </div>
      </header>

      <div className="grid min-w-0 gap-2 sm:grid-cols-3">
        <RouteMaterialStep
          title={isBuyRoute ? "Pay" : "Ship"}
          material={offer.requestedMaterial}
          amount={shipmentAmount}
        />
        <RouteMaterialStep
          title="Fuel"
          material={offer.fuelMaterial}
          amount={fuelRequired}
        />
        <RouteMaterialStep
          title="Get reward"
          material={offer.rewardMaterial}
          amount={rewardAmount}
          isReward
        />
      </div>

      <div className="grid min-w-0 gap-3 rounded bg-slate-950/70 px-3 py-2">
        <div className="grid gap-1">
          <div className="flex min-w-0 justify-between gap-2 text-xs text-slate-400">
            <span className="truncate">
              Route pool {millify(offer.remainingAmount)}/
              {millify(offer.totalRequestedAmount)}
            </span>
            <span className="shrink-0 font-bold text-slate-200">
              {routeCompletionPercent}% filled
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-teal-400"
              style={{ width: `${routeCompletionPercent}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
          <span>Rocket loads: {shipmentAmount}</span>
          {selectedRocket && (
            <span className="min-w-0 truncate">
              Picked: {selectedRocket.name} Mk {selectedRocket.upgrade}
            </span>
          )}
        </div>
        <div className="grid min-w-0 gap-2 text-xs text-slate-400 sm:grid-cols-3">
          <RouteStat
            icon={<ClockIcon className="h-4 w-4" />}
            label="Load"
            value={formatDuration(loadSeconds)}
          />
          <RouteStat
            icon={<RocketLaunchIcon className="h-4 w-4" />}
            label="Flight"
            value={formatDuration(
              selectedRocket?.travelSeconds ?? offer.travelSeconds,
            )}
          />
          <RouteStat
            icon={<XMarkIcon className="h-4 w-4" />}
            label="Closes"
            value={formatDuration(offer.secondsUntilRefresh)}
          />
        </div>
        <label className="grid gap-1">
          <span className="flex items-center gap-1 text-[0.65rem] uppercase tracking-wide text-slate-500">
            <CubeTransparentIcon className="h-3.5 w-3.5" />
            Rocket Loadout
          </span>
          {offer.eligibleRockets.length > 0 ? (
            <select
              value={selectedRocket?.id ?? ""}
              onChange={(event) => setSelectedRocketId(event.target.value)}
              className="min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
            >
              {offer.eligibleRockets.map((rocket) => (
                <option key={rocket.id} value={rocket.id}>
                  {rocket.name} Mk {rocket.upgrade} ·{" "}
                  {formatDuration(rocket.travelSeconds)} · C
                  {rocket.cargoCapacity} F{rocket.fuelCapacity}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-sm text-amber-100">
              {offer.unavailableReason}
            </div>
          )}
        </label>
      </div>

      <button
        type="button"
        disabled={offer.isActive || isAccepting || !selectedRocket}
        onClick={() => selectedRocket && onAccept(selectedRocket.id)}
        className="flex min-w-0 items-center justify-center gap-2 rounded border border-teal-300 bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300"
      >
        <RocketLaunchIcon className="h-4 w-4 shrink-0" />
        {!selectedRocket
          ? "Needs Better Rocket"
          : offer.isActive
            ? "Using Port"
            : isBuyRoute
              ? "Buy Route"
              : "Accept Contract"}
      </button>
    </article>
  );
};

const RouteMaterialStep = ({
  title,
  material,
  amount,
  isReward = false,
}: {
  title: string;
  material: OfferMaterial;
  amount: number;
  isReward?: boolean;
}) => (
  <div
    className={`grid min-w-0 gap-1 overflow-hidden rounded border px-2 py-2 ${
      isReward
        ? "border-teal-500/40 bg-teal-500/10"
        : "border-slate-800 bg-slate-950/50"
    }`}
  >
    <p
      className={`text-[0.65rem] font-black uppercase tracking-wide ${
        isReward ? "text-teal-200" : "text-slate-500"
      }`}
    >
      {title}
    </p>
    <MaterialIcon
      id={material.id}
      amount={amount}
      image={material.image ?? undefined}
      label={material.name}
    />
  </div>
);

const PlanetBadge = ({
  planetName,
  planetTexture,
  characterName,
  size,
}: {
  planetName: string;
  planetTexture?: string | null;
  characterName: string;
  size: "sm" | "md";
}) => (
  <div className="flex shrink-0 items-center gap-2">
    <div
      className={`relative overflow-hidden rounded border border-slate-700 bg-slate-950 ${
        size === "sm" ? "h-10 w-10" : "h-12 w-12"
      }`}
    >
      <Image
        src={planetTexture ? `/assets/3D/${planetTexture}` : "/bg_mars.png"}
        alt={planetName}
        fill
        sizes={size === "sm" ? "40px" : "48px"}
        className="object-cover"
      />
    </div>
    <div className="hidden min-w-0 sm:block">
      <p className="truncate text-sm font-bold">{planetName}</p>
      <p className="truncate text-xs text-slate-400">{characterName}</p>
    </div>
  </div>
);

const RouteStat = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex min-w-0 items-center gap-2">
    <span className="text-slate-500">{icon}</span>
    <span className="shrink-0 uppercase tracking-wide text-slate-500">
      {label}
    </span>
    <span className="truncate font-bold text-slate-200">{value}</span>
  </div>
);

export default RouteOfferCard;
