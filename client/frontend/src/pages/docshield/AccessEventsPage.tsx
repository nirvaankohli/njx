import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Activity, ArrowRight, Clock3, Filter, Loader2, MapPinned, Search, ShieldAlert, X } from "lucide-react";
import { api, type AccessEvent, type AccessEventFeedItem, type AccessEventsFeedResponse } from "@/lib/docshield-api";
import { getDocShieldSession } from "@/lib/docshield-session";
import { mockAccessEventsFeed } from "@/lib/docshield-mock";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const ACTIONS: AccessEvent["action"][] = ["open", "download", "token_failed", "verify_attempt", "ai_upload_blocked"];
const LIMIT = 40;

type FeedFilter = "all" | "suspicious" | "high";

const FILTERS: { id: FeedFilter; label: string; description: string }[] = [
  { id: "all", label: "All events", description: "The full tenant stream" },
  { id: "suspicious", label: "Suspicious", description: "Score 50 and above" },
  { id: "high", label: "High severity", description: "Score 80 and above" },
];

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function currentBrowser(): string {
  const userAgent = navigator.userAgent;
  const matchers: [RegExp, string][] = [
    [/(?:Edg|EdgiOS|EdgA)\/([\d.]+)/, "Edge"],
    [/(?:OPR|Opera)\/([\d.]+)/, "Opera"],
    [/(?:CriOS|Chrome)\/([\d.]+)/, "Chrome"],
    [/(?:FxiOS|Firefox)\/([\d.]+)/, "Firefox"],
    [/Version\/([\d.]+).+Safari\//, "Safari"],
  ];
  for (const [pattern, family] of matchers) {
    const match = userAgent.match(pattern);
    if (match) return `${family} ${match[1].split(".")[0]}`;
  }
  return "Unknown";
}

function severityFromScore(score: number): AccessEventFeedItem["severity"] {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function buildLocalFeedItem(event: AccessEvent): AccessEventFeedItem {
  const riskScore =
    event.result === "blocked" || event.result === "failed"
      ? 88
      : event.country && event.country !== "US"
        ? 61
        : event.action === "download"
          ? 34
          : 18;

  const riskReasons =
    riskScore >= 80 ? ["blocked_attempts", "new_geography"] : riskScore >= 50 ? ["new_geography"] : [];

  return {
    ...event,
    result: event.result ?? "allowed",
    risk_score: riskScore,
    risk_reasons: riskReasons,
    severity: severityFromScore(riskScore),
    suspicious: riskScore >= 50,
  };
}

function FeedItemRow({
  event,
  selected,
  onSelect,
}: {
  event: AccessEventFeedItem;
  selected: boolean;
  onSelect: (eventId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(event.event_id)}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition-colors",
        selected ? "border-ring bg-accent/40 shadow-sm" : "border-border/70 bg-card hover:bg-accent/30",
        event.suspicious && !selected && "border-red-500/25 bg-red-500/8 hover:bg-red-500/12",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="break-words font-medium [overflow-wrap:anywhere]">{event.document_id}</div>
            {event.suspicious && (
              <Badge variant="destructive" className="text-[10px] font-semibold tracking-[0.08em] uppercase">
                Suspicious
              </Badge>
            )}
          </div>
          <div className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {event.link_id ?? "No link ID"} · {formatTimestamp(event.timestamp)}
          </div>
        </div>
        <Badge
          variant={event.suspicious ? "destructive" : event.severity === "high" ? "default" : "outline"}
          className="shrink-0 text-[10px] font-semibold tracking-[0.08em] uppercase"
        >
          {event.severity}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary" className="text-[10px] font-medium tracking-[0.08em] uppercase">
          {event.action}
        </Badge>
        <Badge variant={event.result === "blocked" || event.result === "failed" ? "destructive" : "outline"} className="text-[10px] font-medium tracking-[0.08em] uppercase">
          {event.result}
        </Badge>
        <span className="text-muted-foreground">Country {event.country ?? "unknown"}</span>
        <span className="text-muted-foreground">IP {event.ip_address ?? "unknown"}</span>
        <span className="text-muted-foreground">Browser {event.browser ?? "unknown"}</span>
        <span className={cn("font-medium", event.suspicious ? "text-red-600 dark:text-red-300" : "text-muted-foreground")}>
          Score {event.risk_score}
        </span>
      </div>
    </button>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}

export default function AccessEventsPage() {
  const session = getDocShieldSession();
  const [feed, setFeed] = useState<AccessEventsFeedResponse | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState<FeedFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState(session.activeDocument?.documentId ?? mockAccessEventsFeed.events[0]?.document_id ?? "");
  const [linkId, setLinkId] = useState("");
  const [country, setCountry] = useState("US");
  const [action, setAction] = useState<AccessEvent["action"]>("open");
  const [result, setResult] = useState<AccessEvent["result"]>("allowed");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const reloadFeed = async () => {
    try {
      const response = await api.accessEventsFeed(session.tenantId, LIMIT);
      setFeed(response);
      setUsingMock(false);
      return response;
    } catch {
      setFeed(mockAccessEventsFeed);
      setUsingMock(true);
      return mockAccessEventsFeed;
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const response = await api.accessEventsFeed(session.tenantId, LIMIT);
        if (!alive) return;
        setFeed(response);
        setUsingMock(false);
      } catch {
        if (!alive) return;
        setFeed(mockAccessEventsFeed);
        setUsingMock(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [session.tenantId]);

  const visibleEvents = useMemo(() => {
    const events = feed?.events ?? [];
    const filteredByRisk = viewFilter === "suspicious"
      ? events.filter((event) => event.suspicious)
      : viewFilter === "high"
        ? events.filter((event) => event.severity === "high")
        : events;
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) return filteredByRisk;

    return filteredByRisk.filter((event) =>
      [
        event.document_id,
        event.event_id,
        event.link_id,
        event.action,
        event.result,
        event.country,
        event.browser,
        ...event.risk_reasons,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery)),
    );
  }, [feed, searchQuery, viewFilter]);

  const suspiciousEvents = useMemo(() => (feed?.events ?? []).filter((event) => event.suspicious), [feed]);
  const highSeverityEvents = useMemo(() => (feed?.events ?? []).filter((event) => event.severity === "high"), [feed]);

  useEffect(() => {
    if (!visibleEvents.length) {
      setSelectedEventId(null);
      return;
    }
    if (!selectedEventId || !visibleEvents.some((event) => event.event_id === selectedEventId)) {
      setSelectedEventId(visibleEvents[0].event_id);
    }
  }, [selectedEventId, visibleEvents]);

  const selectedEvent = useMemo(
    () => visibleEvents.find((event) => event.event_id === selectedEventId) ?? visibleEvents[0] ?? null,
    [selectedEventId, visibleEvents],
  );

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
      browser: currentBrowser(),
      country,
      result,
      reason: reason || null,
    };

    try {
      const response = await api.logAccessEvent(ev);
      const refreshed = await reloadFeed();
      setSelectedEventId(refreshed.events[0]?.event_id ?? null);
      toast.success("Access event logged", { description: `Backend accepted ${response.event_id}.` });
    } catch (err) {
      const nextEvent = buildLocalFeedItem(ev);
      setFeed((current) => {
        const currentFeed = current ?? mockAccessEventsFeed;
        return {
          ...currentFeed,
          total_events: currentFeed.total_events + 1,
          suspicious_events: currentFeed.suspicious_events + (nextEvent.suspicious ? 1 : 0),
          events: [nextEvent, ...currentFeed.events],
        };
      });
      setSelectedEventId(ev.event_id);
      toast.message("Saved locally", { description: err instanceof Error ? err.message : "Post /access-events not reachable." });
    } finally {
      setBusy(false);
      setDocumentId("");
      setLinkId("");
      setReason("");
    }
  }

  const totalEvents = feed?.total_events ?? 0;
  const suspiciousCount = feed?.suspicious_events ?? 0;
  const highCount = highSeverityEvents.length;

  if (loading || !feed) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading anomaly hub...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          Tenant anomaly stream
          {usingMock && (
            <Badge variant="outline" className="text-[10px] font-semibold tracking-[0.08em] uppercase">
              Sample feed
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Anomaly hub</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Tenant-wide access events, scored in real time. Suspicious activity is surfaced in red so the stream reads
              like a live security console instead of a raw log.
            </p>
          </div>
        </div>
      </header>

      {usingMock && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Showing sample anomaly data</AlertTitle>
          <AlertDescription>
            The backend feed was unreachable, so the hub is rendering local sample events. Once the API is available,
            the feed will switch to live scored access events automatically.
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Events seen",
            value: totalEvents,
            description: "Recent access events in the current tenant window",
          },
          {
            label: "Suspicious",
            value: suspiciousCount,
            description: "Events scoring at or above the red-flag threshold",
          },
          {
            label: "High severity",
            value: highCount,
            description: "Events with scores of 80 and above",
          },
        ].map((item, index) => (
          <Card key={item.label} className={cn(index === 1 && "border-red-500/20 bg-red-500/5")}>
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle className="mt-2 text-3xl">{item.value}</CardTitle>
                </div>
                {index === 0 ? (
                  <Clock3 className="h-5 w-5 text-muted-foreground" />
                ) : index === 1 ? (
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                ) : (
                  <MapPinned className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {FILTERS.map((filter) => (
                <Button
                  key={filter.id}
                  type="button"
                  size="sm"
                  variant={viewFilter === filter.id ? "default" : "outline"}
                  onClick={() => setViewFilter(filter.id)}
                  className="gap-2"
                  title={filter.description}
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            <div className="relative w-full sm:max-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search anomaly events"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Find document…"
                className="h-9 bg-background pl-9 pr-9"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Clear anomaly search"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <Card className="overflow-hidden border-border/60 shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60 bg-muted/20">
              <div>
                <CardTitle className="text-base">Recent events</CardTitle>
                <CardDescription>
                  {visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"} · newest first
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold tracking-[0.08em] uppercase">
                Live feed
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[min(68vh,720px)] min-h-[420px]">
                <div className="space-y-3 p-4 pr-5">
                  {visibleEvents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
                      <Search className="mx-auto mb-3 h-5 w-5" />
                      No events match the current filters.
                    </div>
                  ) : (
                    visibleEvents.map((event) => (
                      <FeedItemRow
                        key={event.event_id}
                        event={event}
                        selected={selectedEvent?.event_id === event.event_id}
                        onSelect={setSelectedEventId}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="order-2">
            <CardHeader>
              <CardTitle className="text-base">Suspicious rail</CardTitle>
              <CardDescription>Fast path to the events the model wants reviewed first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {suspiciousEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                  No suspicious events in the current window.
                </div>
              ) : (
                suspiciousEvents.slice(0, 5).map((event) => (
                  <button
                    type="button"
                    key={event.event_id}
                    onClick={() => setSelectedEventId(event.event_id)}
                    className={cn(
                      "w-full rounded-2xl border p-3 text-left transition-colors",
                      selectedEvent?.event_id === event.event_id ? "border-red-500/40 bg-red-500/10" : "border-red-500/20 bg-red-500/5 hover:bg-red-500/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{event.document_id}</div>
                      <Badge variant="destructive" className="text-[10px] font-semibold tracking-[0.08em] uppercase">
                        {event.risk_score}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {event.action} · {formatTimestamp(event.timestamp)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(event.risk_reasons.length ? event.risk_reasons : ["model_deviation"]).map((reasonCode) => (
                        <Badge key={reasonCode} variant="outline" className="text-[10px] font-medium tracking-[0.08em] uppercase">
                          {reasonCode}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="order-1 border-border/60 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Selected event</CardTitle>
              <CardDescription>Single-event detail panel with the score and reason trail.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedEvent ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-medium [overflow-wrap:anywhere]">{selectedEvent.document_id}</div>
                      <div className="mt-1 break-all text-xs text-muted-foreground">{selectedEvent.event_id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={selectedEvent.suspicious ? "destructive" : "outline"} className="text-[10px] font-semibold tracking-[0.08em] uppercase">
                        Score {selectedEvent.risk_score}
                      </Badge>
                      <Badge
                        variant={selectedEvent.severity === "high" ? "destructive" : selectedEvent.severity === "medium" ? "default" : "secondary"}
                        className="text-[10px] font-semibold tracking-[0.08em] uppercase"
                      >
                        {selectedEvent.severity}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailField label="Action" value={selectedEvent.action} />
                    <DetailField label="Result" value={selectedEvent.result ?? "allowed"} />
                    <DetailField label="Country" value={selectedEvent.country ?? "unknown"} />
                    <DetailField label="IP address" value={selectedEvent.ip_address ?? "unknown"} />
                    <DetailField label="Browser" value={selectedEvent.browser ?? "unknown"} />
                    <DetailField label="Timestamp" value={formatTimestamp(selectedEvent.timestamp)} />
                    <DetailField label="Document" value={selectedEvent.document_id} />
                    <DetailField label="Link ID" value={selectedEvent.link_id ?? "none"} />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Risk reasons</div>
                    <div className="flex flex-wrap gap-2">
                      {(selectedEvent.risk_reasons.length ? selectedEvent.risk_reasons : ["no_threshold_crossed"]).map((reasonCode) => (
                        <Badge key={reasonCode} variant={selectedEvent.suspicious ? "destructive" : "outline"} className="text-[10px] font-medium tracking-[0.08em] uppercase">
                          {reasonCode}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                    {selectedEvent.suspicious
                      ? "This event crossed the suspicious threshold, so it stays highlighted in red until another event displaces it."
                      : "This event stayed below the suspicious threshold. It still appears in the feed, but it does not get red treatment."}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/80 p-5 text-sm text-muted-foreground">
                  Pick an event from the feed to inspect its score, reasons, and context.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="order-3">
            <CardHeader>
              <CardTitle className="text-base">Simulate event</CardTitle>
              <CardDescription>Keep the demo utility for generating fresh scored events.</CardDescription>
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
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
