import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
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
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis, Area, AreaChart } from "recharts";
import { api, type DashboardResponse } from "@/lib/docshield-api";
import { mockDashboard } from "@/lib/docshield-mock";
import { getDocShieldSession } from "@/lib/docshield-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { NeonPatternDefs } from "@/components/NeonPatternDefs";
import { useNeonCharts } from "@/hooks/use-neon-charts";
import { toast } from "sonner";

const ALERT_SEVERITY_COLORS: Record<DashboardResponse["alerts"][number]["severity"], string> = {
  high: "hsl(var(--destructive))",
  medium: "hsl(var(--warning))",
  low: "hsl(var(--success))",
};

const ALERT_SEVERITY_LABELS: Record<DashboardResponse["alerts"][number]["severity"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const ACTIVITY_COLORS: Record<string, string> = {
  open: "hsl(var(--primary))",
  download: "hsl(var(--info))",
  verify_attempt: "hsl(var(--success))",
  token_failed: "hsl(var(--destructive))",
  ai_upload_blocked: "hsl(var(--warning))",
};

const ACTIVITY_LABELS: Record<string, string> = {
  open: "Open",
  download: "Download",
  verify_attempt: "Verify",
  token_failed: "Token failed",
  ai_upload_blocked: "AI blocked",
};

const FOOTPRINT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
];

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildChartConfig(labels: string[], seriesLabel: string, color: string): ChartConfig {
  return {
    value: { label: seriesLabel, color },
    ...Object.fromEntries(labels.map((label) => [label, { label }])),
  };
}

