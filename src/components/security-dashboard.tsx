"use client";

import { useEffect, useState } from "react";

interface SecurityEvent {
  timestamp: string;
  type: string;
  ip: string;
  path: string;
  threat: string;
  details: string;
}

interface SecurityStats {
  total_events: number;
  sql_injection: number;
  xss: number;
  path_traversal: number;
  command_injection: number;
  rate_limits: number;
  malicious_uploads: number;
  clean_files: number;
}

export function SecurityDashboard() {
  const [logs, setLogs] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSecurityData = async () => {
    try {
      const res = await fetch("/api/security/logs");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setLogs(data.logs);
        setStats(data.stats);
        setError(null);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
    const interval = setInterval(fetchSecurityData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="mt-2 text-muted-foreground">Loading security data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive mb-2">{error}</p>
        <p className="text-sm text-muted-foreground">Retrying in 5 seconds...</p>
      </div>
    );
  }

  const threatBadge: Record<string, string> = {
    SQL_INJECTION: "bg-red-500/10 text-red-500 border-red-500/20",
    XSS: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    PATH_TRAVERSAL: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    COMMAND_INJECTION: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    RATE_LIMIT: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    MALICIOUS_UPLOAD: "bg-red-500/10 text-red-500 border-red-500/20",
    CLEAN: "bg-green-500/10 text-green-500 border-green-500/20",
    FILE_SCAN: "bg-green-500/10 text-green-500 border-green-500/20",
    FILE_MASQUERADE: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-2xl font-bold">{stats?.total_events || 0}</div>
          <div className="text-sm text-muted-foreground">Total Events</div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-2xl font-bold text-green-500">{stats?.clean_files || 0}</div>
          <div className="text-sm text-muted-foreground">Clean Files</div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-2xl font-bold text-red-500">
            {(stats?.sql_injection || 0) + (stats?.xss || 0) + (stats?.command_injection || 0) + (stats?.malicious_uploads || 0)}
          </div>
          <div className="text-sm text-muted-foreground">Threats Blocked</div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-2xl font-bold text-yellow-500">{stats?.rate_limits || 0}</div>
          <div className="text-sm text-muted-foreground">Rate Limited</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Security Event Log</h3>
          <span className="text-xs text-muted-foreground">Auto-refreshes every 5s</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No security events yet. Upload a file to see results here.
            </div>
          ) : (
            <div className="divide-y">
              {logs.slice().reverse().map((log, i) => (
                <div key={i} className="p-4 flex items-start gap-4">
                  <span
                    className={`inline-block px-2 py-1 text-xs font-medium rounded border whitespace-nowrap ${
                      threatBadge[log.threat] || "bg-gray-500/10 text-gray-500 border-gray-500/20"
                    }`}
                  >
                    {log.threat === "CLEAN" || log.threat === "FILE_SCAN" ? "CLEAN" : log.threat}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{log.details}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      IP: {log.ip} | Path: {log.path}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
