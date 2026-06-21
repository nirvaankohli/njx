import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Activity, ArrowRight, Clock3, Filter, Loader2, MapPinned, ShieldAlert } from "lucide-react";
import { ComposableMap, Geographies, Geography, Graticule, Sphere } from "react-simple-maps";
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
import { toast } from "sonner";
import worldCountriesTopoJson from "world-atlas/countries-110m.json";

const ACTIONS: AccessEvent["action"][] = ["open", "download", "token_failed", "verify_attempt", "ai_upload_blocked"];
const LIMIT = 40;

type FeedFilter = "all" | "suspicious" | "high";

const FILTERS: { id: FeedFilter; label: string; description: string }[] = [
  { id: "all", label: "All events", description: "The full tenant stream" },
  { id: "suspicious", label: "Suspicious", description: "Score 50 and above" },
  { id: "high", label: "High severity", description: "Score 80 and above" },
];

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  canada: "CA",
  mexico: "MX",
  brazil: "BR",
  argentina: "AR",
  "united states": "US",
  "united states of america": "US",
  us: "US",
  uk: "GB",
  "united kingdom": "GB",
  "great britain": "GB",
  britain: "GB",
  ireland: "IE",
  france: "FR",
  germany: "DE",
  spain: "ES",
  italy: "IT",
  netherlands: "NL",
  sweden: "SE",
  norway: "NO",
  ukraine: "UA",
  russia: "RU",
  "russian federation": "RU",
  turkey: "TR",
  egypt: "EG",
  saudiarabia: "SA",
  "saudi arabia": "SA",
  india: "IN",
  pakistan: "PK",
  bangladesh: "BD",
  china: "CN",
  japan: "JP",
  korea: "KR",
  "south korea": "KR",
  singapore: "SG",
  australia: "AU",
  "new zealand": "NZ",
  "south africa": "ZA",
  nigeria: "NG",
  kenya: "KE",
  "united arab emirates": "AE",
};

const COUNTRY_DISPLAY_NAMES = typeof Intl.DisplayNames !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function countryLabel(country: string) {
  if (country === "Unknown") return "Unknown";
  return COUNTRY_DISPLAY_NAMES?.of(country.toUpperCase()) ?? country.toUpperCase();
}

function normalizeCountryName(name: string) {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function resolveCountryCode(name: string) {
  return COUNTRY_NAME_TO_CODE[normalizeCountryName(name)] ?? null;
}

function heatFill(count: number, max: number) {
  if (!count || max <= 0) return "hsl(var(--muted-foreground) / 0.14)";
  const intensity = count / max;
  return `hsl(var(--warning) / ${0.28 + intensity * 0.55})`;
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
    if (viewFilter === "suspicious") {
      return events.filter((event) => event.suspicious);
    }
    if (viewFilter === "high") {
      return events.filter((event) => event.severity === "high");
    }
    return events;
  }, [feed, viewFilter]);

  const suspiciousEvents = useMemo(() => (feed?.events ?? []).filter((event) => event.suspicious), [feed]);
  const highSeverityEvents = useMemo(() => (feed?.events ?? []).filter((event) => event.severity === "high"), [feed]);
  const downloadCounts = useMemo(() => {
    return (feed?.events ?? [])
      .filter((event) => event.action === "download")
      .reduce<Record<string, number>>((acc, event) => {
        const key = (event.country ?? "Unknown").toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
  }, [feed]);

  const downloadHeatmapData = useMemo(() => {
    const total = Object.values(downloadCounts).reduce((sum, current) => sum + current, 0);
    return Object.entries(downloadCounts)
      .map(([country, value]) => ({
        country,
        value,
        share: total ? value / total : 0,
      }))
      .sort((left, right) => right.value - left.value);
  }, [downloadCounts]);

  const downloadCount = useMemo(() => Object.values(downloadCounts).reduce((sum, current) => sum + current, 0), [downloadCounts]);
  const maxDownloadCount = downloadHeatmapData[0]?.value ?? 0;

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

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Recent events</CardTitle>
                <CardDescription>Newest first, with suspicious items highlighted in red.</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold tracking-[0.08em] uppercase">
                Live feed
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 p-8 text-sm text-muted-foreground">
                  No events match the current filter.
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
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
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

          <Card>
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

          <Card>
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

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/60 bg-card shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">World download map</CardTitle>
            <CardDescription>Countries are shaded by download volume using a real map component.</CardDescription>
          </CardHeader>
          <CardContent>
            {downloadHeatmapData.length === 0 ? (
              <div className="flex h-[360px] items-center justify-center rounded-3xl border border-dashed border-border/60 bg-background/50 text-sm text-muted-foreground">
                No download geography yet.
              </div>
            ) : (
              <div className="rounded-[2rem] border border-border/60 bg-background/60 p-3">
                <ComposableMap
                  projection="geoEqualEarth"
                  projectionConfig={{ scale: 155, rotate: [-12, 0, 0] }}
                  width={980}
                  height={520}
                  style={{ width: "100%", height: "auto" }}
                >
                  <Sphere id="anomaly-sphere" stroke="hsl(var(--border))" strokeWidth={1} fill="hsl(var(--background))" />
                  <Graticule stroke="hsl(var(--border) / 0.35)" strokeWidth={0.5} strokeDasharray="3 6" />
                  <Geographies geography={worldCountriesTopoJson}>
                    {({ geographies }) =>
                      geographies.map((geography) => {
                        const countryCode = resolveCountryCode(geography.properties.name);
                        const count = countryCode ? downloadCounts[countryCode] ?? 0 : 0;
                        return (
                          <Geography
                            key={geography.rsmKey}
                            geography={geography}
                            style={{
                              default: {
                                fill: heatFill(count, maxDownloadCount),
                                stroke: "hsl(var(--border) / 0.7)",
                                strokeWidth: 0.6,
                                outline: "none",
                              },
                              hover: {
                                fill: count ? "hsl(var(--warning) / 0.95)" : "hsl(var(--muted-foreground) / 0.22)",
                                stroke: "hsl(var(--foreground) / 0.7)",
                                strokeWidth: 0.8,
                                outline: "none",
                              },
                              pressed: {
                                outline: "none",
                              },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ComposableMap>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Download ranking</CardTitle>
            <CardDescription>The countries with the most downloads are listed beside the map.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Downloads</div>
                <div className="mt-2 text-lg font-semibold tabular-nums">{downloadCount}</div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Countries</div>
                <div className="mt-2 text-lg font-semibold tabular-nums">{downloadHeatmapData.length}</div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Top country</div>
                <div className="mt-2 text-lg font-semibold tabular-nums">{countryLabel(downloadHeatmapData[0]?.country ?? "Unknown")}</div>
              </div>
            </div>

            <div className="space-y-2">
              {downloadHeatmapData.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                  No download data has been recorded yet.
                </div>
              ) : (
                downloadHeatmapData.map((entry) => (
                  <div key={entry.country} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{countryLabel(entry.country)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{entry.value} downloads</div>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        {Math.round(entry.share * 100)}%
                      </Badge>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-muted/70">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(10, Math.round(entry.share * 100))}%`,
                          backgroundColor: heatFill(entry.value, maxDownloadCount),
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
