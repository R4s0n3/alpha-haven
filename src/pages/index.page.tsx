import { signIn, signOut, useSession } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";
import DynamicBackground from "@/components/Background/DynamicBackground";

export default function Home() {
  return (
    <>
      <Head>
        <title>Space Haven | Alpha Haven</title>
        <meta
          name="description"
          content="Build Alpha Haven, run launch pads, trade routes, and upgrade a growing space fleet."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="scroll-container relative flex h-full min-h-screen w-full flex-col items-center justify-center overflow-hidden overflow-y-hidden">
        <div className="z-10 flex flex-col items-center justify-center rounded-md bg-slate-900/80 p-5 px-8">
          <h2 className="my-4 text-5xl font-black text-white">Space Haven</h2>
          <AuthShowcase />
        </div>

        <DynamicBackground seed="Home" />
      </main>
    </>
  );
}

function AuthShowcase() {
  const { data: sessionData } = useSession();

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl text-rose-800">
        {sessionData && <span>Logged in as {sessionData.user?.name}</span>}
      </p>
      <div className="flex gap-2">
        {sessionData && (
          <Link
            href="/game/port"
            className="flex items-center justify-center rounded-full bg-teal-600/80 px-10 py-3 font-semibold text-white no-underline transition hover:bg-white/20"
          >
            Play
          </Link>
        )}
        <button
          className="rounded-full bg-rose-600/80 px-10 py-3 font-semibold text-white no-underline transition hover:bg-white/20"
          onClick={sessionData ? () => void signOut() : () => void signIn()}
        >
          {sessionData ? "Sign out" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
