"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, Folder } from "lucide-react";

type DriveFile = { id: string; name: string; webViewLink?: string | null; mimeType: string; isFolder: boolean };

export function DriveFilePicker({
  onPick, onlyFolders,
}: { onPick: (file: DriveFile) => void; onlyFolders?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);

  async function buscar() {
    if (!q.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/drive/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setLoading(false);
    if (Array.isArray(data)) {
      setResults(onlyFolders ? data.filter((f: DriveFile) => f.isFolder) : data);
    } else {
      setResults([]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no Drive..." onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscar())} />
        <Button type="button" onClick={buscar} disabled={loading} variant="outline">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded border border-border divide-y divide-border">
          {results.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { onPick(f); setResults([]); setQ(f.name); }}
              className="w-full text-left text-sm flex items-center gap-2 px-3 py-2 hover:bg-accent"
            >
              {f.isFolder ? <Folder className="h-4 w-4 text-amber-500" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
