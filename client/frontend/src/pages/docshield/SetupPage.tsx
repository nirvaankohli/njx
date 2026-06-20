import { useEffect, useState } from "react";
import { AlertCircle, BadgeCheck, KeyRound, Loader2 } from "lucide-react";
import { api } from "@/lib/docshield-api";
import { ensureDevSigningIdentity } from "@/lib/docshield-signing";
import { getDocShieldSession, updateDocShieldSession } from "@/lib/docshield-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function SetupPage() {
  const session = getDocShieldSession();
  const [tenantId, setTenantId] = useState(session.tenantId);
  const [tenantName, setTenantName] = useState(session.tenantName);
  const [domains, setDomains] = useState(session.domains.join(", "));
  const [adminEmails, setAdminEmails] = useState(session.adminEmails.join(", "));
  const [policyTemplates, setPolicyTemplates] = useState(`[
  {
    "policy_id": "no_external_ai",
    "name": "No External AI",
    "policy": {
      "external_ai_upload": "blocked",
      "secure_link_required": true,
      "forwarding": "blocked",
      "public_sharing": "blocked"
    }
  }
]`);
  const [publicKeyId, setPublicKeyId] = useState(session.issuerKeyId);
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "ready" | "saved">("idle");

  useEffect(() => {
    ensureDevSigningIdentity()
      .then(({ keyId, publicKeyB64 }) => {
        setPublicKeyId(keyId);
        setPublicKey(publicKeyB64);
        updateDocShieldSession({ issuerKeyId: keyId });
        setStatus("ready");
      })
      .catch((err) => {
        toast.error("Could not create signing key", {
          description: err instanceof Error ? err.message : "Ed25519 is not available in this browser.",
        });
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        tenant: {
          tenant_id: tenantId,
          org_name: tenantName,
          domains: domains.split(",").map((value) => value.trim()).filter(Boolean),
          admin_emails: adminEmails.split(",").map((value) => value.trim()).filter(Boolean),
          status: "active" as const,
        },
        policy_templates: JSON.parse(policyTemplates),
        public_keys: [
          {
            key_id: publicKeyId,
            algorithm: "Ed25519" as const,
            public_key_b64: publicKey,
            status: "active" as const,
          },
        ],
      };

      const response = await api.setup(payload);
      updateDocShieldSession({
        tenantId,
        tenantName,
        adminEmails: adminEmails.split(",").map((value) => value.trim()).filter(Boolean),
        domains: domains.split(",").map((value) => value.trim()).filter(Boolean),
        issuerKeyId: publicKeyId,
      });
      setStatus("saved");
      toast.success("Tenant configured", { description: `${response.registered_policy_templates} policy template(s) and ${response.registered_public_keys} public key(s) saved.` });
    } catch (err) {
      toast.error("Setup failed", { description: err instanceof Error ? err.message : "POST /setup not reachable" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <BadgeCheck className="h-3.5 w-3.5" />
            Dev setup
          </Badge>
          <Badge variant="outline" className="gap-1">
            <KeyRound className="h-3.5 w-3.5" />
            Local Ed25519 keypair
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization setup</h1>
        <p className="text-sm text-muted-foreground">
          Add your organization once, include the employee emails you want to recognize, and keep the document rules
          in one place.
        </p>
      </header>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Signing stays local in dev</AlertTitle>
        <AlertDescription>
          This page generates a local Ed25519 keypair, stores the private key in your browser, and uses the public key
          for <Badge variant="outline" className="mx-1 font-mono text-[10px]">POST /setup</Badge>. The document and
          verify flows reuse the same keypair.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Organization details</CardTitle>
            <CardDescription>
              Use the names and employee emails your team actually knows. Document permissions come from the policy
              templates below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tenant ID</Label>
                  <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Organization name</Label>
                  <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Domains</Label>
                  <Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="acme.com, acme.io" />
                </div>
                <div className="space-y-2">
                  <Label>Employee emails</Label>
                  <Input
                    value={adminEmails}
                    onChange={(e) => setAdminEmails(e.target.value)}
                    placeholder="alice@acme.com, bob@acme.com"
                  />
                  <p className="text-xs text-muted-foreground">Separate multiple emails with commas.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Policy templates JSON</Label>
                <Textarea
                  value={policyTemplates}
                  onChange={(e) => setPolicyTemplates(e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Issuer key ID</Label>
                  <Input value={publicKeyId} onChange={(e) => setPublicKeyId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Public key</Label>
                  <Input value={publicKey} readOnly className="font-mono text-xs" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  The dev keypair is persisted locally so the next document registration can sign successfully.
                </p>
                <Button type="submit" disabled={busy || !publicKey}>
                  {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Save organization
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current organization</CardTitle>
            <CardDescription>What the rest of the DocShield flow will reuse.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tenant</div>
              <div className="mt-1 text-sm font-medium">{tenantName}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Employee emails</div>
              <div className="mt-1 text-sm text-muted-foreground">{adminEmails}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Dev key ID</div>
              <div className="mt-1 text-sm font-mono">{publicKeyId}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</div>
              <div className="mt-2 inline-flex items-center gap-2">
                <Badge variant={status === "saved" ? "default" : "secondary"}>
                  {status === "saved" ? "Saved" : status === "ready" ? "Ready" : "Idle"}
                </Badge>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Once this is saved, the document upload and verify pages will use the same organization and keypair.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
