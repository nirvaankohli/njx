import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Download, FileText, Activity, ShieldAlert, Loader2 } from "lucide-react";
import { api, type DashboardResponse, type DocumentSummary } from "@/lib/docshield-api";
import { mockDashboard } from "@/lib/docshield-mock";
import { formatFileSize } from "@/lib/docshield-file";
import { getDocShieldSession } from "@/lib/docshield-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

export default function DashboardPage() {
  const session = getDocShieldSession();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [usingMock, setUsingMock] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = session.tenantId;
    Promise.all([api.dashboard(tenantId), api.documents(tenantId)])
      .then(([dashboard, managedDocuments]) => {
        setData(dashboard);
        setDocuments(managedDocuments);
        setUsingMock(false);
      })
      .catch(() => {
        setData(mockDashboard);
        setDocuments([]);
        setUsingMock(true);
      })
      .finally(() => setLoading(false));
  }, [session.tenantId]);

  const documentsById = useMemo(
    () => new Map(documents.map((document) => [document.document_id, document])),
    [documents],
  );

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  const summary = [
    { label: "Documents", value: data.documents, icon: FileText },
    { label: "Access events", value: data.access_events, icon: Activity },
    { label: "Alerts", value: data.alerts.length, icon: ShieldAlert },
  ];
  const activeDocumentId = session.activeDocument?.documentId;
  const auditDocumentId = documents.some((document) => document.document_id === activeDocumentId)
    ? activeDocumentId
    : documents[0]?.document_id;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            High-level tenant telemetry, recent activity, and the active alert list.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!auditDocumentId}
          onClick={() =>
            auditDocumentId && api
              .auditExport(session.tenantId, auditDocumentId)
              .then((response) => window.open(api.auditExportUrl(response.tenant_id, response.document_id), "_blank"))
              .catch(() =>
                toast.message("Audit export unavailable", {
                  description: "GET /audit-export not reachable.",
                }),
              )
          }
        >
          <Download className="mr-1 h-4 w-4" />
          Audit export
        </Button>
      </header>

      {usingMock && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Showing sample data</AlertTitle>
          <AlertDescription>
            The backend was unreachable, so the page fell back to mock data. Set the backend base URL or run the
            local FastApi server on `127.0.0.1:8000`.
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardDescription>{item.label}</CardDescription>
                <CardTitle className="mt-2 text-3xl">{item.value}</CardTitle>
              </div>
              <item.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
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
                    <div className="min-w-0">
                      <div className="truncate font-medium">{document.file_name ?? document.document_id}</div>
                      <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{document.document_id}</div>
                    </div>
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

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>Risk signals returned by the backend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground">No alerts yet.</div>
            ) : (
              data.alerts.map((alert) => (
                <div key={alert.document_id + alert.score} className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <DocumentLabel document={documentsById.get(alert.document_id)} documentId={alert.document_id} />
                      <div className="mt-1 text-xs text-muted-foreground">{alert.reason_codes.join(" · ")}</div>
                    </div>
                    <Badge
                      variant={alert.severity === "high" ? "destructive" : alert.severity === "medium" ? "default" : "secondary"}
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">Score {alert.score}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>The latest access events in chronological order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent_activity.length === 0 ? (
              <div className="text-sm text-muted-foreground">No recent activity yet.</div>
            ) : (
              data.recent_activity.map((item, index) => (
                <div key={`${item.document_id}-${item.timestamp}-${index}`} className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <DocumentLabel document={documentsById.get(item.document_id)} documentId={item.document_id} />
                    <Badge variant="outline">{item.action}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                    <span>{item.country ?? "unknown country"}</span>
                  </div>
                </div>
              ))
            )}
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
