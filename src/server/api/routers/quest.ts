import { randomUUID } from "crypto";
import type { Material, Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getRocketStats } from "@/server/api/routers/fleet";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { UserTradeKind, UserTradeStatus } from "@/server/dbEnums";
import { AUTO_ROUTE_UNLOCK_LEVEL } from "@/server/gameBalance";
import { syncPlayerGameState } from "@/server/gameEngine";
import {
  MAX_ROCKET_CARGO_CAPACITY,
  MAX_ROCKET_FUEL_CAPACITY,
  ensurePlayerState,
} from "@/server/gameContent";
import {
  addInventoryAmount,
  reserveInventoryAmount,
} from "@/server/repositories/inventoryRepository";
import {
  HOME_PLANET_ID,
  getPlanetById,
  planetRoster,
  type PlanetDefinition,
  type TradeMaterialName,
} from "@/utils/gameData";

const MIN_EVENT_OFFERS = 2;
const MAX_EVENT_OFFERS = 6;
const EVENT_CANDIDATE_SLOTS_PER_PLANET = 6;
const EVENT_APPEARANCE_PERCENT = 100;
const SPECIAL_EVENT_SLOTS = 2;
const SPECIAL_EVENT_APPEARANCE_PERCENT = 15;
const EVENT_BOARD_ROTATION_SECONDS = 30 * 60;
const SPECIAL_EVENT_DURATION_SECONDS = [10 * 60, 15 * 60, 20 * 60] as const;
const LANDING_SECONDS = 5;
const SELL_REWARD_MULTIPLIER = 1.16;
const SPECIAL_REWARD_MULTIPLIER = 2.35;
const MIN_ROCKET_FUEL_REQUIRED = 500;
const MAX_SHIPMENT_AMOUNT = 1000;
const REWARD_MATERIAL_NAMES = ["Bloons", "Zaza", "Rhoons"] as const;
const FILLED_TRADE_STATUSES = [
  UserTradeStatus.LOADING,
  UserTradeStatus.READY_TO_LAUNCH,
  UserTradeStatus.IN_ROUTE,
  UserTradeStatus.LANDING,
  UserTradeStatus.READY,
  UserTradeStatus.READY_TO_CLAIM,
  UserTradeStatus.STOPPED,
  UserTradeStatus.COMPLETED,
] as const;
const EVENT_DURATION_SECONDS = [
  4 * 60 * 60,
  8 * 60 * 60,
  12 * 60 * 60,
  24 * 60 * 60,
] as const;
const ACTIVE_TRADE_STATUSES = [
  UserTradeStatus.LOADING,
  UserTradeStatus.READY_TO_LAUNCH,
  UserTradeStatus.IN_ROUTE,
  UserTradeStatus.LANDING,
  UserTradeStatus.STOPPED,
] as const;
const VISIBLE_TRADE_STATUSES = ACTIVE_TRADE_STATUSES;
const PRE_LAUNCH_STATUSES = [
  UserTradeStatus.LOADING,
  UserTradeStatus.READY_TO_LAUNCH,
] as const;
const RETURNED_OR_STOPPED_STATUSES = [
  UserTradeStatus.IN_ROUTE,
  UserTradeStatus.LANDING,
  UserTradeStatus.READY,
  UserTradeStatus.READY_TO_CLAIM,
  UserTradeStatus.STOPPED,
] as const;
const LEGACY_READY_STATUSES = [
  UserTradeStatus.READY,
  UserTradeStatus.READY_TO_CLAIM,
] as const;
const FUEL_MATERIAL_NAME: TradeMaterialName = "H3";

type TradeKind = UserTradeKind;

type RawDb = Prisma.TransactionClient | PrismaClient;

const tradeWithMaterialsInclude = {
  requestedMaterial: true,
  rewardMaterial: true,
} as const;

type TradeWithMaterials = Prisma.UserTradeGetPayload<{
  include: typeof tradeWithMaterialsInclude;
}>;

type OwnedRocketForRoute = {
  rocketId: string;
  upgrade: number;
  rocket: {
    id: string;
    name: string;
    image: string | null;
    speed: number;
    cargoCapacity: number;
    fuelCapacity: number;
  };
};

type RocketRouteOption = {
  id: string;
  name: string;
  image: string | null;
  upgrade: number;
  speed: number;
  cargoCapacity: number;
  fuelCapacity: number;
  travelSeconds: number;
  shipmentAmount: number;
  fuelRequired: number;
  rewardAmount: number;
  loadSeconds: number;
};

type GeneratedOffer = {
  id: string;
  planet: PlanetDefinition;
  tradeKind: TradeKind;
  isSpecialOffer: boolean;
  title: string;
  description: string;
  requestedMaterial: Material;
  requestedAmount: number;
  totalRequestedAmount: number;
  remainingAmount: number;
  rewardMaterial: Material;
  rewardAmount: number;
  fuelMaterial: Material;
  fuelRequired: number;
  durationSeconds: number;
  travelSeconds: number;
  routeDistance: number;
  rewardMultiplier: number;
  loadSeconds: number;
  refreshesAt: Date;
};

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function pick<T>(items: readonly T[], seed: number) {
  const item = items[seed % items.length];

  if (!item) {
    throw new Error("Cannot pick from an empty list.");
  }

  return item;
}

function getContractDemand(
  materialName: TradeMaterialName,
  routeDistance: number,
  seed: number,
) {
  const ranges: Record<TradeMaterialName, [number, number]> = {
    Rhoons: [0, 0],
    Dust: [1_200_000, 4_800_000],
    Concrete: [650_000, 2_600_000],
    H3: [700_000, 2_900_000],
    Metal: [420_000, 1_700_000],
    Bloons: [90_000, 360_000],
    Zaza: [180_000, 760_000],
  };
  const [min, max] = ranges[materialName];
  const distanceBonus = Math.ceil(routeDistance * 1200);

  return Math.max(1, min + (seed % (max - min + 1)) + distanceBonus);
}

const materialValues: Record<TradeMaterialName, number> = {
  Rhoons: 1,
  Dust: 45,
  Concrete: 140,
  H3: 175,
  Metal: 260,
  Zaza: 520,
  Bloons: 1200,
};

function getExchangeAmount(
  fromMaterialName: TradeMaterialName,
  fromAmount: number,
  toMaterialName: TradeMaterialName,
  seed: number,
  multiplier: number,
) {
  const fromValue = materialValues[fromMaterialName] ?? 1;
  const toValue = materialValues[toMaterialName] ?? 1;
  const jitter = 0.92 + (seed % 17) / 100;
  const amount = Math.ceil(
    (fromAmount * fromValue * multiplier * jitter) / toValue,
  );

  if (toMaterialName === "Rhoons") {
    return Math.max(25, Math.ceil(amount / 5) * 5);
  }

  return Math.max(1, amount);
}

function createOfferText(
  tradeKind: TradeKind,
  planet: PlanetDefinition,
  requestedMaterialName: TradeMaterialName,
  requestedAmount: number,
  rewardMaterialName: TradeMaterialName,
  rewardAmount: number,
  fuelRequired: number,
  seed: number,
  totalRequestedAmount = requestedAmount,
) {
  const openings = [
    `${planet.character.name} opens a tight holo-link from ${planet.name}.`,
    `${planet.character.name} flags your port from the ${planet.name} trade band.`,
    `${planet.character.name} cuts through the static with a timed route offer.`,
    `${planet.character.name} posts a priority buy order out of ${planet.name}.`,
  ];
  const sellReasons = [
    `Their ${planet.focus} line is short on ${requestedMaterialName}.`,
    `${planet.name} has a ${planet.cadence} queue and needs ${requestedMaterialName} before the slot closes.`,
    `The local docks are paying above board because ${requestedMaterialName} is holding up the next run.`,
    `A station handler already cleared the return lane if your crew can load fast enough.`,
  ];
  const buyReasons = [
    `${planet.name} is releasing a limited ${rewardMaterialName} lot from its local stores.`,
    `Their ${planet.focus} crew can spare ${rewardMaterialName} if you cover the requested payment.`,
    `The ${planet.cadence} dock queue has one open sell order for ${rewardMaterialName}.`,
    `${planet.character.name} will hold ${rewardMaterialName} until this event closes.`,
  ];
  const close =
    tradeKind === UserTradeKind.SELL
      ? `The contract can take up to ${totalRequestedAmount} ${requestedMaterialName}. Your selected rocket loads what it can carry, reserves H3 for the round trip, and returns with ${rewardMaterialName}.`
      : `Pay ${requestedAmount} ${requestedMaterialName} with ${fuelRequired} H3 reserved for the round trip and your rocket returns with ${rewardAmount} ${rewardMaterialName}.`;

  return `${pick(openings, seed)} ${pick(
    tradeKind === UserTradeKind.SELL ? sellReasons : buyReasons,
    seed + 3,
  )} ${close}`;
}

