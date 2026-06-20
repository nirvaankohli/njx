import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { frontendApi } from "@/lib/frontend-api";
import { useToast } from "@/hooks/use-toast";

export default function OnboardingPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      await frontendApi.saveCompanySettings({
        company_name: name,
        company_website: website || null,
        industry: industry || null,
      });
      toast({ title: "Organization created" });
      navigate("/app", { replace: true });
    } catch (err: any) {
      toast({ title: "Could not create organization", description: err.message, variant: "destructive" });
      return;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[460px] border border-border rounded-md p-8 space-y-6">
        <div className="flex flex-col items-start gap-3">
          <div className="h-9 w-9 rounded-md border border-border flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">Create your organization</h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              Set up a workspace before you open the DocShield console.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[12px]">Organization name</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px]">Website (optional)</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px]">Industry (optional)</Label>
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Legal, Finance, Healthcare…"
              className="h-9 text-[13px]"
            />
          </div>
          <Button type="submit" className="w-full h-9 text-[13px]" disabled={submitting || !name}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Create organization
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          onClick={() => signOut().then(() => navigate("/auth"))}
          className="px-0 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
