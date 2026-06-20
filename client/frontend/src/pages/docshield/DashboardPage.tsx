import { useEffect, useState } from "react";
import { api, type DashboardData } from "@/lib/docshield-api";
import { mockDashboard } from "@/lib/docshield-mock";
import { Activity, FileText, ShieldAlert, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .catch(() => {
        setData(mockDashboard);
        setUsingMock(true);
      });
  }, []);

  if (!data) return <div className="text-muted-foreground">Loading…</div>;

  const stats = [
    { label: "Protected documents", value: data.totals.documents, icon: FileText },
    { label: "Access events", value: data.totals.access_events, icon: Activity },
    { label: "Risk signals", value: data.totals.risk_signals, icon: ShieldAlert },
  ];

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Anomaly score, recent telemetry, and risk signals across your tenant.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            api
              .auditExport()
              .then((r) => window.open(r.url, "_blank"))
              .catch(() => toast.message("Audit export unavailable", { description: "GET /audit-export not reachable." }))
          }
        >
          <Download className="h-4 w-4 mr-1" /> Audit export
        </Button>
      </header>

      {usingMock && (
        <div className="rounded-md border border-warning/40 bg-warning/5 text-warning-foreground px-3 py-2 text-xs">
          Showing sample data — connect a DocShield backend via <code>VITE_DOCSHIELD_API_BASE</code> to load live results from <code>GET /dashboard</code>.
        </div>
      )}

      <section className="grid md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-semibold mt-3">{s.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Anomaly score</h2>
          <span className="text-xs text-muted-foreground">Rolling 30 days</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-semibold tabular-nums">{data.anomaly_score}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <div className="mt-4 h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.min(100, data.anomaly_score)}%` }}
          />
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-3">Risk signals</h2>
        <div className="rounded-lg border border-border divide-y divide-border bg-card">
          {data.risk_signals.map((r, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div>
                <div className="font-mono text-sm">{r.document_id}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {r.reason_codes.join(" · ")}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-sm">{r.score}</span>
                <Badge
                  variant={
                    r.severity === "high" ? "destructive" : r.severity === "medium" ? "default" : "secondary"
                  }
                >
                  {r.severity}
                </Badge>
              </div>
            </div>
          ))}
          {data.risk_signals.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">No risk signals.</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-3">Geography</h2>
        <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.geography.map((g) => (
            <div key={g.country} className="rounded-md bg-secondary/40 p-3">
              <div className="text-xs text-muted-foreground">{g.country}</div>
              <div className="text-lg font-semibold tabular-nums">{g.count}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
