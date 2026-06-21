import { ArrowRight, BookOpen } from "lucide-react";

import heroScreenAsset from "@/assets/docshield-hero-bg-v2.jpg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeroSectionNote() {
  return (
    <section className="py-20">
      <div className="relative z-10 mx-auto w-full max-w-2xl px-6 lg:px-0">
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
