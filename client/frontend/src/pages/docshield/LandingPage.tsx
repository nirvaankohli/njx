import { Link } from "react-router-dom";
import { ShieldCheck, FileSignature, Eye, Lock, Moon, Sun, CircleCheckBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { DocShieldBrand } from "@/components/DocShieldBrand";
import { HeroSectionNote } from "@/components/blocks/hero-section-note";

const features = [
  {
    icon: FileSignature,
    title: "Signed manifests",
    body: "Register a manifest, issue an initial history event, and keep the chain verifiable from day one.",
  },
  {
    icon: ShieldCheck,
    title: "Policy-aware verification",
    body: "Check fingerprint integrity, manifest signatures, and policy decisions in one screen.",
  },
  {
    icon: Eye,
    title: "Access telemetry",
    body: "Track open, download, and failure events so risk signals show up before they become incidents.",
  },
  {
    icon: Lock,
    title: "Audit exports",
    body: "Pull manifest, history, telemetry, and verification summaries into one exportable package.",
  },
];

const motions = {
  hidden: { opacity: 0, y: 22 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      delay: index * 0.08,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

export default function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-start">
            <DocShieldBrand
              showTagline
              className="items-start"
              variant="wordmark"
              logoClassName="h-10 w-[196px]"
              taglineClassName="text-[11px] text-muted-foreground"
            />
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#workflow" className="transition-colors hover:text-foreground">Workflow</a>
            <a href="#reference" className="transition-colors hover:text-foreground">API</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-full border border-border/70 bg-background/60 text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button asChild variant="outline" className="border-border/70 bg-background/60 backdrop-blur-sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <HeroSectionNote />

        <section id="features" className="border-t border-border/70 bg-background">
          <div className="mx-auto max-w-7xl px-6 py-20 md:py-24">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Features</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Built for a small team shipping a real backend, not a fake demo shell.
              </h2>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  custom={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={motions}
                >
                  <Card className="h-full border-border/70 bg-card/70">
                    <CardHeader>
                      <feature.icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-6 text-muted-foreground">{feature.body}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-t border-border/70 bg-secondary/20">
          <div className="mx-auto max-w-7xl px-6 py-20 md:py-24">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="max-w-xl">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Workflow</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  The path from setup to audit export is now a straight line.
                </h2>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  Setup creates the tenant and dev signing key, registration stores the signed manifest, verify reuses
                  the latest active document, and export opens the full audit package with query-safe tenant context.
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  {
                    step: "01",
                    title: "Create the tenant",
                    body: "Use the setup page to register org details, policies, and public keys, then persist them locally.",
                  },
                  {
                    step: "02",
                    title: "Register a signed document",
                    body: "Build a manifest, issue an initial history event, and save the returned manifest hash and history tip.",
                  },
                  {
                    step: "03",
                    title: "Verify and monitor",
                    body: "Submit the stored manifest and history to the backend, log telemetry, and open the export when needed.",
                  },
                ].map((item) => (
                  <Card key={item.step} className="border-border/70 bg-card/80">
                    <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold">
                        {item.step}
                      </div>
                      <div>
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        <CardDescription className="mt-1 text-sm leading-6 text-muted-foreground">
                          {item.body}
                        </CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="reference" className="border-t border-border/70 bg-background">
          <div className="mx-auto max-w-7xl px-6 py-20 md:py-24">
            <div className="flex flex-col gap-6 rounded-3xl border border-border bg-card px-6 py-8 md:flex-row md:items-center md:justify-between md:px-8">
              <div className="max-w-2xl">
                <p className="text-xs font-medium tracking-[0.22em] text-muted-foreground">Api</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                  The frontend now matches the FastApi data models and dev proxy.
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Query params, request bodies, and signed payloads line up with the backend, so local development
                  behaves like the real app instead of silently falling back to mocks.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to="/app/reference">Open reference</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Get started</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheckBig className="h-4 w-4 text-primary" />
            DocShield, ready for local dev and the MVP backend.
          </div>
          <div className="text-sm text-muted-foreground">
            Built with shadcn/ui and a Grainient-style hero background.
          </div>
        </div>
      </footer>
    </div>
  );
}
