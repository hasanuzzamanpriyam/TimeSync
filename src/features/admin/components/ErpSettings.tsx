import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { syncManager } from "@/services/sync";
import { secureStorage } from "@/services/storage/secure";
import { Wifi, WifiOff, RefreshCw, Clock, HardDrive } from "lucide-react";

export function ErpSettings() {
  const [baseUrl, setBaseUrl] = useState("");
  const [syncInterval, setSyncInterval] = useState(5);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    secureStorage.get("erp_base_url").then((url) => { if (url) setBaseUrl(url as string); });
    secureStorage.get("erp_sync_interval").then((val) => { if (val) setSyncInterval(val as number); });
    updateStatus();

    const onlineHandler = () => setIsOnline(true);
    const offlineHandler = () => setIsOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);

    const statusInterval = setInterval(updateStatus, 5000);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      clearInterval(statusInterval);
    };
  }, []);

  const updateStatus = async () => {
    setPendingCount(await syncManager.getPendingCount());
    setLastSync(await syncManager.getLastSyncTime());
  };

  const handleSave = async () => {
    await secureStorage.set("erp_base_url", baseUrl);
    await secureStorage.set("erp_sync_interval", syncInterval);
    syncManager.stop();
    syncManager.start(syncInterval * 60 * 1000);
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    try {
      const response = await fetch(`${baseUrl}/api/health`, { method: "GET", signal: AbortSignal.timeout(5000) });
      setTestResult(response.ok ? "Connected" : "Failed: " + response.statusText);
    } catch (err: any) {
      setTestResult("Error: " + (err?.message ?? "Unknown"));
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    await syncManager.processQueue();
    setIsSyncing(false);
    updateStatus();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>ERP Connection</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="erp-url">Base URL</Label>
            <Input id="erp-url" placeholder="https://erp.example.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sync-interval">Sync Interval (minutes)</Label>
            <Input id="sync-interval" type="number" min="1" max="60" value={syncInterval} onChange={(e) => setSyncInterval(parseInt(e.target.value) || 5)} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave}>Save Settings</Button>
            <Button variant="outline" onClick={handleTestConnection}>Test Connection</Button>
            {testResult && <span className={`text-sm ${testResult === "Connected" ? "text-green-600" : "text-destructive"}`}>{testResult}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sync Status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-destructive" />}
            <span>{isOnline ? "Online" : "Offline"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <span>Pending: {pendingCount} items</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Last sync: {lastSync ? new Date(lastSync).toLocaleString() : "Never"}</span>
          </div>
          <Button variant="outline" onClick={handleSyncNow} disabled={isSyncing}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
