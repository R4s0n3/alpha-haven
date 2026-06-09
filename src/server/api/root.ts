import { userRouter } from "@/server/api/routers/user";
import { buildingRouter } from "@/server/api/routers/building";
import { fleetRouter } from "@/server/api/routers/fleet";
import { questRouter } from "@/server/api/routers/quest";
import { shopRouter } from "@/server/api/routers/shop";
import { createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  user: userRouter,
  building: buildingRouter,
  fleet: fleetRouter,
  quest: questRouter,
  shop: shopRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
