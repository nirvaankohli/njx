import { useState } from "react";
import { AlertCircle, Activity, Loader2 } from "lucide-react";
import { api, type AccessEvent } from "@/lib/docshield-api";
import { getDocShieldSession } from "@/lib/docshield-session";
import { mockAccessEvents } from "@/lib/docshield-mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

const ACTIONS: AccessEvent["action"][] = ["open", "download", "token_failed", "verify_attempt", "ai_upload_blocked"];

export default function AccessEventsPage() {
  const session = getDocShieldSession();
  const [events, setEvents] = useState<AccessEvent[]>(
    mockAccessEvents.map((event) => ({
      ...event,
      tenant_id: session.tenantId,
      action: event.action as AccessEvent["action"],
      result: event.result,
      reason: event.reason,
    })),
  );
  const [documentId, setDocumentId] = useState(session.activeDocument?.documentId ?? "");
  const [linkId, setLinkId] = useState("");
  const [country, setCountry] = useState("US");
  const [action, setAction] = useState<AccessEvent["action"]>("open");
  const [result, setResult] = useState<AccessEvent["result"]>("allowed");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ev: AccessEvent = {
      event_id: `acc_${Math.random().toString(16).slice(2, 8)}`,
      tenant_id: session.tenantId,
      document_id: documentId,
      link_id: linkId || null,
      timestamp: new Date().toISOString(),
      action,
      ip_hash: `sha256:ip-${Math.random().toString(16).slice(2, 6)}`,
      user_agent_hash: `sha256:ua-${Math.random().toString(16).slice(2, 6)}`,
      country,
      result,
      reason: reason || null,
    };

    try {
      const response = await api.logAccessEvent(ev);
      setEvents((current) => [ev, ...current]);
      toast.success("Access event logged", { description: `Backend accepted ${response.event_id}.` });
    } catch (err) {
      setEvents((current) => [ev, ...current]);
      toast.message("Saved locally", { description: err instanceof Error ? err.message : "POST /access-events not reachable." });
    } finally {
      setBusy(false);
      setDocumentId("");
      setLinkId("");
      setReason("");
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary" className="gap-1">
          <Activity className="h-3.5 w-3.5" />
          Telemetry
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Access events</h1>
        <p className="text-sm text-muted-foreground">
          Log open, download, and failure events against the active organization so the dashboard and audit export have data.
        </p>
      </header>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Use the current organization ID</AlertTitle>
        <AlertDescription>
          The backend expects an organization and document identifier. This page reuses the current session by default.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Log an event</CardTitle>
            <CardDescription>POSTs the same shape the FastAPI service validates.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Document ID</Label>
                <Input value={documentId} onChange={(e) => setDocumentId(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Link ID</Label>
                <Input value={linkId} onChange={(e) => setLinkId(e.target.value)} placeholder="link_buyerco_001" />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={action} onValueChange={(value) => setAction(value as AccessEvent["action"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Result</Label>
                <Select value={result} onValueChange={(value) => setResult(value as AccessEvent["result"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowed">allowed</SelectItem>
                    <SelectItem value="blocked">blocked</SelectItem>
                    <SelectItem value="failed">failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Reason (optional)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="download_spike" />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={busy || !documentId}>
                  {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Log event
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent events</CardTitle>
            <CardDescription>Locally mirrored entries from the submission flow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.map((event) => (
              <div key={event.event_id} className="rounded-xl border border-border bg-background/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{event.document_id}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{event.link_id ?? "No link ID"}</div>
                  </div>
                  <Badge variant={event.result === "blocked" || event.result === "failed" ? "destructive" : "secondary"}>
                    {event.action}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Tenant: {event.tenant_id}</span>
                  <span>Country: {event.country ?? "unknown"}</span>
                  <span>Result: {event.result ?? "allowed"}</span>
                  <span>Time: {new Date(event.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
