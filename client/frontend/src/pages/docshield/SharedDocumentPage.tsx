import { useEffect, useState } from "react";
import { Download, FileCheck2, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import { api, type SharedDocument } from "@/lib/docshield-api";
import { formatFileSize } from "@/lib/docshield-file";
import { getDocShieldSession } from "@/lib/docshield-session";
import { sha256Hex } from "@/lib/docshield-signing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SharedDocumentPage() {
  const { token = "" } = useParams();
  const [document, setDocument] = useState<SharedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.sharedDocument(token)
      .then(setDocument)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "This secure link is unavailable."))
      .finally(() => setLoading(false));
  }, [token]);

  async function download() {
    if (!document) return;
    setDownloading(true);
    try {
      const passwordHash = document.password_required ? await sha256Hex(password) : undefined;
      const tenantId = document.access_method === "organization" ? getDocShieldSession().tenantId : undefined;
      const blob = await api.downloadSharedDocument(token, { passwordHash, tenantId });
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.file_name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Download started", { description: "This download was added to the document analytics." });
    } catch (reason) {
      toast.error("Download blocked", { description: reason instanceof Error ? reason.message : "Access could not be verified." });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-6 w-6 text-primary" />DocShield</div>
        {loading ? (
          <Card><CardContent className="flex items-center justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></CardContent></Card>
        ) : error || !document ? (
          <Alert variant="destructive"><LockKeyhole className="h-4 w-4" /><AlertTitle>Secure link unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
        ) : (
          <Card>
            <CardHeader>
              <Badge variant="secondary" className="mb-2 w-fit gap-1"><FileCheck2 className="h-3.5 w-3.5" />Signed original</Badge>
              <CardTitle>{document.file_name}</CardTitle>
              <CardDescription>{formatFileSize(document.size_bytes)} · signed by {document.issuer_key_id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <Info label="Document ID" value={document.document_id} />
                <Info label="Verified SHA-256 fingerprint" value={document.content_fingerprint} />
                <Info label="Link expires" value={document.expires_at ? new Date(document.expires_at).toLocaleString() : "No expiry"} />
              </div>
              {document.password_required && <div className="space-y-2"><Label htmlFor="share-password">Access password</Label><Input id="share-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>}
              {document.access_method === "organization" && <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Organization-only document</AlertTitle><AlertDescription>Your current organization session must match the issuer.</AlertDescription></Alert>}
              <Button onClick={() => void download()} disabled={downloading || (document.password_required && !password)} className="w-full">
                {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {downloading ? "Authorizing…" : "Download original document"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Opening and downloading this link record the client IP, browser family, and country when available.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 break-all font-mono text-xs">{value}</div></div>;
}