export default function DashboardPage() {
  const session = getDocShieldSession();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const { getFill } = useNeonCharts();

  useEffect(() => {
    const tenantId = session.tenantId;
    const documentId = session.activeDocument?.documentId;
    api
      .dashboard(tenantId, documentId)
      .then((response) => {
        setData(response);
        setUsingMock(false);
      })
      .catch(() => {
        setData(mockDashboard);
        setUsingMock(true);
      })
      .finally(() => setLoading(false));
  }, [session.activeDocument?.documentId, session.tenantId]);

  const analytics = useMemo(() => {
    const recentActivity = [...(data?.recent_activity ?? [])].sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
    const alerts = [...(data?.alerts ?? [])].sort((left, right) => right.score - left.score);
    const activityCounts = countBy(recentActivity.map((item) => item.action));
    const countryCounts = countBy(recentActivity.map((item) => item.country ?? "Unknown"));
    const documentCounts = countBy(recentActivity.map((item) => item.document_id));
    const severityCounts = countBy(alerts.map((item) => item.severity));
    const reasonCounts = countBy(alerts.flatMap((item) => item.reason_codes));

    const actionData = Object.entries(ACTIVITY_LABELS)
      .map(([key, label]) => ({
        label,
        value: activityCounts[key] || 0,
        fill: ACTIVITY_COLORS[key] ?? "hsl(var(--muted-foreground))",
      }))
      .filter((item) => item.value > 0);

    const countryData = Object.entries(countryCounts)
      .map(([label, value], index) => ({
        label,
        value,
        fill: FOOTPRINT_COLORS[index % FOOTPRINT_COLORS.length],
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);

    const timelineMap = new Map<string, { label: string; value: number }>();
    recentActivity.forEach((item) => {
      const date = new Date(item.timestamp);
      const key = format(date, "yyyy-MM-dd");
      const label = format(date, "MMM d");
      const current = timelineMap.get(key);
      if (current) {
        current.value += 1;
      } else {
        timelineMap.set(key, { label, value: 1 });
      }
    });
    const timelineData = [...timelineMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, item]) => item);

    const severityData = (["high", "medium", "low"] as const)
      .map((severity) => ({
        label: ALERT_SEVERITY_LABELS[severity],
        value: severityCounts[severity] || 0,
        fill: ALERT_SEVERITY_COLORS[severity],
      }))
      .filter((item) => item.value > 0);

    const topDocuments = Object.entries(documentCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 4);

    const topReasons = Object.entries(reasonCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 4);

    return {
      recentActivity,
      alerts,
      activityData: actionData,
      countryData,
      timelineData,
      severityData,
      topDocuments,
      topReasons,
      uniqueCountries: new Set(recentActivity.map((item) => item.country).filter(Boolean)).size,
      uniqueDocuments: new Set(recentActivity.map((item) => item.document_id)).size,
      latestActivity: recentActivity[0] ?? null,
      oldestActivity: recentActivity[recentActivity.length - 1] ?? null,
      highSeverityAlerts: alerts.filter((item) => item.severity === "high").length,
    };
  }, [data]);

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  const overviewCards = [
    {
      label: "Documents",
      value: data.documents,
      description: `${analytics.uniqueDocuments || 0} active in the recent activity window`,
      icon: FileText,
    },
    {
      label: "Access events",
      value: data.access_events,
      description: `${analytics.uniqueCountries || 0} countries observed recently`,
      icon: Activity,
    },
    {
      label: "Alerts",
      value: data.alerts.length,
      description: `${analytics.highSeverityAlerts} high-priority items need attention`,
      icon: ShieldAlert,
    },
    {
      label: "Watchlist reasons",
      value: analytics.topReasons.length,
      description: "Recurring signals from the current alert set",
      icon: AlertTriangle,
    },
  ];

  const latestActivity = analytics.latestActivity;
  const latestActivityLabel = latestActivity
    ? `${latestActivity.action.replaceAll("_", " ")} in ${latestActivity.country ?? "Unknown"}`
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

  const timelineConfig = buildChartConfig(
    analytics.timelineData.map((item) => item.label),
    "Events",
    "hsl(var(--primary))",
  );
  const actionConfig = buildChartConfig(
    analytics.activityData.map((item) => item.label),
    "Events",
    "hsl(var(--info))",
  );
  const countryConfig = buildChartConfig(
    analytics.countryData.map((item) => item.label),
    "Events",
    "hsl(var(--warning))",
  );
  const severityConfig = buildChartConfig(
    analytics.severityData.map((item) => item.label),
    "Alerts",
    "hsl(var(--destructive))",
  );

  return (
    <div className="space-y-8 pb-8">
      <NeonPatternDefs
        colors={[
          "hsl(var(--primary))",
          "hsl(var(--info))",
          "hsl(var(--warning))",
          "hsl(var(--success))",
          "hsl(var(--destructive))",
        ]}
      />

      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-background to-muted/40 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
        <div className="absolute inset-0 opacity-60">
          <div className="absolute left-[-10%] top-[-12%] h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute bottom-[-15%] right-[8%] h-72 w-72 rounded-full bg-info/10 blur-3xl" />
        </div>
        <div className="relative grid gap-0 lg:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full border-border/60 bg-background/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em]">
                Live dashboard
              </Badge>
              {usingMock && (
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em]">
                  Mock data
                </Badge>
              )}
            </div>

            <div className="max-w-2xl space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Security posture, activity, and alerts in one place.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                A denser operational view for the DocShield tenant, with a quick read on document volume, live access
                pressure, and the signals that deserve a closer look.
              </p>
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
                onClick={() =>
                  api
                    .auditExport(
                      session.tenantId,
                      session.activeDocument?.documentId ?? data.alerts[0]?.document_id ?? "doc_7f92ab31",
                    )
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
              <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Latest event
                </div>
                <p className="mt-3 text-lg font-semibold leading-tight">{latestActivityLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">{latestActivityAgo}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Active window
                </div>
                <p className="mt-3 text-lg font-semibold leading-tight">{windowLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">{analytics.recentActivity.length} recent events</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <Globe2 className="h-3.5 w-3.5" />
                  Geography
                </div>
                <p className="mt-3 text-lg font-semibold leading-tight">{analytics.uniqueCountries || 0} countries</p>
                <p className="mt-1 text-sm text-muted-foreground">Seen across the latest activity feed</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border/70 bg-background/70 p-6 md:p-8 lg:border-l lg:border-t-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Alert score</p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-3xl font-semibold tabular-nums">{analytics.alerts[0]?.score ?? 0}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Top watchlist item</div>
                  </div>
                  <Badge variant={analytics.highSeverityAlerts > 0 ? "destructive" : "secondary"} className="rounded-full">
                    {analytics.highSeverityAlerts > 0 ? "Needs review" : "Calm"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Risk reasons</p>
                <div className="mt-3 text-3xl font-semibold tabular-nums">{analytics.topReasons.length}</div>
                <div className="mt-1 text-sm text-muted-foreground">Distinct signals in alerts</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top signals</p>
              {analytics.topReasons.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                  No alert reasons returned yet.
                </div>
              ) : (
                analytics.topReasons.map((reason) => (
                  <div key={reason.label} className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
                    <span className="text-sm font-medium">{reason.label.replaceAll("_", " ")}</span>
                    <Badge variant="outline" className="rounded-full">
                      {reason.value}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((item) => (
          <Card key={item.label} className="border-border/70 bg-card/90 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                  <div className="text-3xl font-semibold tabular-nums">{item.value}</div>
                  <p className="text-sm leading-5 text-muted-foreground">{item.description}</p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Activity timeline</CardTitle>
            <CardDescription>Recent activity grouped by day, so spikes show up before the table does.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={timelineConfig} className="h-[280px] w-full">
              <AreaChart data={analytics.timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="value"
                  type="monotone"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.18)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Alert severity</CardTitle>
            <CardDescription>How much of the watchlist is low, medium, or high pressure.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.severityData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/50 text-sm text-muted-foreground">
                No alerts to chart yet.
              </div>
            ) : (
              <ChartContainer config={severityConfig} className="h-[280px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={analytics.severityData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={3}
                  >
                    {analytics.severityData.map((entry) => (
                      <Cell key={entry.label} {...getFill(entry.fill)} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-border/70 bg-card/90 xl:col-span-2">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Activity mix</CardTitle>
            <CardDescription>The most common actions in the latest feed, from opens to failed token checks.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.activityData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/50 text-sm text-muted-foreground">
                No activity yet.
              </div>
            ) : (
              <ChartContainer config={actionConfig} className="h-[260px] w-full">
                <BarChart data={analytics.activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={8}>
                    {analytics.activityData.map((entry) => (
                      <Cell key={entry.label} {...getFill(entry.fill)} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Geography footprint</CardTitle>
            <CardDescription>Which countries are represented in the most recent events.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.countryData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/50 text-sm text-muted-foreground">
                No geography data yet.
              </div>
            ) : (
              <ChartContainer config={countryConfig} className="h-[260px] w-full">
                <BarChart data={analytics.countryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={48} stroke="hsl(var(--muted-foreground))" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={8}>
                    {analytics.countryData.map((entry) => (
                      <Cell key={entry.label} {...getFill(entry.fill)} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Watchlist</CardTitle>
            <CardDescription>The highest-scoring alerts, sorted so the loudest signal stays on top.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.alerts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
                No alerts yet.
              </div>
            ) : (
              analytics.alerts.map((alert) => (
                <div key={`${alert.document_id}-${alert.score}`} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{alert.document_id}</p>
                        <Badge
                          variant={alert.severity === "high" ? "destructive" : alert.severity === "medium" ? "default" : "secondary"}
                          className="rounded-full"
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.reason_codes.join(" · ")}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background px-3 py-2 text-right">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Score</div>
                      <div className="text-2xl font-semibold tabular-nums">{alert.score}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Recent activity</CardTitle>
            <CardDescription>A compact feed with timestamp, location, and action context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
                No recent activity yet.
              </div>
            ) : (
              analytics.recentActivity.map((item, index) => (
                <div key={`${item.document_id}-${item.timestamp}-${index}`} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.document_id}</p>
                        <Badge variant="outline" className="rounded-full">
                          {ACTIVITY_LABELS[item.action] ?? item.action.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {item.country ?? "Unknown country"} · {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background px-3 py-2 text-right">
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

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Top documents</CardTitle>
            <CardDescription>Documents with the most appearances in the recent feed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.topDocuments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
                No document activity yet.
              </div>
            ) : (
              analytics.topDocuments.map((doc) => (
                <div key={doc.label} className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                  <div>
                    <p className="font-medium">{doc.label}</p>
                    <p className="text-sm text-muted-foreground">Recent feed mentions</p>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {doc.value}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Alert className="border-border/70 bg-card/90">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Operational readout</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              This dashboard keeps the important stuff visible first: volume, geography, alert pressure, and the
              highest-scoring items in the watchlist.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tenant</div>
                <div className="mt-2 text-sm font-medium">{data.tenant_id}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">High alerts</div>
                <div className="mt-2 text-sm font-medium">{analytics.highSeverityAlerts}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recent feed</div>
                <div className="mt-2 text-sm font-medium">{analytics.recentActivity.length} events</div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </section>
    </div>
  );
}
