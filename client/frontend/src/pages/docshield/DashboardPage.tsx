import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  Download,
  FileText,
  Globe2,
  Loader2,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { api, type DashboardResponse, type DocumentSummary } from "@/lib/docshield-api";
import { mockDashboard } from "@/lib/docshield-mock";
import { formatFileSize } from "@/lib/docshield-file";
import { getDocShieldSession } from "@/lib/docshield-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { toast } from "sonner";

const ACTIVITY_LABELS: Record<string, string> = {
  open: "Open",
  download: "Download",
  verify_attempt: "Verify",
  token_failed: "Token failed",
  ai_upload_blocked: "AI blocked",
};

const ACTIVITY_COLORS: Record<string, string> = {
  open: "hsl(var(--primary))",
  download: "hsl(var(--info))",
  verify_attempt: "hsl(var(--success))",
  token_failed: "hsl(var(--destructive))",
  ai_upload_blocked: "hsl(var(--warning))",
};

const SEVERITY_LABELS: Record<DashboardResponse["alerts"][number]["severity"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_COLORS: Record<DashboardResponse["alerts"][number]["severity"], string> = {
  high: "hsl(var(--destructive))",
  medium: "hsl(var(--warning))",
  low: "hsl(var(--success))",
};

const FOOTPRINT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(var(--muted-foreground))",
];

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildValueChartConfig(label: string, color: string): ChartConfig {
  return {
    value: { label, color },
  };
}

