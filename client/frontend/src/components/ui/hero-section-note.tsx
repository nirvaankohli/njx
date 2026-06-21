import { ArrowRight, BookOpen } from "lucide-react";

import heroScreenAsset from "@/assets/docshield-hero-bg-v2.jpg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeroSectionNote() {
  return (
    <section className="relative isolate min-h-screen w-full overflow-hidden py-20">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 min-h-screen overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] max-w-none -translate-x-1/2 rotate-[30deg] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            background: "linear-gradient(to top right, oklch(0.704 0.191 260.31), oklch(0.68 0.169 237.32))",
          }}
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 min-h-screen overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
      >
        <div
          className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] max-w-none -translate-x-1/2 opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            background: "linear-gradient(to top right, oklch(0.74 0.15 151.23), oklch(0.7 0.18 330.03))",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col justify-center px-6 lg:px-0">
        <div className="relative text-center">
          <MistKitLogo className="mx-auto" />
          <h1 className="mx-auto mt-16 max-w-xl text-balance text-5xl font-medium text-foreground">The Note App</h1>

          <p className="mx-auto mb-6 mt-4 text-balance text-xl text-muted-foreground">
            The Note App is a simple note app that allows you to create and manage your notes.
          </p>

          <div className="flex flex-col items-center gap-2 *:w-full sm:flex-row sm:justify-center sm:*:w-auto">
            <Button asChild>
              <a href="/auth">
                <span className="whitespace-nowrap">Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="ghost">
              <a href="/app">
                <span className="whitespace-nowrap">View Demo</span>
              </a>
            </Button>
          </div>
        </div>

        <div className="relative mt-12 overflow-hidden rounded-3xl bg-black/10 md:mt-16">
          <img
            src={heroScreenAsset}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="bg-background relative m-4 overflow-hidden rounded-[var(--radius)] border border-transparent shadow-xl shadow-black/15 ring-1 ring-black/10 sm:m-8 md:m-12">
            <img
              src="https://tailark.com/_next/image?url=%2Fmist%2Ftailark.png&w=3840&q=75"
              alt="app screen"
              width={2880}
              height={1842}
              className="h-full w-full object-cover object-top"
            />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <p className="text-center text-muted-foreground">Trusted by teams at :</p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <div className="flex">
              <img
                className="mx-auto h-4 w-fit"
                src="https://html.tailus.io/blocks/customers/nvidia.svg"
                alt="Nvidia Logo"
                height="20"
                width="auto"
              />
            </div>

            <div className="flex">
              <img
                className="mx-auto h-3 w-fit"
                src="https://html.tailus.io/blocks/customers/column.svg"
                alt="Column Logo"
                height="16"
                width="auto"
              />
            </div>
            <div className="flex">
              <img
                className="mx-auto h-3 w-fit"
                src="https://html.tailus.io/blocks/customers/github.svg"
                alt="GitHub Logo"
                height="16"
                width="auto"
              />
            </div>
            <div className="flex">
              <img
                className="mx-auto h-4 w-fit"
                src="https://html.tailus.io/blocks/customers/nike.svg"
                alt="Nike Logo"
                height="20"
                width="auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const MistKitLogo = ({ className }: { className?: string }) => (
  <div
    aria-hidden
    className={cn(
      "relative flex h-9 w-9 translate-y-0.5 items-center justify-center rounded-[var(--radius)] border border-background bg-gradient-to-b from-yellow-300 to-orange-600 shadow-lg shadow-black/20 ring-1 ring-black/10",
      className,
    )}
  >
    <BookOpen className="h-6 w-6 fill-white stroke-white drop-shadow-sm" />
    <BookOpen className="absolute inset-0 m-auto h-6 w-6 fill-white stroke-white opacity-65 drop-shadow-sm" />
    <div className="absolute inset-2 z-10 m-auto h-[1.125rem] w-px translate-y-px rounded-full bg-black/10" />
  </div>
);
