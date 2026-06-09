export const AUTO_ROUTE_UNLOCK_LEVEL = 25;
export const MAX_BUILDING_LEVEL = 100;
export const MAX_INPUT_PRODUCTION_SYNC_CYCLES = 240;
export const MAX_ROCKET_UPGRADE = 8;

export function getBuildingUpgradeCost(price: number, level: number) {
  const safeLevel = Math.max(1, level);

  return Math.ceil(price * (0.65 + Math.pow(safeLevel, 1.42) * 0.45));
}

export function getRocketUpgradeCost(price: number, upgrade: number) {
  const safeUpgrade = Math.max(1, upgrade);

  return Math.ceil(price * (0.4 + Math.pow(safeUpgrade, 1.36) * 0.3));
}
