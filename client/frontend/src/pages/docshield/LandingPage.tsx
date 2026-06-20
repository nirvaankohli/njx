import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, FileSignature, Eye, Lock, Sparkles, Moon, Sun, CircleCheckBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { DocShieldBrand } from "@/components/DocShieldBrand";

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

function GrainientBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  const layers = useMemo(
    () => [
      {
        background:
          "radial-gradient(circle at 20% 22%, rgba(255,255,255,0.20), transparent 24%), radial-gradient(circle at 78% 30%, rgba(93, 76, 255, 0.28), transparent 22%), radial-gradient(circle at 44% 68%, rgba(0, 200, 155, 0.16), transparent 26%)",
        opacity: 0.95,
      },
      {
        background:
          "linear-gradient(112deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.0) 42%, rgba(255,255,255,0.09) 68%, rgba(255,255,255,0.0) 100%)",
        opacity: 0.8,
      },
      {
        background:
          "radial-gradient(circle at 45% 46%, rgba(255,255,255,0.08), rgba(255,255,255,0.03) 30%, transparent 70%)",
        opacity: 1,
      },
    ],
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050505]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(88, 92, 255, 0.22), transparent 34%), radial-gradient(circle at 80% 35%, rgba(32, 196, 167, 0.14), transparent 28%), radial-gradient(circle at 50% 85%, rgba(255,255,255,0.08), transparent 28%), linear-gradient(112deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.60) 38%, rgba(0,0,0,0.90) 100%)",
        }}
      />
      <motion.div
        aria-hidden
        className="absolute inset-[-8%] will-change-transform"
        animate={reducedMotion ? undefined : { scale: [1, 1.045, 1], rotate: [0, 4, 0] }}
        transition={reducedMotion ? undefined : { duration: 28, repeat: Infinity, ease: "linear" }}
      >
        {layers.map((layer, index) => (
          <motion.div
            key={index}
            className="absolute inset-0 mix-blend-screen"
            style={layer}
            animate={reducedMotion ? undefined : { x: [0, index % 2 === 0 ? 22 : -16, 0], y: [0, index === 1 ? -18 : 14, 0] }}
            transition={reducedMotion ? undefined : { duration: 18 + index * 2.5, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </motion.div>
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18] mix-blend-soft-light"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(255,255,255,0.05) 0.5px, transparent 0.5px)",
          backgroundSize: "3px 3px",
          mixBlendMode: "overlay",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
    </div>
  );
}

export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/50 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-start">
            <DocShieldBrand
              showTagline
              className="text-white"
              variant="wordmark"
              logoClassName="h-10 w-[196px]"
              taglineClassName="text-[11px] text-white/[0.55]"
            />
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-white/[0.65] md:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#workflow" className="transition-colors hover:text-white">Workflow</a>
            <a href="#reference" className="transition-colors hover:text-white">Api</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate min-h-screen overflow-hidden pt-16">
          <GrainientBackdrop reducedMotion={reducedMotion} />
          <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-6 py-16 md:grid-cols-[1.15fr_0.85fr] md:py-24">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={motions}
              custom={0}
              className="max-w-3xl"
            >
            <Badge className="mb-5 border border-white/15 bg-white/[0.08] px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-white/[0.85]">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                React Bits Grainient hero
              </Badge>
              <motion.h1
                variants={motions}
                custom={1}
                className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
              >
                Make every document feel signed, secure, and ready for the first dev demo.
              </motion.h1>
              <motion.p
                variants={motions}
                custom={2}
                className="mt-6 max-w-2xl text-pretty text-base leading-7 text-white/[0.72] sm:text-lg"
              >
                DocShield keeps manifests, histories, verification, telemetry, and exports in one MVP flow. The new
                hero background gives the landing page some atmosphere, while the backend contract stays honest.
              </motion.p>
              <motion.div variants={motions} custom={3} className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 px-5 bg-white text-black hover:bg-white/90">
                  <Link to="/app">
                    Open the console
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 px-5 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <a href="#workflow">See the workflow</a>
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={motions}
              custom={2}
              className="relative"
            >
              <Card className="border-white/10 bg-white/[0.06] text-white shadow-2xl shadow-black/30 backdrop-blur-2xl">
                <CardHeader>
                  <CardTitle className="text-lg text-white">MVP control plane</CardTitle>
                <CardDescription className="text-white/[0.65]">
                    Signed payloads, clean Api calls, and a working dev loop.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Organization setup", value: "Post /setup", tone: "bg-emerald-500/15 text-emerald-200" },
                    { label: "Document register", value: "Post /documents", tone: "bg-sky-500/15 text-sky-200" },
                    { label: "Verify", value: "Post /verify", tone: "bg-violet-500/15 text-violet-200" },
                    { label: "Telemetry", value: "Post /access-events", tone: "bg-amber-500/15 text-amber-100" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{item.label}</div>
                        <div className="text-xs text-white/[0.55]">Ready for local FastApi</div>
                      </div>
                      <Badge className={`border-0 ${item.tone}`}>{item.value}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

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
