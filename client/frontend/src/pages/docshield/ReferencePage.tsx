import { Code2, Database, Fingerprint, ShieldCheck, Upload, Activity, Download, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { buildUrl } from "@/lib/docshield-api";

const endpoints = [
  {
    icon: Settings2,
    method: "POST",
    path: "/setup",
    title: "Organization setup",
    summary: "Registers the organization, employee emails, policy templates, and public keys.",
    details: ["tenant.org_name", "tenant.admin_emails", "public_keys[].public_key_b64"],
  },
  {
    icon: Database,
    method: "POST",
    path: "/documents",
    title: "Register document",
    summary: "Sends a signed manifest plus the initial signed history event.",
    details: ["signed_manifest.manifest", "signed_manifest.manifest_signature", "initial_history[]"],
  },
  {
    icon: Fingerprint,
    method: "POST",
    path: "/verify",
    title: "Verify document",
    summary: "Checks fingerprint integrity, manifest signatures, and policy decisions.",
    details: ["history[]", "computed_content_fingerprint", "usage_context.operation"],
  },
  {
    icon: Activity,
    method: "POST",
    path: "/access-events",
    title: "Log telemetry",
    summary: "Stores access events and triggers a risk recompute.",
    details: ["tenant_id", "document_id", "action", "result"],
  },
  {
    icon: Download,
    method: "GET",
    path: "/audit-export",
    title: "Export audit trail",
    summary: "Returns manifest, history, telemetry, revocation, and verification summary.",
    details: ["tenant_id", "document_id"],
  },
];

const methodTone: Record<string, string> = {
  POST: "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-200",
  GET: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-200",
};

export default function ReferencePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Badge variant="secondary" className="gap-1">
          <Code2 className="h-3.5 w-3.5" />
          API reference
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Backend contract</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          The frontend calls the FastAPI backend through a proxy-aware client. Set the base URL with{" "}
          <Badge variant="outline" className="mx-1 text-[10px] font-medium tracking-[0.08em]">
            VITE_DOCSHIELD_API_BASE
          </Badge>
          or rely on the default Vite proxy to `127.0.0.1:8000`.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base URL</CardTitle>
          <CardDescription>Current request builder and proxy target.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-medium tracking-[0.08em]">
            {buildUrl("/setup")}
          </Badge>
          <Button asChild variant="outline" size="sm">
            <a href="/api/docs" target="_blank" rel="noreferrer">
              Open backend docs
            </a>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid gap-4">
        {endpoints.map((endpoint) => (
          <Card key={endpoint.path}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className={`gap-1 text-[10px] font-medium tracking-[0.08em] ${methodTone[endpoint.method]}`}>
                  <endpoint.icon className="h-3.5 w-3.5" />
                  {endpoint.method}
                </Badge>
                <Badge variant="secondary" className="text-[10px] font-medium tracking-[0.08em]">
                  {endpoint.path}
                </Badge>
              </div>
              <CardTitle className="text-base">{endpoint.title}</CardTitle>
              <CardDescription>{endpoint.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Key fields</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {endpoint.details.map((detail) => (
                    <Badge key={detail} variant="outline" className="text-[10px] font-medium tracking-[0.08em]">
                      {detail}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="routing">
          <AccordionTrigger>Routing notes</AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The Vite dev server proxies <Badge variant="outline" className="mx-1 text-[10px] font-medium tracking-[0.08em]">/api</Badge>{" "}
              to the local FastAPI server and strips the prefix, so calls like <span className="font-medium">/api/setup</span>{" "}
              arrive at <span className="font-medium">/setup</span>.
            </p>
            <p>
              Dashboard and audit export require an organization ID, and audit export also needs a document ID. The UI
              persists those values after setup and document registration.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
