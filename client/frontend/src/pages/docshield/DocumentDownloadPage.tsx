import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, LockKeyhole } from "lucide-react";
import { api } from "@/lib/docshield-api";
import { triggerBrowserDownload } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDocShieldSession } from "@/lib/docshield-session";
import { sha256Hex } from "@/lib/docshield-signing";

export default function DocumentDownloadPage() {
  const session = getDocShieldSession();
  const { id = "" } = useParams();
  const documentId = decodeURIComponent(id);
  const active = session.activeDocument?.documentId === documentId ? session.activeDocument : null;
  const passwordRequired = active ? !active.accessAnyoneWithLink && active.accessMethod === "password" : false;
  const [password, setPassword] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPassword("");
    setDownloading(false);
    setDownloaded(false);
    setError(null);
  }, [documentId, active?.shareLink?.token]);

  const download = useCallback(
    async (passwordHash?: string) => {
      if (!active?.shareLink || downloading) return;
      setDownloading(true);
      setError(null);
      try {
        const blob = await api.downloadSharedDocument(active.shareLink.token, {
          passwordHash,
          tenantId: active.accessMethod === "organization" ? session.tenantId : undefined,
        });
        triggerBrowserDownload(blob, active.sourceFileName ?? documentId);
        setDownloaded(true);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "The secure link could not be opened.");
      } finally {
        setDownloading(false);
      }
    },
    [active, documentId, downloading, session.tenantId],
  );

  useEffect(() => {
    if (!active?.shareLink || downloading || downloaded || error) return;
    if (passwordRequired) return;
    void download();
  }, [active, downloading, downloaded, error, passwordRequired, download]);

  async function unlock() {
    if (!active || downloading) return;
    if (passwordRequired) {
      const hashed = await sha256Hex(password);
      if (hashed !== active.accessPasswordHash) {
        setError("Password incorrect");
        return;
      }
      await download(hashed);
      return;
    }
    await download();
  }

  if (!active) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LockKeyhole className="h-4 w-4" />
          No active download is available.
        </div>
      </div>
    );
  }

  if (downloaded) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
          <div className="text-sm text-muted-foreground">Download started</div>
        </div>
      </div>
    );
  }

  if (!passwordRequired) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
          <div className="text-sm text-muted-foreground">Preparing download</div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
              <LockKeyhole className="h-5 w-5 text-muted-foreground" />
            </div>
        </div>
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">Locked download</p>
          <h1 className="text-lg font-medium">Enter password</h1>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="download-password" className="sr-only">
              Access password
            </Label>
            <Input
              id="download-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
              placeholder="Password"
            />
          </div>
          <Button className="w-full" onClick={() => void unlock()} disabled={downloading || !password}>
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Unlock and download
          </Button>
          {error && <div className="text-center text-sm text-destructive">{error}</div>}
        </div>
      </div>
    </div>
  );
}
