import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { api } from "@/utils/api";
import { Suspense } from "react";
import "@/styles/globals.css";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackgroundSound from "@/components/BackgroundSound";

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <Suspense fallback={<LoadingSpinner />}>
        <Component {...pageProps} />
      </Suspense>
      <BackgroundSound />
      <div id="dialogue-hook"></div>
      <div id="modal-hook"></div>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
