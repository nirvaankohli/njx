import { Link } from "react-router-dom";
import { ArrowRight, CircleCheckBig, Eye, FileSignature, Lock, ShieldCheck, Sparkles } from "lucide-react";

import heroBackdropAsset from "@/assets/docshield-hero-bg-v2.jpg";
import { DocShieldBrand } from "@/components/DocShieldBrand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const proofPills = [
  {
    icon: FileSignature,
    label: "Signed manifests",
    tone: "border-primary/15 bg-primary/10 text-primary",
  },
  {
    icon: ShieldCheck,
    label: "Policy checks",
    tone: "border-foreground/10 bg-card/80 text-foreground",
  },
  {
    icon: Lock,
    label: "Audit exports",
    tone: "border-success/20 bg-success/10 text-success",
  },
];

const documentRows = [
  {
    label: "Manifest hash",
    value: "sha256:9f2c...1a7d",
  },
  {
    label: "Policy",
    value: "No external AI, secure link required",
  },
  {
    label: "Latest event",
    value: "Issued 8 minutes ago",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Create the tenant",
    body: "Register org details, policy templates, and the local signing key once.",
  },
  {
    step: "02",
    title: "Sign the document",
    body: "Issue the manifest and the initial history event so the chain starts clean.",
  },
  {
    step: "03",
    title: "Verify and export",
    body: "Recheck integrity, review access signals, and open the audit bundle.",
  },
];

export function HeroSectionNote() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/70 bg-background pt-20 md:pt-24">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(88,92,255,0.10),transparent_26%),radial-gradient(circle_at_85%_18%,rgba(32,196,167,0.08),transparent_24%),radial-gradient(circle_at_52%_86%,rgba(15,23,42,0.06),transparent_28%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.08) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-12 px-6 pb-16 md:grid-cols-[1.04fr_0.96fr] md:items-center md:pb-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[11px] font-medium tracking-[0.18em] text-muted-foreground shadow-sm backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            HERO SECTION ONE
          </div>

          <div className="mt-6 flex items-start gap-3">
            <DocShieldBrand variant="icon" logoClassName="h-10 w-10" />
            <div className="pt-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">DocShield landing</p>
              <p className="mt-1 text-sm text-foreground/80">Signed documents, live in dev</p>
            </div>
          </div>

          <h1 className="mt-10 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            The first page for signed documents, live telemetry, and clean proof.
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            DocShield keeps the homepage focused on the one thing that matters, can the team prove a document is
            signed, verified, and ready to share?
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-12 px-5">
              <Link to="/app">
                Open the console
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 px-5 border-border/70 bg-background/60 backdrop-blur-sm"
            >
              <a href="#workflow">See the workflow</a>
            </Button>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {proofPills.map((pill) => (
              <div
                key={pill.label}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm backdrop-blur-sm",
                  pill.tone,
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/10 bg-background/70">
                  <pill.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Proof point</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{pill.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-2xl shadow-black/15">
            <img
              src={heroBackdropAsset}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-background/20 via-background/70 to-background/95" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(88,92,255,0.18),transparent_34%)]" />

            <div className="relative p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Signed document overview
                  </p>
                  <h2 className="mt-2 max-w-sm text-lg font-medium text-foreground">
                    The story stays visible from first upload to final export.
                  </h2>
                </div>
                <Badge className="border border-success/20 bg-success/10 text-success">Verified</Badge>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="rounded-2xl border border-border/70 bg-background/75 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    Current proof
                  </div>
                  <div className="mt-4 space-y-3">
                    {documentRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/70 px-4 py-3"
                      >
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            {row.label}
                          </div>
                          <div className="mt-1 text-sm font-medium text-foreground">{row.value}</div>
                        </div>
                        <CircleCheckBig className="h-4 w-4 text-primary" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/75 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span>Workflow</span>
                    <span>3 steps</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {workflowSteps.map((step, index) => (
                      <div key={step.step} className="flex gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-[11px] font-semibold text-foreground">
                          {step.step}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-medium text-foreground">{step.title}</h3>
                            {index === 0 && (
                              <Badge variant="secondary" className="h-6 rounded-full px-2 text-[10px]">
                                Live
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
