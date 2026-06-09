export const UserTradeKind = {
  BUY: "BUY",
  SELL: "SELL",
} as const;

export type UserTradeKind = (typeof UserTradeKind)[keyof typeof UserTradeKind];

export const UserTradeStatus = {
  LOADING: "LOADING",
  READY_TO_LAUNCH: "READY_TO_LAUNCH",
  IN_ROUTE: "IN_ROUTE",
  LANDING: "LANDING",
  READY: "READY",
  READY_TO_CLAIM: "READY_TO_CLAIM",
  STOPPED: "STOPPED",
  COMPLETED: "COMPLETED",
  EXPIRED: "EXPIRED",
  ACCEPTED: "ACCEPTED",
  IN_FLIGHT: "IN_FLIGHT",
} as const;

export type UserTradeStatus =
  (typeof UserTradeStatus)[keyof typeof UserTradeStatus];

export const StripePurchaseStatus = {
  OPEN: "OPEN",
  COMPLETED: "COMPLETED",
} as const;

export type StripePurchaseStatus =
  (typeof StripePurchaseStatus)[keyof typeof StripePurchaseStatus];
