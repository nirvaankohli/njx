import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Code2 } from "lucide-react";

const sections = [
  {
    title: "Base URL",
    description: "The frontend talks to the backend at a configurable base path.",
    snippet: `const BASE = (import.meta.env.VITE_DOCSHIELD_API_BASE) ?? "/api";`,
  },
  {
    title: "Tenant setup",
    method: "POST",
    path: "/api/setup",
    description: "Create a tenant, register its domains, policy templates, and public signing keys.",
    body: `{
  "tenant_id": "tenant_acme",
  "tenant_name": "Acme Corp",
  "domains": ["acme.example"],
  "policy_templates": [
    {
      "name": "strict",
      "policy": {
        "external_ai_upload": "blocked",
        "secure_link_required": true,
        "forwarding": "blocked",
        "public_sharing": "blocked"
      }
    }
  ],
  "public_keys": [
    { "key_id": "key_1", "algorithm": "ed25519", "public_key": "..." }
  ]
}`,
    response: `{ "ok": true, "tenant_id": "tenant_acme" }`,
  },
  {
    title: "Register document",
    method: "POST",
    path: "/api/documents",
    description: "Publish a document manifest with its policy and AI-sharing tags.",
    body: `{
  "document_id": "doc_7f92ab31",
  "tenant_id": "tenant_acme",
  "content_fingerprint": "sha256:4b9a…e21f",
  "policy": { ... },
  "embedded_ai_tags": ["NO_EXTERNAL_AI", "SECURE_LINK_ONLY"],
  "signer_refs": ["key_1"]
}`,
    response: `{ "document_id": "doc_7f92ab31", "status": "active", ... }`,
  },
  {
    title: "Append history event",
    method: "POST",
    path: "/api/documents/:id/events",
    description: "Add a signed event to a document's immutable chain.",
    body: `{
  "action": "sent",
  "actor_org": "SupplierCo",
  "actor_key_id": "key_1",
  "timestamp": "2026-06-18T14:35:00Z",
  "previous_event_hash": "sha256:aa11…",
  "signature": "ed25519:1c2d…"
}`,
    response: `{ "event_id": "evt_002", ... }`,
  },
  {
    title: "Verify document",
    method: "POST",
    path: "/api/verify",
    description: "Check whether a document is authentic, tampered, or revoked.",
    body: `{
  "document_id": "doc_7f92ab31",
  "content_fingerprint": "sha256:4b9a…e21f"
}`,
    response: `{
  "document_id": "doc_7f92ab31",
  "authentic": true,
  "tampered": false,
  "revoked": false,
  "policy": { ... },
  "embedded_ai_tags": ["NO_EXTERNAL_AI", "SECURE_LINK_ONLY"],
  "reason_codes": ["signature_valid", "manifest_intact"]
}`,
  },
  {
    title: "Log access event",
    method: "POST",
    path: "/api/access-events",
    description: "Record a secure-link access event for analytics and risk signals.",
    body: `{
  "document_id": "doc_7f92ab31",
  "link_id": "lnk_alpha",
  "timestamp": "2026-06-19T11:02:00Z",
  "ip_hash": "h:8a3…",
  "user_agent_hash": "h:e22…",
  "country": "US",
  "action": "opened"
}`,
    response: `{ "event_id": "ae_01", ... }`,
  },
  {
    title: "Dashboard",
    method: "GET",
    path: "/api/dashboard",
    description: "Aggregated stats, recent events, risk signals, and geography.",
    body: null,
    response: `{
  "totals": { "documents": 2, "access_events": 4, "risk_signals": 2 },
  "anomaly_score": 37,
  "recent_events": [...],
  "risk_signals": [...],
  "geography": [{ "country": "US", "count": 2 }, ...]
}`,
  },
  {
    title: "Export audit log",
    method: "GET",
    path: "/api/audit-export",
    description: "Request a signed export of the tenant's audit trail.",
    body: null,
    response: `{ "url": "https://storage.../audit-export.zip?token=..." }`,
  },
];

const methodColor: Record<string, string> = {
  GET: "bg-green-500/10 text-green-500 border-green-500/20",
  POST: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

export default function ReferencePage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Code2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API reference</h1>
          <p className="text-sm text-muted-foreground">
            How the DocShield frontend integrates with the backend endpoints.
          </p>
        </div>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Quick integration guide</CardTitle>
          <CardDescription>
            The frontend calls these endpoints through the client in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">src/lib/docshield-api.ts</code>.
            Set{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_DOCSHIELD_API_BASE</code>{" "}
            to point at your deployed backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="rounded-md bg-muted p-3 font-mono text-xs overflow-x-auto">
            {sections[0].snippet}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid gap-6">
        {sections.slice(1).map((s) => (
          <Card key={s.path} className="border-border/60">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`font-mono text-xs ${methodColor[s.method]}`}
                >
                  {s.method}
                </Badge>
                <code className="font-mono text-sm text-foreground">{s.path}</code>
              </div>
              <CardTitle className="text-base pt-1">{s.title}</CardTitle>
              <CardDescription>{s.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {s.body && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Request body
                  </p>
                  <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre">
                    {s.body}
                  </pre>
                </div>
              )}
              <div className={`space-y-2 ${!s.body ? "md:col-span-2" : ""}`}>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Response
                </p>
                <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre">
                  {s.response}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