function getMaterialByName(materials: Material[], name: TradeMaterialName) {
  return materials.find((material) => material.name === name);
}

function getRouteDistance(planet: PlanetDefinition) {
  const homePlanet = getPlanetById(HOME_PLANET_ID);
  const dx = planet.xLoc - homePlanet.xLoc;
  const dy = planet.yLoc - homePlanet.yLoc;
  const dz = planet.zLoc - homePlanet.zLoc;
  const oneWayDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  return Math.max(1, Math.round(oneWayDistance * 2));
}

function getFuelRequired(
  routeDistance: number,
  requestedAmount: number,
  requestedMaterial: Material,
) {
  const cargoWeight = Math.max(1, requestedMaterial.weight);
  const distanceFuel = routeDistance * 4;
  const cargoFuel = Math.cbrt(requestedAmount * cargoWeight) * 11;

  return Math.max(
    MIN_ROCKET_FUEL_REQUIRED,
    Math.min(
      MAX_ROCKET_FUEL_CAPACITY,
      Math.ceil(distanceFuel + cargoFuel),
    ),
  );
}

function getMaxShipmentByFuelCapacity(
  routeDistance: number,
  requestedMaterial: Material,
  fuelCapacity: number,
) {
  if (fuelCapacity < MIN_ROCKET_FUEL_REQUIRED) {
    return 0;
  }

  let low = 0;
  let high = MAX_SHIPMENT_AMOUNT;

  while (low < high) {
    const mid = Math.ceil((low + high + 1) / 2);
    const midFuel = getFuelRequired(routeDistance, mid, requestedMaterial);

    if (midFuel <= fuelCapacity) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

function getLoadSeconds(requestedAmount: number, fuelRequired: number) {
  return Math.min(
    240,
    Math.max(12, Math.ceil(10 + requestedAmount * 0.12 + fuelRequired * 0.01)),
  );
}

function getTravelSeconds(routeDistance: number, rocketSpeed: number) {
  return Math.max(
    75,
    Math.ceil((routeDistance * 1100) / Math.max(1, rocketSpeed)),
  );
}

function getEventPlanets(planetId?: string, includeAllForeignPlanets = false) {
  if (includeAllForeignPlanets) {
    return planetRoster.filter((planet) => planet.id !== HOME_PLANET_ID);
  }

  if (!planetId || planetId === HOME_PLANET_ID) {
    return [];
  }

  return planetRoster.filter((planet) => planet.id === planetId);
}

function getEventBoardWindowId(now = Date.now()) {
  return Math.floor(now / (EVENT_BOARD_ROTATION_SECONDS * 1000));
}

function getRegularOfferTargetCount(
  planetCount: number,
  boardWindowId: number,
) {
  return (
    MIN_EVENT_OFFERS +
    (hashString(`regular-offer-count:${boardWindowId}:${planetCount}`) %
      (MAX_EVENT_OFFERS - MIN_EVENT_OFFERS + 1))
  );
}

function getRegularOfferRank(offerId: string, boardWindowId: number) {
  return hashString(`${offerId}:${boardWindowId}:regular-rank`);
}

function pickVisibleOffers<
  TOffer extends { id: string; isSpecialOffer: boolean },
>(offers: TOffer[], planetCount: number, now = Date.now()) {
  const boardWindowId = getEventBoardWindowId(now);
  const regularTargetCount = getRegularOfferTargetCount(
    planetCount,
    boardWindowId,
  );
  const regularOffers = offers
    .filter((offer) => !offer.isSpecialOffer)
    .sort(
      (leftOffer, rightOffer) =>
        getRegularOfferRank(leftOffer.id, boardWindowId) -
        getRegularOfferRank(rightOffer.id, boardWindowId),
    )
    .slice(0, regularTargetCount);
  const specialOffers = offers
    .filter((offer) => offer.isSpecialOffer)
    .slice(0, SPECIAL_EVENT_SLOTS);

  return [...regularOffers, ...specialOffers];
}

function buildOffers(
  materials: Material[],
  maxRocketFuelCapacity: number,
  planetId?: string,
  includeAllForeignPlanets = false,
): GeneratedOffer[] {
  const planets = getEventPlanets(planetId, includeAllForeignPlanets);
  const fuelMaterial = getMaterialByName(materials, FUEL_MATERIAL_NAME);

  if (!fuelMaterial) {
    return [];
  }

  if (planets.length === 0) {
    return [];
  }

  const createGeneratedOffer = (
    planet: PlanetDefinition,
    slot: number,
    isSpecialOffer: boolean,
  ): GeneratedOffer | null => {
    const durationSeed = hashString(
      `${planet.id}:${isSpecialOffer ? "special" : "regular"}:${slot}:duration`,
    );
    const durationSeconds = isSpecialOffer
      ? pick(SPECIAL_EVENT_DURATION_SECONDS, durationSeed)
      : pick(EVENT_DURATION_SECONDS, durationSeed);
    const windowId = Math.floor(Date.now() / (durationSeconds * 1000));
    const refreshesAt = new Date((windowId + 1) * durationSeconds * 1000);
    const seed = hashString(
      `${planet.id}:${windowId}:${slot}:${durationSeconds}:${
        isSpecialOffer ? "special" : "regular"
      }`,
    );
    const appearancePercent = isSpecialOffer
      ? SPECIAL_EVENT_APPEARANCE_PERCENT
      : EVENT_APPEARANCE_PERCENT;

    if (seed % 100 >= appearancePercent) {
      return null;
    }

    const tradeKind: TradeKind = UserTradeKind.SELL;
    const routeDistance = getRouteDistance(planet);
    const requestedName = pick(planet.buys, seed + slot);
    const rewardName = pick(
      REWARD_MATERIAL_NAMES.filter((name) => name !== requestedName),
      seed + 11,
    );
    const requestedMaterial = getMaterialByName(materials, requestedName);
    const rewardMaterial = getMaterialByName(materials, rewardName);

    if (!requestedMaterial || !rewardMaterial) {
      return null;
    }

    const baseDemand = getContractDemand(requestedName, routeDistance, seed);
    const totalRequestedAmount = isSpecialOffer
      ? Math.max(100_000, Math.ceil(baseDemand * 0.35))
      : baseDemand;
    const requestedAmount = Math.min(
      MAX_SHIPMENT_AMOUNT,
      MAX_ROCKET_CARGO_CAPACITY,
      totalRequestedAmount,
      getMaxShipmentByFuelCapacity(
        routeDistance,
        requestedMaterial,
        maxRocketFuelCapacity,
      ),
    );

    if (requestedAmount <= 0) {
      return null;
    }

    const rewardMultiplier = isSpecialOffer
      ? SPECIAL_REWARD_MULTIPLIER
      : SELL_REWARD_MULTIPLIER;
    const rewardAmount = getExchangeAmount(
      requestedName,
      requestedAmount,
      rewardName,
      seed,
      rewardMultiplier,
    );
    const cappedRewardAmount = Math.max(
      1,
      Math.min(rewardAmount, MAX_ROCKET_CARGO_CAPACITY),
    );
    const fuelRequired = getFuelRequired(
      routeDistance,
      requestedAmount,
      requestedMaterial,
    );
    const loadSeconds = getLoadSeconds(requestedAmount, fuelRequired);
    const travelSeconds = getTravelSeconds(routeDistance, 2000);
    const title =
      tradeKind === UserTradeKind.SELL
        ? `${planet.name} buys ${requestedName}`
        : `${planet.name} sells ${rewardName}`;

    return {
      id: `${planet.id}:${durationSeconds}:${windowId}:${slot}:${
        isSpecialOffer ? "SPECIAL" : "REGULAR"
      }:${tradeKind}:${requestedName}:${rewardName}`,
      planet,
      tradeKind,
      isSpecialOffer,
      title: isSpecialOffer ? `Special: ${title}` : title,
      description: createOfferText(
        tradeKind,
        planet,
        requestedName,
        requestedAmount,
        rewardName,
        cappedRewardAmount,
        fuelRequired,
        seed,
        totalRequestedAmount,
      ),
      requestedMaterial,
      requestedAmount,
      totalRequestedAmount,
      remainingAmount: totalRequestedAmount,
      rewardMaterial,
      rewardAmount: cappedRewardAmount,
      fuelMaterial,
      fuelRequired,
      durationSeconds,
      travelSeconds,
      routeDistance,
      rewardMultiplier,
      loadSeconds,
      refreshesAt,
    };
  };

  const boardWindowId = getEventBoardWindowId();
  const regularOffers = planets
    .flatMap((planet) =>
      Array.from({ length: EVENT_CANDIDATE_SLOTS_PER_PLANET }, (_, slot) =>
        createGeneratedOffer(planet, slot, false),
      ),
    )
    .filter((offer): offer is GeneratedOffer => offer !== null)
    .sort(
      (leftOffer, rightOffer) =>
        getRegularOfferRank(leftOffer.id, boardWindowId) -
        getRegularOfferRank(rightOffer.id, boardWindowId),
    );
  const specialOffers = Array.from({ length: SPECIAL_EVENT_SLOTS }, (_, slot) =>
    createGeneratedOffer(
      pick(planets, hashString(`special-planet:${boardWindowId}:${slot}`)),
      slot,
      true,
    ),
  ).filter((offer): offer is GeneratedOffer => offer !== null);

  return [...regularOffers, ...specialOffers];
}

function mapTradeRow(row: TradeWithMaterials) {
  return {
    id: row.id,
    userId: row.userId,
    offerId: row.offerId,
    planetId: row.planetId,
    planetName: row.planetName,
    planetTexture: row.planetTexture,
    characterName: row.characterName,
    characterImage: row.characterImage,
    tradeKind: (row.tradeKind ?? UserTradeKind.SELL) as UserTradeKind,
    title: row.title,
    description: row.description,
    requestedMaterialId: row.requestedMaterialId,
    requestedMaterial: row.requestedMaterial,
    requestedAmount: row.requestedAmount,
    rewardMaterialId: row.rewardMaterialId,
    rewardMaterial: row.rewardMaterial,
    rewardAmount: row.rewardAmount,
    durationSeconds: row.durationSeconds,
    travelSeconds: row.travelSeconds,
    routeDistance: row.routeDistance ?? 0,
    status: row.status as UserTradeStatus,
    portSlot: row.portSlot,
    rocketId: row.rocketId,
    rocketName: row.rocketName,
    rocketImage: row.rocketImage,
    fuelMaterialId: row.fuelMaterialId,
    fuelRequired: row.fuelRequired ?? 0,
    fuelLoaded: row.fuelLoaded ?? 0,
    cargoLoaded: row.cargoLoaded ?? 0,
    loadSeconds: row.loadSeconds ?? 0,
    acceptedAt: row.acceptedAt,
    expiresAt: row.expiresAt,
    loadingStartedAt: row.loadingStartedAt,
    loadedAt: row.loadedAt,
    launchedAt: row.launchedAt,
    arrivesAt: row.arrivesAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getPortCapacity(db: RawDb, userId: string) {
  const pads = await db.userBuilding.findMany({
    where: {
      userId,
      amount: {
        gt: 0,
      },
      building: {
        name: "Launch Pad",
      },
    },
    select: {
      amount: true,
    },
  });

  return pads.reduce((total, pad) => total + pad.amount, 0);
}

async function getActiveRouteAssignments(db: RawDb, userId: string) {
  return db.userTrade.findMany({
    where: {
      userId,
      status: {
        in: [...ACTIVE_TRADE_STATUSES],
      },
    },
    select: {
      id: true,
      portSlot: true,
      rocketId: true,
      offerId: true,
    },
  });
}

async function getFilledAmountsByOfferId(db: RawDb, offerIds: string[]) {
  if (offerIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await db.userTrade.groupBy({
    by: ["offerId"],
    where: {
      offerId: {
        in: offerIds,
      },
      status: {
        in: [...FILLED_TRADE_STATUSES],
      },
    },
    _sum: {
      requestedAmount: true,
    },
  });

  return new Map(
    rows.map((row) => [row.offerId, row._sum.requestedAmount ?? 0]),
  );
}

function getFreePortSlot(
  portCapacity: number,
  usedSlots: Array<number | null>,
) {
  const occupiedSlots = new Set(
    usedSlots.filter((slot): slot is number => slot !== null),
  );

  for (let slot = 1; slot <= portCapacity; slot += 1) {
    if (!occupiedSlots.has(slot)) {
      return slot;
    }
  }

  return null;
}

function getInventoryMap(cargo: { materialId: string; amount: number }[]) {
  return new Map(cargo.map((item) => [item.materialId, item.amount]));
}

async function hasAutoRouteUnlocked(db: RawDb, userId: string) {
  const userBuilding = await db.userBuilding.findFirst({
    where: {
      userId,
      building: {
        name: "Launch Pad",
      },
      level: {
        gte: AUTO_ROUTE_UNLOCK_LEVEL,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(userBuilding);
}

async function isLegacyAutoRouteEnabled(db: RawDb, userId: string) {
  const userBuilding = await db.userBuilding.findFirst({
    where: {
      userId,
      building: {
        name: "Launch Pad",
      },
      level: {
        gte: AUTO_ROUTE_UNLOCK_LEVEL,
      },
      autoRouteEnabled: true,
    },
    select: {
      id: true,
    },
  });

  return Boolean(userBuilding);
}

async function getPortAutoRouteOverrides(db: RawDb, userId: string) {
  const rows = await db.userPortAutoRoute.findMany({
    where: {
      userId,
    },
    select: {
      portSlot: true,
      enabled: true,
    },
  });

  return new Map(rows.map((row) => [row.portSlot, row.enabled]));
}

async function getAutoRouteEnabledSlots(db: RawDb, userId: string) {
  const [unlocked, legacyEnabled, overrides, portCapacity] = await Promise.all([
    hasAutoRouteUnlocked(db, userId),
    isLegacyAutoRouteEnabled(db, userId),
    getPortAutoRouteOverrides(db, userId),
    getPortCapacity(db, userId),
  ]);
  const enabledSlots = new Set<number>();

  if (!unlocked) {
    return {
      unlocked,
      legacyEnabled,
      overrides,
      enabledSlots,
      isEnabledForSlot: (_portSlot: number | null) => false,
    };
  }

  for (let portSlot = 1; portSlot <= portCapacity; portSlot += 1) {
    if (overrides.get(portSlot) ?? legacyEnabled) {
      enabledSlots.add(portSlot);
    }
  }

  return {
    unlocked,
    legacyEnabled,
    overrides,
    enabledSlots,
    isEnabledForSlot(portSlot: number | null) {
      return portSlot !== null && enabledSlots.has(portSlot);
    },
  };
}

async function getPortAutoRouteState(db: RawDb, userId: string) {
  const unlocked = await hasAutoRouteUnlocked(db, userId);
  const legacyEnabled = await isLegacyAutoRouteEnabled(db, userId);
  const overrides = await getPortAutoRouteOverrides(db, userId);

  return {
    unlocked,
    legacyEnabled,
    overrides,
    isEnabledForSlot(portSlot: number | null) {
      if (!unlocked || portSlot === null) {
        return false;
      }

      return overrides.get(portSlot) ?? legacyEnabled;
    },
  };
}

function getMinimumShipment(remainingAmount: number) {
  return Math.min(remainingAmount, 1);
}

function getMaxShipmentByFuel(offer: GeneratedOffer, fuelCapacity: number) {
  if (fuelCapacity < MIN_ROCKET_FUEL_REQUIRED) {
    return 0;
  }

  let low = 0;
  let high = Math.min(MAX_SHIPMENT_AMOUNT, offer.totalRequestedAmount);

  while (low < high) {
    const mid = Math.ceil((low + high + 1) / 2);
    const midFuel = getFuelRequired(
      offer.routeDistance,
      mid,
      offer.requestedMaterial,
    );

    if (midFuel <= fuelCapacity) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

function getShipmentForRocket(
  offer: GeneratedOffer,
  rocket: Pick<RocketRouteOption, "cargoCapacity" | "fuelCapacity">,
  inventoryByMaterialId: Map<string, number>,
  remainingAmount: number,
) {
  const availableCargo =
    inventoryByMaterialId.get(offer.requestedMaterial.id) ?? 0;
  const availableFuel = inventoryByMaterialId.get(offer.fuelMaterial.id) ?? 0;
  const maxByFuel = getMaxShipmentByFuel(offer, rocket.fuelCapacity);
  let shipmentAmount = Math.max(
    0,
    Math.min(
      remainingAmount,
      availableCargo,
      rocket.cargoCapacity,
      maxByFuel,
      MAX_SHIPMENT_AMOUNT,
    ),
  );
  let fuelRequired =
    shipmentAmount > 0
      ? getFuelRequired(
          offer.routeDistance,
          shipmentAmount,
          offer.requestedMaterial,
        )
      : 0;

  if (offer.requestedMaterial.id === offer.fuelMaterial.id) {
    while (
      shipmentAmount > 0 &&
      shipmentAmount + fuelRequired > availableCargo
    ) {
      shipmentAmount -= 1;
      fuelRequired =
        shipmentAmount > 0
          ? getFuelRequired(
              offer.routeDistance,
              shipmentAmount,
              offer.requestedMaterial,
            )
          : 0;
    }
  }

  while (
    shipmentAmount > 0 &&
    offer.requestedMaterial.id !== offer.fuelMaterial.id &&
    availableFuel < fuelRequired
  ) {
    shipmentAmount -= 1;
    fuelRequired =
      shipmentAmount > 0
        ? getFuelRequired(
            offer.routeDistance,
            shipmentAmount,
            offer.requestedMaterial,
          )
        : 0;
  }

  if (shipmentAmount <= 0) {
    return null;
  }

  const rewardAmount = Math.max(
    1,
    Math.min(
      getExchangeAmount(
        offer.requestedMaterial.name as TradeMaterialName,
        shipmentAmount,
        offer.rewardMaterial.name as TradeMaterialName,
        hashString(offer.id),
        offer.rewardMultiplier,
      ),
      rocket.cargoCapacity,
    ),
  );

  return {
    shipmentAmount,
    fuelRequired,
    rewardAmount,
    loadSeconds: getLoadSeconds(shipmentAmount, fuelRequired),
  };
}

function getEligibleRockets(
  ownedRockets: OwnedRocketForRoute[],
  reservedRocketIds: Set<string>,
  offer: GeneratedOffer,
  inventoryByMaterialId: Map<string, number>,
  remainingAmount: number,
) {
  const minimumShipment = getMinimumShipment(remainingAmount);

  return ownedRockets
    .filter((ownedRocket) => !reservedRocketIds.has(ownedRocket.rocketId))
    .map((ownedRocket): RocketRouteOption | null => {
      const stats = getRocketStats(ownedRocket.rocket, ownedRocket.upgrade);
      const shipment = getShipmentForRocket(
        offer,
        stats,
        inventoryByMaterialId,
        remainingAmount,
      );

      if (!shipment || shipment.shipmentAmount < minimumShipment) {
        return null;
      }

      return {
        id: ownedRocket.rocket.id,
        name: ownedRocket.rocket.name,
        image: ownedRocket.rocket.image,
        upgrade: ownedRocket.upgrade,
        speed: stats.speed,
        cargoCapacity: stats.cargoCapacity,
        fuelCapacity: stats.fuelCapacity,
        travelSeconds: getTravelSeconds(offer.routeDistance, stats.speed),
        ...shipment,
      };
    })
    .filter((rocket): rocket is RocketRouteOption => rocket !== null)
    .sort((first, second) => first.travelSeconds - second.travelSeconds);
}

function getLoadProgress(trade: ReturnType<typeof mapTradeRow>, now: number) {
  if (trade.status !== UserTradeStatus.LOADING) {
    return 1;
  }

  if (!trade.loadingStartedAt || !trade.loadedAt || trade.loadSeconds <= 0) {
    return 0;
  }

  const totalMs = Math.max(
    1,
    trade.loadedAt.getTime() - trade.loadingStartedAt.getTime(),
  );
  const elapsedMs = Math.max(0, now - trade.loadingStartedAt.getTime());

  return Math.min(1, elapsedMs / totalMs);
}

async function refundPreLaunchTrade(
  tx: Prisma.TransactionClient,
  userId: string,
  trade: ReturnType<typeof mapTradeRow>,
) {
  await addInventoryAmount(
    tx,
    userId,
    trade.requestedMaterialId,
    trade.requestedAmount,
  );

  if (trade.fuelMaterialId && trade.fuelRequired > 0) {
    await addInventoryAmount(
      tx,
      userId,
      trade.fuelMaterialId,
      trade.fuelRequired,
    );
  }
}

async function completeTradeReward(
  tx: Prisma.TransactionClient,
  userId: string,
  trade: ReturnType<typeof mapTradeRow>,
  completedAt: Date,
) {
  const updated = await tx.userTrade.updateMany({
    where: {
      id: trade.id,
      status: {
        not: UserTradeStatus.COMPLETED,
      },
    },
    data: {
      status: UserTradeStatus.COMPLETED,
      completedAt,
      updatedAt: completedAt,
    },
  });

  if (updated.count === 0) {
    return true;
  }

  await addInventoryAmount(
    tx,
    userId,
    trade.rewardMaterialId,
    trade.rewardAmount,
  );

  return true;
}

function getMissingRequirements(
  trade: ReturnType<typeof mapTradeRow>,
  inventoryByMaterialId: Map<string, number>,
) {
  const requestedAvailable =
    inventoryByMaterialId.get(trade.requestedMaterialId) ?? 0;
  const fuelAvailable = trade.fuelMaterialId
    ? inventoryByMaterialId.get(trade.fuelMaterialId) ?? 0
    : 0;
  const missing: string[] = [];

  if (trade.fuelMaterialId === trade.requestedMaterialId) {
    const required = trade.requestedAmount + trade.fuelRequired;

    if (requestedAvailable < required) {
      missing.push(
        `${required - requestedAvailable} ${trade.requestedMaterial.name}`,
      );
    }

    return missing;
  }

  if (requestedAvailable < trade.requestedAmount) {
    missing.push(
      `${trade.requestedAmount - requestedAvailable} ${
        trade.requestedMaterial.name
      }`,
    );
  }

  if (trade.fuelRequired > 0 && fuelAvailable < trade.fuelRequired) {
    missing.push(`${trade.fuelRequired - fuelAvailable} H3`);
  }

  return missing;
}

function logAutoRouteEvent(
  event: "stopped" | "restarted",
  userId: string,
  trade: ReturnType<typeof mapTradeRow>,
  details: Record<string, unknown> = {},
) {
  console.info("[auto-route]", {
    event,
    userId,
    tradeId: trade.id,
    offerId: trade.offerId,
    portSlot: trade.portSlot,
    rocketId: trade.rocketId,
    rocketName: trade.rocketName,
    route: trade.title,
    status: trade.status,
    ...details,
  });
}

function getStoppedStatusMessage(
  trade: ReturnType<typeof mapTradeRow>,
  missingRequirements: string[],
  autoRouteEnabled: boolean,
  now: number,
) {
  const hasContractTimeBlock =
    missingRequirements.includes("active contract time") ||
    missingRequirements.includes("loading window") ||
    trade.expiresAt.getTime() <= now;

  if (!autoRouteEnabled) {
    return `Auto-route is off on pad ${
      trade.portSlot ?? "-"
    }. Enable it to continue this route.`;
  }

  if (hasContractTimeBlock) {
    return "Contract window closed before the next load could start. Clear this route and pick a new job.";
  }

  if (missingRequirements.includes("active contract")) {
    return "Route event is no longer available. Clear this route and pick a new job.";
  }

  if (missingRequirements.includes("contract stock")) {
    return "Contract stock is sold out. Clear this route and pick a new job.";
  }

  if (missingRequirements.length > 0) {
    return `Auto-route paused. Waiting for ${missingRequirements.join(
      ", ",
    )}; it will retry after inventory syncs.`;
  }

  return "Auto-route paused. Contract stock is sold out or this route needs reassignment.";
}

async function repeatTradeIfPossible(
  tx: Prisma.TransactionClient,
  userId: string,
  trade: ReturnType<typeof mapTradeRow>,
  now: Date,
  payReward = true,
) {
  if (payReward) {
    await addInventoryAmount(
      tx,
      userId,
      trade.rewardMaterialId,
      trade.rewardAmount,
    );
  }

  const inventory = await tx.cargo.findMany({
    where: {
      userId,
      questId: null,
      rocketId: null,
    },
    select: {
      materialId: true,
      amount: true,
    },
  });
  const inventoryByMaterialId = getInventoryMap(inventory);
  const missingRequirements: string[] = [];
  let repeatShipment: {
    requestedAmount: number;
    fuelRequired: number;
    rewardAmount: number;
    loadSeconds: number;
    travelSeconds: number;
  } | null = null;

  if (trade.expiresAt.getTime() <= now.getTime()) {
    missingRequirements.push("active contract time");
  }

  const materials = await tx.material.findMany();
  const currentOffer = buildOffers(
    materials,
    MAX_ROCKET_FUEL_CAPACITY,
    undefined,
    true,
  ).find(
    (offer) => offer.id === trade.offerId,
  );

  if (!currentOffer) {
    missingRequirements.push("active contract");
  } else {
    const filledAmountsByOfferId = await getFilledAmountsByOfferId(tx, [
      trade.offerId,
    ]);
    const remainingAmount = Math.max(
      0,
      currentOffer.totalRequestedAmount -
        (filledAmountsByOfferId.get(trade.offerId) ?? 0),
    );

    if (remainingAmount <= 0) {
      missingRequirements.push("contract stock");
    } else if (!trade.rocketId) {
      missingRequirements.push("assigned rocket");
    } else {
      const ownedRocket = await tx.userRocket.findFirst({
        where: {
          userId,
          rocketId: trade.rocketId,
        },
        include: {
          rocket: true,
        },
      });

      if (!ownedRocket) {
        missingRequirements.push("assigned rocket");
      } else {
        const stats = getRocketStats(ownedRocket.rocket, ownedRocket.upgrade);
        const shipment = getShipmentForRocket(
          currentOffer,
          stats,
          inventoryByMaterialId,
          remainingAmount,
        );

        if (!shipment || shipment.shipmentAmount < 1) {
          missingRequirements.push(
            ...getMissingRequirements(trade, inventoryByMaterialId),
          );
        } else {
          repeatShipment = {
            requestedAmount: shipment.shipmentAmount,
            fuelRequired: shipment.fuelRequired,
            rewardAmount: shipment.rewardAmount,
            loadSeconds: shipment.loadSeconds,
            travelSeconds: getTravelSeconds(
              currentOffer.routeDistance,
              stats.speed,
            ),
          };
        }
      }
    }
  }

  const repeatLoadSeconds =
    repeatShipment?.loadSeconds ??
    getLoadSeconds(trade.requestedAmount, trade.fuelRequired);
  const loadedAt = new Date(now.getTime() + repeatLoadSeconds * 1000);

  if (loadedAt.getTime() >= trade.expiresAt.getTime()) {
    missingRequirements.push("loading window");
  }

  if (missingRequirements.length > 0 || !repeatShipment) {
    if (missingRequirements.length === 0) {
      missingRequirements.push("cargo or fuel");
    }

    await tx.userTrade.updateMany({
      where: {
        id: trade.id,
        status: {
          in: [...RETURNED_OR_STOPPED_STATUSES],
        },
      },
      data: {
        status: UserTradeStatus.STOPPED,
        completedAt: trade.completedAt ?? now,
        updatedAt: now,
      },
    });
    logAutoRouteEvent("stopped", userId, trade, {
      reasons: missingRequirements,
      clearedPad: false,
      requestedAmount: trade.requestedAmount,
      requestedMaterial: trade.requestedMaterial.name,
      fuelRequired: trade.fuelRequired,
      expiresAt: trade.expiresAt.toISOString(),
    });

    return payReward;
  }

  await reserveInventoryAmount(
    tx,
    userId,
    trade.requestedMaterialId,
    trade.requestedMaterial.name,
    repeatShipment.requestedAmount,
  );

  if (trade.fuelMaterialId && repeatShipment.fuelRequired > 0) {
    await reserveInventoryAmount(
      tx,
      userId,
      trade.fuelMaterialId,
      "H3",
      repeatShipment.fuelRequired,
    );
  }

  const repeatTradeId = randomUUID();

  await tx.userTrade.updateMany({
    where: {
      id: trade.id,
      status: {
        in: [...RETURNED_OR_STOPPED_STATUSES],
      },
    },
    data: {
      status: UserTradeStatus.COMPLETED,
      completedAt: now,
      updatedAt: now,
    },
  });

  await tx.userTrade.create({
    data: {
      id: repeatTradeId,
      userId,
      offerId: trade.offerId,
      planetId: trade.planetId,
      planetName: trade.planetName,
      planetTexture: trade.planetTexture,
      characterName: trade.characterName,
      characterImage: trade.characterImage,
      tradeKind: trade.tradeKind,
      title: trade.title,
      description: trade.description,
      requestedMaterialId: trade.requestedMaterialId,
      requestedAmount: repeatShipment.requestedAmount,
      rewardMaterialId: trade.rewardMaterialId,
      rewardAmount: repeatShipment.rewardAmount,
      durationSeconds: trade.durationSeconds,
      travelSeconds: repeatShipment.travelSeconds,
      routeDistance: trade.routeDistance ?? 0,
      status: UserTradeStatus.LOADING,
      portSlot: trade.portSlot,
      rocketId: trade.rocketId,
      rocketName: trade.rocketName,
      rocketImage: trade.rocketImage,
      fuelMaterialId: trade.fuelMaterialId,
      fuelRequired: repeatShipment.fuelRequired,
      fuelLoaded: 0,
      cargoLoaded: 0,
      loadSeconds: repeatShipment.loadSeconds,
      acceptedAt: now,
      expiresAt: trade.expiresAt,
      loadingStartedAt: now,
      loadedAt,
      createdAt: now,
      updatedAt: now,
    },
  });
  logAutoRouteEvent("restarted", userId, trade, {
    repeatTradeId,
    requestedAmount: repeatShipment.requestedAmount,
    fuelRequired: repeatShipment.fuelRequired,
    loadSeconds: repeatShipment.loadSeconds,
    loadedAt: loadedAt.toISOString(),
  });

  return true;
}

async function expireAndRefundPreLaunchTrade(
  tx: Prisma.TransactionClient,
  userId: string,
  trade: ReturnType<typeof mapTradeRow>,
  now: Date,
) {
  const updated = await tx.userTrade.updateMany({
    where: {
      id: trade.id,
      status: {
        in: [...PRE_LAUNCH_STATUSES],
      },
    },
    data: {
      status: UserTradeStatus.EXPIRED,
      updatedAt: now,
    },
  });

  if (updated.count === 0) {
    return false;
  }

  await refundPreLaunchTrade(tx, userId, trade);

  return true;
}

async function launchReadyTradesForAutoRoute(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
  autoRouteState: Awaited<ReturnType<typeof getAutoRouteEnabledSlots>>,
) {
  if (!autoRouteState.unlocked) {
    return 0;
  }

  const readyRows = await tx.userTrade.findMany({
    where: {
      userId,
      status: UserTradeStatus.READY_TO_LAUNCH,
      expiresAt: {
        gt: now,
      },
    },
    include: tradeWithMaterialsInclude,
    orderBy: {
      loadedAt: "asc",
    },
  });
  let launchedCount = 0;

  for (const row of readyRows) {
    const trade = mapTradeRow(row);

    if (!autoRouteState.isEnabledForSlot(trade.portSlot)) {
      continue;
    }

    const arrivesAt = new Date(
      now.getTime() + Math.max(1, trade.travelSeconds) * 1000,
    );
    const updated = await tx.userTrade.updateMany({
      where: {
        id: trade.id,
        userId,
        status: UserTradeStatus.READY_TO_LAUNCH,
      },
      data: {
        status: UserTradeStatus.IN_ROUTE,
        launchedAt: now,
        arrivesAt,
        updatedAt: now,
      },
    });

    if (updated.count > 0) {
      launchedCount += 1;
    }
  }

  return launchedCount;
}

async function startLandingTrade(
  tx: Prisma.TransactionClient,
  userId: string,
  trade: ReturnType<typeof mapTradeRow>,
  now: Date,
) {
  const landingEndsAt = new Date(now.getTime() + LANDING_SECONDS * 1000);
  const updated = await tx.userTrade.updateMany({
    where: {
      id: trade.id,
      userId,
      status: UserTradeStatus.IN_ROUTE,
    },
    data: {
      status: UserTradeStatus.LANDING,
      completedAt: landingEndsAt,
      updatedAt: now,
    },
  });

  return updated.count > 0;
}

async function advanceLoadedTrades(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
) {
  const loadedTrades = await tx.userTrade.findMany({
    where: {
      userId,
      status: UserTradeStatus.LOADING,
      expiresAt: {
        gt: now,
      },
      loadedAt: {
        lte: now,
      },
    },
    select: {
      id: true,
      requestedAmount: true,
      fuelRequired: true,
      loadedAt: true,
    },
  });

  for (const trade of loadedTrades) {
    await tx.userTrade.updateMany({
      where: {
        id: trade.id,
        userId,
        status: UserTradeStatus.LOADING,
        expiresAt: {
          gt: now,
        },
        loadedAt: {
          lte: now,
        },
      },
      data: {
        status: UserTradeStatus.READY_TO_LAUNCH,
        cargoLoaded: trade.requestedAmount,
        fuelLoaded: trade.fuelRequired,
        loadedAt: trade.loadedAt ?? now,
        updatedAt: now,
      },
    });
  }
}

async function syncTradeStatuses(db: PrismaClient, userId: string) {
  const now = new Date();

  await syncPlayerGameState(db, userId, now);

  await db.$transaction(async (tx) => {
    const autoRouteState = await getAutoRouteEnabledSlots(tx, userId);

    await tx.userTrade.updateMany({
      where: {
        userId,
        status: UserTradeStatus.ACCEPTED,
      },
      data: {
        status: UserTradeStatus.EXPIRED,
        updatedAt: now,
      },
    });

    await tx.userTrade.updateMany({
      where: {
        userId,
        status: UserTradeStatus.IN_FLIGHT,
      },
      data: {
        status: UserTradeStatus.IN_ROUTE,
        updatedAt: now,
      },
    });

    const expiredRows = await tx.userTrade.findMany({
      where: {
        userId,
        status: {
          in: [...PRE_LAUNCH_STATUSES],
        },
        expiresAt: {
          lte: now,
        },
      },
      include: tradeWithMaterialsInclude,
      orderBy: {
        acceptedAt: "desc",
      },
    });

    for (const row of expiredRows) {
      const trade = mapTradeRow(row);
      await expireAndRefundPreLaunchTrade(tx, userId, trade, now);
    }

    await advanceLoadedTrades(tx, userId, now);
    await launchReadyTradesForAutoRoute(tx, userId, now, autoRouteState);

    const arrivedRows = await tx.userTrade.findMany({
      where: {
        userId,
        OR: [
          {
            status: UserTradeStatus.IN_ROUTE,
            arrivesAt: {
              lte: now,
            },
          },
          {
            status: {
              in: [...LEGACY_READY_STATUSES],
            },
          },
        ],
      },
      include: tradeWithMaterialsInclude,
      orderBy: {
        arrivesAt: "asc",
      },
    });
    const arrivedTrades = arrivedRows.map(mapTradeRow);
    const completedTrades: typeof arrivedTrades = [];

    for (const trade of arrivedTrades) {
      if (
        trade.status === UserTradeStatus.IN_ROUTE &&
        autoRouteState.isEnabledForSlot(trade.portSlot)
      ) {
        await startLandingTrade(tx, userId, trade, now);
        continue;
      }

      const completed = await completeTradeReward(tx, userId, trade, now);

      if (completed) {
        completedTrades.push(trade);
      }
    }

    const landedRows = await tx.userTrade.findMany({
      where: {
        userId,
        status: UserTradeStatus.LANDING,
        completedAt: {
          lte: now,
        },
      },
      include: tradeWithMaterialsInclude,
      orderBy: {
        completedAt: "asc",
      },
    });
    const landedTrades = landedRows.map(mapTradeRow);

    for (const trade of landedTrades) {
      const completed = autoRouteState.isEnabledForSlot(trade.portSlot)
        ? await repeatTradeIfPossible(tx, userId, trade, now)
        : await completeTradeReward(tx, userId, trade, now);

      if (completed) {
        completedTrades.push(trade);
      }
    }

    const stoppedRows = await tx.userTrade.findMany({
      where: {
        userId,
        status: UserTradeStatus.STOPPED,
      },
      include: tradeWithMaterialsInclude,
      orderBy: {
        updatedAt: "asc",
      },
    });
    const stoppedTrades = stoppedRows.map(mapTradeRow);

    for (const trade of stoppedTrades) {
      if (trade.expiresAt.getTime() <= now.getTime()) {
        continue;
      }

      if (!autoRouteState.isEnabledForSlot(trade.portSlot)) {
        continue;
      }

      await repeatTradeIfPossible(tx, userId, trade, now, false);
    }

    if (completedTrades.length > 0) {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          experiencePoints: {
            increment: completedTrades.reduce(
              (total, trade) =>
                total + Math.max(1, Math.floor(trade.rewardAmount / 20)),
              0,
            ),
          },
        },
      });
    }

    await advanceLoadedTrades(tx, userId, now);
    await launchReadyTradesForAutoRoute(tx, userId, now, autoRouteState);
  });
}

async function launchTradeForUser(
  db: PrismaClient,
  userId: string,
  tradeId: string,
) {
  await ensurePlayerState(db, userId);
  await syncTradeStatuses(db, userId);

  const row = await db.userTrade.findFirst({
    where: {
      id: tradeId,
      userId,
    },
    include: tradeWithMaterialsInclude,
  });

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Trade not found.",
    });
  }

  const trade = mapTradeRow(row);

  if (trade.status !== UserTradeStatus.READY_TO_LAUNCH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        trade.status === UserTradeStatus.LOADING
          ? "Cargo and fuel are still loading."
          : "Route is not ready to launch.",
    });
  }

  if (trade.expiresAt.getTime() <= Date.now()) {
    await syncTradeStatuses(db, userId);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Trade deadline passed.",
    });
  }

  const launchedAt = new Date();
  const arrivesAt = new Date(
    launchedAt.getTime() + Math.max(1, trade.travelSeconds) * 1000,
  );

  await db.userTrade.updateMany({
    where: {
      id: trade.id,
      userId,
      status: UserTradeStatus.READY_TO_LAUNCH,
    },
    data: {
      status: UserTradeStatus.IN_ROUTE,
      launchedAt,
      arrivesAt,
      updatedAt: launchedAt,
    },
  });

  return {
    status: 200,
    message: "Rocket launched. Reward pays out when it returns home.",
    arrivesAt,
  };
}

export const questRouter = createTRPCRouter({
  getPlanets: protectedProcedure.query(() => {
    return planetRoster;
  }),

  getPortAutoRoutes: protectedProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    await ensurePlayerState(db, session.user.id);

    const [portCapacity, autoRouteState] = await Promise.all([
      getPortCapacity(db, session.user.id),
      getPortAutoRouteState(db, session.user.id),
    ]);

    return Array.from({ length: portCapacity }, (_, index) => {
      const portSlot = index + 1;

      return {
        portSlot,
        enabled: autoRouteState.isEnabledForSlot(portSlot),
        canUseAutoRoute: autoRouteState.unlocked,
        unlockLevel: AUTO_ROUTE_UNLOCK_LEVEL,
      };
    });
  }),

  setPortAutoRoute: protectedProcedure
    .input(
      z.object({
        portSlot: z.number().int().min(1),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      await ensurePlayerState(db, session.user.id);

      const [portCapacity, unlocked] = await Promise.all([
        getPortCapacity(db, session.user.id),
        hasAutoRouteUnlocked(db, session.user.id),
      ]);

      if (input.portSlot > portCapacity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Launch pad ${input.portSlot} does not exist.`,
        });
      }

      if (!unlocked) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Auto route unlocks at Launch Pad level ${AUTO_ROUTE_UNLOCK_LEVEL}.`,
        });
      }

      const existingOverride = await db.userPortAutoRoute.findFirst({
        where: {
          userId: session.user.id,
          portSlot: input.portSlot,
        },
        select: {
          id: true,
        },
      });

      if (existingOverride) {
        await db.userPortAutoRoute.update({
          where: {
            id: existingOverride.id,
          },
          data: {
            enabled: input.enabled,
          },
        });
      } else {
        await db.userPortAutoRoute.create({
          data: {
            userId: session.user.id,
            portSlot: input.portSlot,
            enabled: input.enabled,
          },
        });
      }

      await syncTradeStatuses(db, session.user.id);

      return {
        status: 200,
        message: input.enabled
          ? `Auto route enabled on pad ${input.portSlot}.`
          : `Auto route disabled on pad ${input.portSlot}.`,
      };
    }),

  getOffers: protectedProcedure
    .input(
      z
        .object({
          planetId: z.string().optional(),
          includeAllForeignPlanets: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      await ensurePlayerState(db, session.user.id);
      await syncTradeStatuses(db, session.user.id);

      const [
        materials,
        activeAssignments,
        portCapacity,
        inventory,
        ownedRockets,
      ] = await Promise.all([
        db.material.findMany(),
        getActiveRouteAssignments(db, session.user.id),
        getPortCapacity(db, session.user.id),
        db.cargo.findMany({
          where: {
            userId: session.user.id,
            questId: null,
            rocketId: null,
          },
          select: {
            materialId: true,
            amount: true,
          },
        }),
        db.userRocket.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            rocket: true,
          },
          orderBy: {
            purchasedAt: "asc",
          },
        }),
      ]);
      const freePortCount = Math.max(
        0,
        portCapacity - activeAssignments.length,
      );

      if (freePortCount <= 0) {
        return [];
      }

      const inventoryByMaterialId = getInventoryMap(inventory);
      const reservedRocketIds = new Set(
        activeAssignments
          .map((trade) => trade.rocketId)
          .filter((rocketId): rocketId is string => Boolean(rocketId)),
      );
      const now = Date.now();
      const eventPlanetCount = getEventPlanets(
        input?.planetId,
        input?.includeAllForeignPlanets ?? false,
      ).length;
      const generatedOffers = buildOffers(
        materials,
        MAX_ROCKET_FUEL_CAPACITY,
        input?.planetId,
        input?.includeAllForeignPlanets ?? false,
      );
      const filledAmountsByOfferId = await getFilledAmountsByOfferId(
        db,
        generatedOffers.map((offer) => offer.id),
      );

      const availableOffers = generatedOffers
        .map((offer) => {
          const remainingAmount = Math.max(
            0,
            offer.totalRequestedAmount -
              (filledAmountsByOfferId.get(offer.id) ?? 0),
          );
          const eligibleRockets = getEligibleRockets(
            ownedRockets,
            reservedRocketIds,
            offer,
            inventoryByMaterialId,
            remainingAmount,
          );
          const recommendedRocket = eligibleRockets[0];

          if (
            remainingAmount <= 0 ||
            now +
              (recommendedRocket?.loadSeconds ?? offer.loadSeconds) * 1000 >=
              offer.refreshesAt.getTime()
          ) {
            return null;
          }

          return {
            ...offer,
            requestedAmount:
              recommendedRocket?.shipmentAmount ??
              Math.min(remainingAmount, offer.requestedAmount),
            remainingAmount,
            fuelRequired: recommendedRocket?.fuelRequired ?? offer.fuelRequired,
            rewardAmount: recommendedRocket?.rewardAmount ?? offer.rewardAmount,
            loadSeconds: recommendedRocket?.loadSeconds ?? offer.loadSeconds,
            isActive: false,
            travelSeconds:
              recommendedRocket?.travelSeconds ?? offer.travelSeconds,
            recommendedRocketId: recommendedRocket?.id ?? null,
            recommendedRocketName: recommendedRocket
              ? `${recommendedRocket.name} Mk ${recommendedRocket.upgrade}`
              : null,
            eligibleRockets,
            unavailableReason: recommendedRocket
              ? null
              : "No idle rocket can carry enough cargo and H3 for this contract.",
            secondsUntilRefresh: Math.max(
              0,
              Math.ceil((offer.refreshesAt.getTime() - now) / 1000),
            ),
          };
        })
        .filter((offer): offer is NonNullable<typeof offer> => offer !== null);

      return pickVisibleOffers(availableOffers, eventPlanetCount, now);
    }),

  getActiveTrades: protectedProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    await ensurePlayerState(db, session.user.id);
    await syncTradeStatuses(db, session.user.id);

    const [rows, inventory, autoRouteState] = await Promise.all([
      db.userTrade.findMany({
        where: {
          userId: session.user.id,
          status: {
            in: [...VISIBLE_TRADE_STATUSES],
          },
        },
        include: tradeWithMaterialsInclude,
        orderBy: {
          acceptedAt: "desc",
        },
      }),
      db.cargo.findMany({
        where: {
          userId: session.user.id,
          questId: null,
          rocketId: null,
        },
        select: {
          materialId: true,
          amount: true,
        },
      }),
      getPortAutoRouteState(db, session.user.id),
    ]);
    const now = Date.now();
    const inventoryByMaterialId = getInventoryMap(inventory);

    return rows.map((row) => {
      const trade = mapTradeRow(row);
      const loadProgress = getLoadProgress(trade, now);
      const missingRequirements =
        trade.status === UserTradeStatus.STOPPED
          ? getMissingRequirements(trade, inventoryByMaterialId)
          : [];
      const autoRouteEnabled = autoRouteState.isEnabledForSlot(trade.portSlot);
      const routeProgress =
        trade.status === UserTradeStatus.IN_ROUTE &&
        trade.launchedAt &&
        trade.arrivesAt
          ? Math.min(
              1,
              Math.max(
                0,
                (now - trade.launchedAt.getTime()) /
                  Math.max(
                    1,
                    trade.arrivesAt.getTime() - trade.launchedAt.getTime(),
                  ),
              ),
            )
          : trade.status === UserTradeStatus.IN_ROUTE
            ? 0
            : 1;
      const landingSecondsRemaining =
        trade.status === UserTradeStatus.LANDING && trade.completedAt
          ? Math.max(0, Math.ceil((trade.completedAt.getTime() - now) / 1000))
          : null;

      return {
        ...trade,
        cargoLoaded:
          trade.status === UserTradeStatus.LOADING
            ? Math.floor(trade.requestedAmount * loadProgress)
            : trade.requestedAmount,
        fuelLoaded:
          trade.status === UserTradeStatus.LOADING
            ? Math.floor(trade.fuelRequired * loadProgress)
            : trade.fuelRequired,
        loadProgress,
        routeProgress,
        autoRouteEnabled,
        statusMessage:
          trade.status === UserTradeStatus.STOPPED
            ? getStoppedStatusMessage(
                trade,
                missingRequirements,
                autoRouteEnabled,
                now,
              )
            : trade.status === UserTradeStatus.READY_TO_LAUNCH &&
                !autoRouteEnabled
              ? `Ready on pad ${trade.portSlot ?? "-"}. Auto-route is off.`
              : null,
        secondsUntilDeadline: Math.max(
          0,
          Math.ceil((trade.expiresAt.getTime() - now) / 1000),
        ),
        secondsUntilLoaded: trade.loadedAt
          ? Math.max(0, Math.ceil((trade.loadedAt.getTime() - now) / 1000))
          : null,
        secondsUntilArrival: trade.arrivesAt
          ? Math.max(0, Math.ceil((trade.arrivesAt.getTime() - now) / 1000))
          : null,
        secondsUntilLandingComplete: landingSecondsRemaining,
      };
    });
  }),

  getCompletedTrades: protectedProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    await ensurePlayerState(db, session.user.id);
    await syncTradeStatuses(db, session.user.id);

    const rows = await db.userTrade.findMany({
      where: {
        userId: session.user.id,
        status: UserTradeStatus.COMPLETED,
      },
      include: tradeWithMaterialsInclude,
      orderBy: {
        completedAt: "desc",
      },
      take: 8,
    });

    return rows.map(mapTradeRow);
  }),

  getLaunchOptions: protectedProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    await ensurePlayerState(db, session.user.id);

    const ownedRockets = await db.userRocket.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        rocket: true,
      },
      orderBy: {
        purchasedAt: "asc",
      },
    });

    return ownedRockets.map((ownedRocket) => ({
      id: ownedRocket.rocket.id,
      name: ownedRocket.rocket.name,
      image: ownedRocket.rocket.image,
      upgrade: ownedRocket.upgrade,
      owned: true,
      ...getRocketStats(ownedRocket.rocket, ownedRocket.upgrade),
    }));
  }),

  acceptTrade: protectedProcedure
    .input(
      z.object({
        offerId: z.string(),
        rocketId: z.string().optional(),
        portSlot: z.number().int().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      await ensurePlayerState(db, session.user.id);
      await syncTradeStatuses(db, session.user.id);

      const [
        materials,
        activeAssignments,
        portCapacity,
        inventory,
        ownedRockets,
      ] = await Promise.all([
        db.material.findMany(),
        getActiveRouteAssignments(db, session.user.id),
        getPortCapacity(db, session.user.id),
        db.cargo.findMany({
          where: {
            userId: session.user.id,
            questId: null,
            rocketId: null,
          },
          select: {
            materialId: true,
            amount: true,
          },
        }),
        db.userRocket.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            rocket: true,
          },
          orderBy: {
            purchasedAt: "asc",
          },
        }),
      ]);
      const usedPortSlots = activeAssignments.map((trade) => trade.portSlot);
      const requestedPortSlot = input.portSlot;
      const portSlot = requestedPortSlot
        ? usedPortSlots.includes(requestedPortSlot) ||
          requestedPortSlot > portCapacity
          ? null
          : requestedPortSlot
        : getFreePortSlot(portCapacity, usedPortSlots);

      if (!portSlot) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: requestedPortSlot
            ? `Launch pad ${requestedPortSlot} is not available.`
            : "No free launch pads.",
        });
      }

      const offer = buildOffers(
        materials,
        MAX_ROCKET_FUEL_CAPACITY,
        undefined,
        true,
      ).find(
        (generatedOffer) => generatedOffer.id === input.offerId,
      );

      if (!offer || offer.refreshesAt.getTime() <= Date.now()) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trade route is no longer available.",
        });
      }

      const inventoryByMaterialId = getInventoryMap(inventory);
      const filledAmountsByOfferId = await getFilledAmountsByOfferId(db, [
        offer.id,
      ]);
      const remainingAmount = Math.max(
        0,
        offer.totalRequestedAmount -
          (filledAmountsByOfferId.get(offer.id) ?? 0),
      );

      const reservedRocketIds = new Set(
        activeAssignments
          .map((trade) => trade.rocketId)
          .filter((rocketId): rocketId is string => Boolean(rocketId)),
      );
      const eligibleRockets = getEligibleRockets(
        ownedRockets,
        reservedRocketIds,
        offer,
        inventoryByMaterialId,
        remainingAmount,
      );
      const selectedRocket =
        eligibleRockets.find((rocket) => rocket.id === input.rocketId) ??
        eligibleRockets[0];

      if (!selectedRocket) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No owned rocket can carry this route.",
        });
      }

      if (input.rocketId && selectedRocket.id !== input.rocketId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected rocket is busy or cannot handle the route.",
        });
      }

      const now = new Date();
      const loadedAt = new Date(
        now.getTime() + selectedRocket.loadSeconds * 1000,
      );

      if (loadedAt.getTime() >= offer.refreshesAt.getTime()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Not enough time left to load this route.",
        });
      }

      const tradeId = randomUUID();

      await db.$transaction(async (tx) => {
        await reserveInventoryAmount(
          tx,
          session.user.id,
          offer.requestedMaterial.id,
          offer.requestedMaterial.name,
          selectedRocket.shipmentAmount,
        );
        await reserveInventoryAmount(
          tx,
          session.user.id,
          offer.fuelMaterial.id,
          offer.fuelMaterial.name,
          selectedRocket.fuelRequired,
        );

        await tx.userTrade.create({
          data: {
            id: tradeId,
            userId: session.user.id,
            offerId: offer.id,
            planetId: offer.planet.id,
            planetName: offer.planet.name,
            planetTexture: offer.planet.texture,
            characterName: offer.planet.character.name,
            characterImage: offer.planet.character.image,
            tradeKind: offer.tradeKind,
            title: offer.title,
            description: offer.description,
            requestedMaterialId: offer.requestedMaterial.id,
            requestedAmount: selectedRocket.shipmentAmount,
            rewardMaterialId: offer.rewardMaterial.id,
            rewardAmount: selectedRocket.rewardAmount,
            durationSeconds: offer.durationSeconds,
            travelSeconds: selectedRocket.travelSeconds,
            routeDistance: offer.routeDistance,
            status: UserTradeStatus.LOADING,
            portSlot,
            rocketId: selectedRocket.id,
            rocketName: `${selectedRocket.name} Mk ${selectedRocket.upgrade}`,
            rocketImage: selectedRocket.image,
            fuelMaterialId: offer.fuelMaterial.id,
            fuelRequired: selectedRocket.fuelRequired,
            fuelLoaded: 0,
            cargoLoaded: 0,
            loadSeconds: selectedRocket.loadSeconds,
            acceptedAt: now,
            expiresAt: offer.refreshesAt,
            loadingStartedAt: now,
            loadedAt,
            createdAt: now,
            updatedAt: now,
          },
        });
      });

      return {
        status: 201,
        message: `Route accepted. Alpha Haven port ${portSlot} is loading cargo and fuel.`,
        tradeId,
      };
    }),

  launchTrade: protectedProcedure
    .input(z.object({ tradeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      return launchTradeForUser(db, session.user.id, input.tradeId);
    }),

  dispatchTrade: protectedProcedure
    .input(z.object({ tradeId: z.string(), rocketId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      return launchTradeForUser(db, session.user.id, input.tradeId);
    }),

  claimTrade: protectedProcedure
    .input(z.object({ tradeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      await ensurePlayerState(db, session.user.id);
      await syncTradeStatuses(db, session.user.id);

      const row = await db.userTrade.findFirst({
        where: {
          id: input.tradeId,
          userId: session.user.id,
        },
        include: tradeWithMaterialsInclude,
      });

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trade not found.",
        });
      }

      const trade = mapTradeRow(row);

      if (trade.status === UserTradeStatus.COMPLETED) {
        return {
          status: 200,
          message: "Reward already paid.",
        };
      }

      if (
        trade.status !== UserTradeStatus.READY &&
        trade.status !== UserTradeStatus.READY_TO_CLAIM
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Shipment has not returned home yet.",
        });
      }

      const completedAt = new Date();

      await db.$transaction(async (tx) => {
        const completed = await completeTradeReward(
          tx,
          session.user.id,
          trade,
          completedAt,
        );

        if (completed) {
          await tx.user.update({
            where: {
              id: session.user.id,
            },
            data: {
              experiencePoints: {
                increment: Math.max(1, Math.floor(trade.rewardAmount / 20)),
              },
            },
          });
        }
      });

      return {
        status: 200,
        message: "Trade reward claimed.",
      };
    }),

  claimReadyTrades: protectedProcedure.mutation(async ({ ctx }) => {
    const { db, session } = ctx;
    await ensurePlayerState(db, session.user.id);
    await syncTradeStatuses(db, session.user.id);

    return {
      status: 200,
      message: "Returned route rewards are paid automatically.",
    };
  }),

  abandonTrade: protectedProcedure
    .input(z.object({ tradeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      await ensurePlayerState(db, session.user.id);
      await syncTradeStatuses(db, session.user.id);

      const row = await db.userTrade.findFirst({
        where: {
          id: input.tradeId,
          userId: session.user.id,
        },
        include: tradeWithMaterialsInclude,
      });

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trade not found.",
        });
      }

      const trade = mapTradeRow(row);

      if (trade.status === UserTradeStatus.IN_ROUTE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Launched routes cannot be abandoned.",
        });
      }

      if (trade.status === UserTradeStatus.STOPPED) {
        const now = new Date();

        await db.userTrade.updateMany({
          where: {
            id: trade.id,
            userId: session.user.id,
            status: UserTradeStatus.STOPPED,
          },
          data: {
            status: UserTradeStatus.COMPLETED,
            completedAt: trade.completedAt ?? now,
            updatedAt: now,
          },
        });

        return {
          status: 200,
          message:
            "Paused route cleared. The launch pad is open for a new job.",
        };
      }

      if (
        trade.status !== UserTradeStatus.LOADING &&
        trade.status !== UserTradeStatus.READY_TO_LAUNCH
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only unlaunched routes can be dropped.",
        });
      }

      const now = new Date();

      await db.$transaction(async (tx) => {
        await expireAndRefundPreLaunchTrade(tx, session.user.id, trade, now);
      });

      return {
        status: 200,
        message: "Route dropped and reserved cargo returned.",
      };
    }),
});
