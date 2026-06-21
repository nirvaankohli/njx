import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Shield,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { frontendApi, type FrontendCompanySettings } from "@/lib/frontend-api";
import { cn } from "@/lib/utils";

type PlanId = "free" | "tier-1" | "tier-2";

const PLAN_STORAGE_KEY = "docshield.mock-plan";

const plans: Array<{
  id: Exclude<PlanId, "free">;
  name: string;
  price: string;
  description: string;
  features: string[];
  featured?: boolean;
}> = [
  {
    id: "tier-1",
    name: "Tier 1",
    price: "$19",
    description: "Visible document protection for individuals and small teams.",
    features: ["Dynamic watermarking", "Protected document sharing", "Basic access history"],
  },
  {
    id: "tier-2",
    name: "Tier 2",
    price: "$49",
    description: "Proactive protection for teams managing sensitive documents.",
    features: ["Everything in Tier 1", "Anomaly detection", "Advanced access analytics"],
    featured: true,
  },
];

function getSavedPlan(): PlanId {
  const savedPlan = window.localStorage.getItem(PLAN_STORAGE_KEY);
  return savedPlan === "tier-1" || savedPlan === "tier-2" ? savedPlan : "free";
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<FrontendCompanySettings>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<PlanId>(getSavedPlan);
  const userId = user?.id;

  const loadCompany = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await frontendApi.companySettings();
      if (data && data.user_id === userId) setCompany(data);
      else setCompany(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Organization details could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadCompany();
  }, [loadCompany]);

  const handlePlanSelection = (planId: Exclude<PlanId, "free">) => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, planId);
    setCurrentPlan(planId);
    setIsPricingOpen(false);
    toast.success(`${plans.find((plan) => plan.id === planId)?.name} selected`, {
      description: "This is a pricing preview. No payment was collected.",
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const currentPlanName = currentPlan === "free" ? "Free" : plans.find((plan) => plan.id === currentPlan)?.name;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-primary">Workspace controls</p>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-muted-foreground">Manage your organization, plan, and account access.</p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 px-3 py-1">
          <Shield className="h-3.5 w-3.5 text-primary" />
          Protected workspace
        </Badge>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Organization details unavailable</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" className="w-fit gap-2" onClick={() => void loadCompany()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={isPricingOpen} onOpenChange={setIsPricingOpen}>
        <Card className="relative overflow-hidden border-primary/30 bg-primary/[0.04]">
          <div className="absolute right-0 top-0 h-40 w-40 translate-x-1/3 -translate-y-1/3 rounded-full bg-primary/15 blur-3xl" />
          <CardHeader className="relative gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary p-2.5 text-primary-foreground shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <CardTitle>Protection that grows with you</CardTitle>
                  <Badge>{currentPlanName}</Badge>
                </div>
                <CardDescription className="max-w-2xl text-sm">
                  Add watermarking now, then step up to anomaly detection when your document traffic needs active monitoring.
                </CardDescription>
              </div>
            </div>
            <DialogTrigger asChild>
              <Button className="shrink-0 gap-2">
                <CreditCard className="h-4 w-4" />
                {currentPlan === "free" ? "Explore pricing" : "Change plan"}
              </Button>
            </DialogTrigger>
          </CardHeader>
          <CardFooter className="relative border-t bg-background/50 py-3 text-xs text-muted-foreground">
            Pricing is a mock preview. Selecting a tier does not start a subscription or collect payment.
          </CardFooter>
        </Card>

        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Choose your protection level</DialogTitle>
            <DialogDescription>Compare tiers and select one to preview it on your workspace.</DialogDescription>
          </DialogHeader>
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Demo pricing</AlertTitle>
            <AlertDescription>No checkout will open and no payment information is required.</AlertDescription>
          </Alert>
          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              return (
                <Card key={plan.id} className={cn("flex flex-col", plan.featured && "border-primary shadow-sm")}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{plan.name}</CardTitle>
                      {plan.featured && <Badge variant="secondary">Recommended</Badge>}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">/ month</span>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    <Separator />
                    <ul className="space-y-2.5 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={plan.featured ? "default" : "outline"}
                      disabled={isCurrent}
                      onClick={() => handlePlanSelection(plan.id)}
                    >
                      {isCurrent ? "Current selection" : `Choose ${plan.name}`}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Organization</CardTitle>
              <CardDescription>Workspace identity and profile</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading organization details…
              </div>
            ) : (
              <>
                <SettingRow label="Name" value={company?.company_name} />
                <Separator />
                <SettingRow label="Industry" value={company?.industry} />
                <Separator />
                <SettingRow label="Website" value={company?.company_website} link />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Account</CardTitle>
              <CardDescription>Identity and session controls</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <SettingRow label="Signed in as" value={user?.email} />
            <Separator />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">End this session</p>
                <p className="text-muted-foreground">You’ll need to sign in again to access protected documents.</p>
              </div>
              <Button variant="outline" onClick={handleSignOut} className="w-fit shrink-0 gap-2">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingRow({ label, value, link = false }: { label: string; value?: string | null; link?: boolean }) {
  const normalizedLink = link && value ? (/^https?:\/\//i.test(value) ? value : `https://${value}`) : null;

  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      {normalizedLink ? (
        <a
          href={normalizedLink}
          target="_blank"
          rel="noreferrer"
          className="flex max-w-[65%] items-center gap-1 truncate font-medium hover:text-primary hover:underline"
        >
          <span className="truncate">{value}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        <span className="max-w-[65%] truncate text-right font-medium">{value || "Not provided"}</span>
      )}
    </div>
  );
}
