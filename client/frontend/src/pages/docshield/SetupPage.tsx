import { useState } from "react";
import { api } from "@/lib/docshield-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function SetupPage() {
  const [tenantId, setTenantId] = useState("tenant_acme");
  const [tenantName, setTenantName] = useState("Acme Inc.");
  const [domains, setDomains] = useState("acme.com, acme.io");
  const [templates, setTemplates] = useState(`[
  {
    "name": "Default - no external AI",
    "policy": {
      "external_ai_upload": "blocked",
      "secure_link_required": true,
      "forwarding": "blocked",
      "public_sharing": "blocked"
    }
  }
]`);
  const [keys, setKeys] = useState(`[
  {
    "key_id": "key_supplierco_01",
    "algorithm": "ed25519",
    "public_key": "MCowBQYDK2VwAyEA…"
  }
]`);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        tenant_id: tenantId,
        tenant_name: tenantName,
        domains: domains.split(",").map((s) => s.trim()).filter(Boolean),
        policy_templates: JSON.parse(templates),
        public_keys: JSON.parse(keys),
      };
      await api.setup(payload);
      toast.success("Tenant configured");
    } catch (err) {
      toast.error("Setup failed", { description: err instanceof Error ? err.message : "POST /setup not reachable" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tenant setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Register tenant config, policy templates, and issuer public keys via <code>POST /setup</code>.
        </p>
      </header>

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tenant ID</Label>
            <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Tenant name</Label>
            <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Domains (comma separated)</Label>
          <Input value={domains} onChange={(e) => setDomains(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Policy templates (JSON)</Label>
          <Textarea value={templates} onChange={(e) => setTemplates(e.target.value)} rows={8} className="font-mono text-xs" />
        </div>
        <div className="space-y-2">
          <Label>Public keys (JSON)</Label>
          <Textarea value={keys} onChange={(e) => setKeys(e.target.value)} rows={7} className="font-mono text-xs" />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit setup"}</Button>
        </div>
      </form>
    </div>
  );
}