export default function DashboardPage() {
  const session = getDocShieldSession();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [usingMock, setUsingMock] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const tenantId = session.tenantId;

    Promise.all([api.dashboard(tenantId), api.documents(tenantId)])
      .then(([dashboard, managedDocuments]) => {
        if (cancelled) return;
        setData(dashboard);
        setDocuments(managedDocuments);
        setUsingMock(false);
      })
      .catch(() => {
        if (cancelled) return;
        setData(mockDashboard);
        setDocuments([]);
        setUsingMock(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session.tenantId]);

  const documentsById = useMemo(
    () => new Map(documents.map((document) => [document.document_id, document])),
    [documents],
  );

  const analytics = useMemo(() => {
    const recentActivity = [...(data?.recent_activity ?? [])].sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
    const alerts = [...(data?.alerts ?? [])].sort((left, right) => right.score - left.score);
    const activityCounts = countBy(recentActivity.map((item) => item.action));
    const countryCounts = countBy(recentActivity.map((item) => item.country ?? "Unknown"));
    const severityCounts = countBy(alerts.map((item) => item.severity));
    const reasonCounts = countBy(alerts.flatMap((item) => item.reason_codes));
    const documentCounts = countBy(recentActivity.map((item) => item.document_id));

    const activityData = Object.entries(ACTIVITY_LABELS)
      .map(([key, label]) => ({
        label,
        value: activityCounts[key] || 0,
        fill: ACTIVITY_COLORS[key] ?? "hsl(var(--muted-foreground))",
      }))
      .filter((item) => item.value > 0);

    const severityData = (["high", "medium", "low"] as const)
      .map((severity) => ({
        label: SEVERITY_LABELS[severity],
        severity,
        value: severityCounts[severity] || 0,
        fill: SEVERITY_COLORS[severity],
      }))
      .filter((item) => item.value > 0);

    const timelineMap = new Map<string, { label: string; value: number }>();
    recentActivity.forEach((item) => {
      const date = new Date(item.timestamp);
      const key = format(date, "yyyy-MM-dd");
      const label = format(date, "MMM d");
      const existing = timelineMap.get(key);
      if (existing) {
        existing.value += 1;
      } else {
        timelineMap.set(key, { label, value: 1 });
      }
    });

    const timelineData = [...timelineMap.values()];
    const topDocuments = Object.entries(documentCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 4);

    const topReasons = Object.entries(reasonCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 4);

    const countryData = Object.entries(countryCounts)
      .map(([label, value], index) => ({
        label,
        value,
        fill: FOOTPRINT_COLORS[index % FOOTPRINT_COLORS.length],
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);

    return {
      recentActivity,
      alerts,
      activityData,
      severityData,
      timelineData,
      topDocuments,
      topReasons,
      countryData,
      uniqueCountries: new Set(recentActivity.map((item) => item.country).filter(Boolean)).size,
      uniqueDocuments: new Set(recentActivity.map((item) => item.document_id)).size,
      latestActivity: recentActivity[0] ?? null,
      oldestActivity: recentActivity[recentActivity.length - 1] ?? null,
      highSeverityAlerts: alerts.filter((item) => item.severity === "high").length,
    };
  }, [data]);

  const activeDocumentId = session.activeDocument?.documentId;
  const auditDocumentId = documents.some((document) => document.document_id === activeDocumentId)
    ? activeDocumentId
    : documents[0]?.document_id;

  const latestActivity = analytics.latestActivity;
  const latestActivityLabel = latestActivity
    ? `${latestActivity.action.replaceAll("_", " ")} in ${latestActivity.country ?? "unknown"}`
    : "No recent activity";
  const latestActivityAgo = latestActivity
    ? formatDistanceToNow(new Date(latestActivity.timestamp), { addSuffix: true })
    : "Just now";
  const windowLabel =
    analytics.oldestActivity && latestActivity
      ? `${format(new Date(analytics.oldestActivity.timestamp), "MMM d")} to ${format(
          new Date(latestActivity.timestamp),
          "MMM d",
        )}`
      : "Activity window unavailable";

  const timelineConfig = buildValueChartConfig("Events", "hsl(var(--primary))");
  const activityConfig = buildValueChartConfig("Events", "hsl(var(--info))");
  const severityConfig = buildValueChartConfig("Alerts", "hsl(var(--destructive))");
  const countryConfig = buildValueChartConfig("Events", "hsl(var(--muted-foreground))");

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Documents",
      value: data.documents,
      description: `${analytics.uniqueDocuments || 0} seen in the recent activity window`,
      icon: FileText,
    },
    {
      label: "Access events",
      value: data.access_events,
      description: `${analytics.uniqueCountries || 0} countries represented recently`,
      icon: Activity,
    },
    {
      label: "Alerts",
      value: data.alerts.length,
      description: `${analytics.highSeverityAlerts} require a closer look`,
      icon: ShieldAlert,
    },
    {
      label: "Watchlist reasons",
      value: analytics.topReasons.length,
      description: "Distinct reasons surfaced by the current watchlist",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      {usingMock && (
        <Alert className="border-border/60 bg-card">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Showing sample data</AlertTitle>
          <AlertDescription>
            The backend was unreachable, so this dashboard fell back to mock data.
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-6 rounded-3xl border border-border/60 bg-card p-6 shadow-none lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">

          </div>

          <div className="max-w-2xl space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Security posture, activity, and alerts in one place.
            </h1>

          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-9 rounded-full px-4">
              <Link to="/app/documents">
                Open documents
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-9 rounded-full px-4">
              <Link to="/app/access-events">Review activity</Link>
            </Button>
            <Button
              variant="outline"
              className="h-9 rounded-full px-4"
              disabled={!auditDocumentId}
              onClick={() =>
                auditDocumentId &&
                api
                  .auditExport(session.tenantId, auditDocumentId)
                  .then((response) => window.open(api.auditExportUrl(response.tenant_id, response.document_id), "_blank"))
                  .catch(() =>
                    toast.message("Audit export unavailable", {
                      description: "GET /audit-export not reachable.",
                    }),
                  )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Audit export
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Latest event
              </div>
              <p className="mt-3 text-lg font-semibold leading-tight">{latestActivityLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{latestActivityAgo}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                Activity window
              </div>
              <p className="mt-3 text-lg font-semibold leading-tight">{windowLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{analytics.recentActivity.length} recent events</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <Globe2 className="h-3.5 w-3.5" />
                Geography
              </div>
              <p className="mt-3 text-lg font-semibold leading-tight">{analytics.uniqueCountries || 0} countries</p>
              <p className="mt-1 text-sm text-muted-foreground">Seen across the latest feed</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 bg-background/55 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top watchlist item</p>
              <p className="mt-2 text-lg font-semibold tabular-nums">{analytics.alerts[0]?.score ?? 0}</p>
            </div>
            <Badge variant={analytics.highSeverityAlerts > 0 ? "destructive" : "secondary"} className="rounded-full">
              {analytics.highSeverityAlerts > 0 ? "Needs review" : "Calm"}
            </Badge>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top signals</p>
            {analytics.topReasons.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
                No alert reasons returned yet.
              </div>
            ) : (
              analytics.topReasons.map((reason) => (
                <div key={reason.label} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                  <span className="text-sm font-medium">{reason.label.replaceAll("_", " ")}</span>
                  <Badge variant="outline" className="rounded-full">
                    {reason.value}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="border-border/60 bg-card shadow-none">
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardDescription className="uppercase tracking-[0.16em]">{card.label}</CardDescription>
                  <CardTitle className="text-3xl font-semibold tabular-nums">{card.value}</CardTitle>
                  <p className="text-sm leading-5 text-muted-foreground">{card.description}</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-2.5 text-muted-foreground">
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/60 bg-card shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Documents</CardTitle>
            <CardDescription>Recently managed documents across {session.tenantName}.</CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {usingMock ? "Document details are unavailable while showing sample data." : "No documents yet."}
              </div>
            ) : (
              <ul className="divide-y divide-border" aria-label="Recent documents">
                {documents.slice(0, 5).map((document) => (
                  <li key={document.document_id}>
                    <Link
                      to={`/app/documents/${encodeURIComponent(document.document_id)}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <DocumentLabel document={document} documentId={document.document_id} />
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {document.content_type && <span>{friendlyFileType(document.content_type)}</span>}
                        {document.size_bytes != null && <span>{formatFileSize(document.size_bytes)}</span>}
                        <Badge variant={document.status === "revoked" ? "destructive" : "secondary"}>{document.status}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Alert severity</CardTitle>
            <CardDescription>How much of the watchlist is low, medium, or high pressure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.severityData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/50 text-sm text-muted-foreground">
                No alerts to chart yet.
              </div>
            ) : (
              <>
                <ChartContainer config={severityConfig} className="h-[220px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={analytics.severityData}
                      dataKey="value"
                      nameKey="severity"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={84}
                      paddingAngle={3}
                    >
                      {analytics.severityData.map((entry) => (
                        <Cell key={entry.severity} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="space-y-2">
                  {analytics.severityData.map((entry) => (
                    <div key={entry.severity} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                      <span className="text-sm font-medium">{entry.label}</span>
                      <Badge variant="outline" className="rounded-full">
                        {entry.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/60 bg-card shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Activity timeline</CardTitle>
            <CardDescription>Recent activity grouped by day, so spikes are easier to spot.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.timelineData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/50 text-sm text-muted-foreground">
                No timeline data yet.
              </div>
            ) : (
              <ChartContainer config={timelineConfig} className="h-[260px] w-full">
                <AreaChart data={analytics.timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="value"
                    type="monotone"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.12)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Activity mix</CardTitle>
            <CardDescription>The most common actions in the latest feed.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.activityData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/50 text-sm text-muted-foreground">
                No activity yet.
              </div>
            ) : (
              <ChartContainer config={activityConfig} className="h-[260px] w-full">
                <BarChart data={analytics.activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--muted-foreground) / 0.7)" radius={8}>
                    {analytics.activityData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/60 bg-card shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Geography footprint</CardTitle>
            <CardDescription>Which countries are represented in the most recent events.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.countryData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/50 text-sm text-muted-foreground">
                No geography data yet.
              </div>
            ) : (
              <ChartContainer config={countryConfig} className="h-[260px] w-full">
                <BarChart data={analytics.countryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="label" type="category" width={56} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={8}>
                    {analytics.countryData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Recent activity</CardTitle>
            <CardDescription>A compact feed with document, time, and location context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
                No recent activity yet.
              </div>
            ) : (
              analytics.recentActivity.map((item, index) => (
                <div key={`${item.document_id}-${item.timestamp}-${index}`} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <DocumentLabel document={documentsById.get(item.document_id)} documentId={item.document_id} />
                        <Badge variant="outline" className="rounded-full">
                          {ACTIVITY_LABELS[item.action] ?? item.action.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {item.country ?? "Unknown country"} · {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background px-3 py-2 text-right">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">When</div>
                      <div className="text-sm font-medium">{format(new Date(item.timestamp), "MMM d, p")}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/60 bg-card shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Watchlist</CardTitle>
            <CardDescription>The highest-scoring alerts, sorted so the loudest signal stays on top.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.alerts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
                No alerts yet.
              </div>
            ) : (
              analytics.alerts.map((alert) => (
                <div key={`${alert.document_id}-${alert.score}`} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <DocumentLabel document={documentsById.get(alert.document_id)} documentId={alert.document_id} />
                        <Badge
                          variant={alert.severity === "high" ? "destructive" : alert.severity === "medium" ? "default" : "secondary"}
                          className="rounded-full"
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.reason_codes.join(" · ")}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background px-3 py-2 text-right">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Score</div>
                      <div className="text-2xl font-semibold tabular-nums">{alert.score}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Operational readout</CardTitle>
            <CardDescription>Small cues that help this page stay useful without getting louder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tenant</div>
                <div className="mt-2 text-sm font-medium">{data.tenant_id}</div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">High alerts</div>
                <div className="mt-2 text-sm font-medium">{analytics.highSeverityAlerts}</div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recent feed</div>
                <div className="mt-2 text-sm font-medium">{analytics.recentActivity.length} events</div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Top documents</p>
              {analytics.topDocuments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
                  No document activity yet.
                </div>
              ) : (
                analytics.topDocuments.map((doc) => (
                  <div key={doc.label} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                    <span className="text-sm font-medium">{doc.label}</span>
                    <Badge variant="outline" className="rounded-full">
                      {doc.value}
                    </Badge>
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

function DocumentLabel({ document, documentId }: { document?: DocumentSummary; documentId: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{document?.file_name ?? documentId}</div>
      {document?.file_name && <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{documentId}</div>}
    </div>
  );
}

function friendlyFileType(contentType: string) {
  if (contentType === "application/pdf") return "PDF";
  if (contentType.includes("wordprocessingml")) return "DOCX";
  return contentType;
}
