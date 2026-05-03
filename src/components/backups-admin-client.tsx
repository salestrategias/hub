"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, AlertTriangle, Check, Copy, Calendar, HardDrive, Terminal, Cloud, ShieldCheck } from "lucide-react";

type Arquivo = { nome: string; tamanhoBytes: number; criadoEm: string };

export function BackupsAdminClient({
  configurado, diretorio, arquivos,
}: {
  configurado: boolean;
  diretorio: string;
  arquivos: Arquivo[];
}) {
  const totalBytes = arquivos.reduce((s, a) => s + a.tamanhoBytes, 0);
  const ultimoBackup = arquivos[0]?.criadoEm ?? null;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Backups disponíveis" value={String(arquivos.length)} icon={<Database className="h-3.5 w-3.5" />} />
        <Kpi label="Espaço usado" value={fmtSize(totalBytes)} icon={<HardDrive className="h-3.5 w-3.5" />} />
        <Kpi label="Último backup" value={ultimoBackup ? relTime(ultimoBackup) : "—"} icon={<Calendar className="h-3.5 w-3.5" />} subtle={ultimoBackup ? new Date(ultimoBackup).toLocaleString("pt-BR") : undefined} />
        <Kpi label="Status do cron" value={configurado ? "Volume montado" : "Não configurado"} icon={<ShieldCheck className="h-3.5 w-3.5" />} accent={configurado ? "good" : "bad"} />
      </div>

      {!configurado && (
        <Card style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.04)" }}>
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Volume de backups não está montado</div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                A pasta <code className="font-mono text-amber-400">{diretorio}</code> não foi encontrada dentro do container.
                Verifique se o <code className="font-mono">docker-compose.yml</code> contém o volume <code className="font-mono">./backups:/app/backups:ro</code> e
                rode <code className="font-mono">docker compose up -d</code>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <UltimoBackupAlerta atDate={ultimoBackup} />

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Backups</TabsTrigger>
          <TabsTrigger value="rodar">Rodar agora</TabsTrigger>
          <TabsTrigger value="cron">Configurar cron</TabsTrigger>
          <TabsTrigger value="restore">Restaurar</TabsTrigger>
          <TabsTrigger value="s3">Upload S3 (opcional)</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                    <TableHead>Idade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arquivos.map((a) => (
                    <TableRow key={a.nome}>
                      <TableCell className="font-mono text-[12px]">{a.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[12px]">{fmtSize(a.tamanhoBytes)}</TableCell>
                      <TableCell><Badge variant={idadeBadge(a.criadoEm)}>{relTime(a.criadoEm)}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {arquivos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                        Nenhum backup encontrado em {diretorio}.<br />
                        <span className="text-xs">Configure o cron na aba ao lado para começar.</span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rodar">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-sal-400" />
                <div className="font-display font-semibold text-[15px]">Rodar backup manualmente</div>
              </div>
              <p className="text-sm text-muted-foreground">
                Execute na VPS para gerar um backup imediato. O arquivo aparece nesta lista após o término.
              </p>
              <CodeBlock content="cd /opt/sal-hub && ./scripts/backup.sh" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                O script faz <code className="font-mono">pg_dump</code> dentro do container <code className="font-mono">db</code>,
                comprime com gzip nível 9 e mantém por padrão os últimos 30 backups (rotação automática).
                Variáveis úteis: <code className="font-mono">BACKUP_KEEP=60</code>, <code className="font-mono">BACKUP_DIR=/outro/lugar</code>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cron">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-sal-400" />
                <div className="font-display font-semibold text-[15px]">Cron diário às 3h da manhã</div>
              </div>
              <p className="text-sm text-muted-foreground">
                Rode uma vez no host (não no container) para instalar o cron job:
              </p>
              <CodeBlock content="cd /opt/sal-hub && ./scripts/setup-cron.sh" />
              <p className="text-sm text-muted-foreground">Verificar:</p>
              <CodeBlock content="crontab -l | grep SAL_HUB
tail -f /opt/sal-hub/backups/cron.log" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                O setup é idempotente — pode rodar várias vezes sem duplicar entradas no crontab.
                Para mudar o horário, edite manualmente com <code className="font-mono">crontab -e</code>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restore">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-amber-400" />
                <div className="font-display font-semibold text-[15px]">Restaurar a partir de um backup</div>
              </div>
              <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-md p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Operação destrutiva</strong>: o restore SOBRESCREVE o banco atual.
                  O script pede confirmação digitando "restaurar" antes de prosseguir.
                  Execute fora do horário de uso e tenha um backup atual antes.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">Comando:</p>
              <CodeBlock content="cd /opt/sal-hub && ./scripts/restore.sh backups/salhub-YYYYMMDD-HHMMSS.sql.gz
docker compose restart app" />
              <p className="text-xs text-muted-foreground">
                Após restaurar, reinicie o app para forçar reconexão com o banco e refresh dos dados em cache.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="s3">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-sal-400" />
                <div className="font-display font-semibold text-[15px]">Upload off-site para S3-compatible</div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Backups locais protegem contra erro humano, mas não contra perda do VPS.
                Recomendado: configure upload paralelo para um bucket externo (Backblaze B2, Wasabi, R2, AWS S3).
              </p>
              <p className="text-sm text-muted-foreground">1. Instale a AWS CLI no host:</p>
              <CodeBlock content="apt install -y awscli" />
              <p className="text-sm text-muted-foreground">2. Adicione no <code className="font-mono">.env</code>:</p>
              <CodeBlock content={`AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
S3_BUCKET=sal-hub-backups
S3_PREFIX=daily
# Opcional para B2/Wasabi/R2:
S3_ENDPOINT=https://s3.us-west-002.backblazeb2.com`} />
              <p className="text-sm text-muted-foreground">
                3. Pronto. O <code className="font-mono">backup.sh</code> detecta as variáveis e envia automaticamente após o backup local.
                Custo típico no Backblaze B2: <strong>~US$ 0,005/GB/mês</strong> (5 GB de backups = US$ 0,03/mês).
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UltimoBackupAlerta({ atDate }: { atDate: string | null }) {
  if (!atDate) return null;
  const horas = (Date.now() - new Date(atDate).getTime()) / 3600_000;
  if (horas <= 30) return null;
  return (
    <Card style={{ borderColor: "rgba(245,158,11,0.3)" }}>
      <CardContent className="p-4 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          O último backup foi <strong>há mais de {Math.floor(horas)}h</strong>.
          Se você configurou o cron diário, verifique se ele está rodando ({" "}
          <code className="font-mono text-amber-400">crontab -l | grep SAL_HUB</code> {" "}).
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({
  label, value, icon, subtle, accent,
}: { label: string; value: string; icon?: React.ReactNode; subtle?: string; accent?: "good" | "bad" }) {
  const cor = accent === "good" ? "text-emerald-400" : accent === "bad" ? "text-amber-400" : undefined;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <div className={`mt-2 font-display text-[18px] font-semibold tracking-tight truncate ${cor ?? ""}`}>{value}</div>
        {subtle && <div className="text-[10.5px] text-muted-foreground/60 mt-0.5 truncate">{subtle}</div>}
      </CardContent>
    </Card>
  );
}

function CodeBlock({ content }: { content: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    await navigator.clipboard.writeText(content);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }
  return (
    <div className="relative">
      <pre className="bg-secondary/60 border border-border rounded-md p-3 text-xs overflow-x-auto font-mono leading-relaxed">
        <code>{content}</code>
      </pre>
      <button onClick={copiar} className="absolute top-2 right-2 p-1.5 rounded hover:bg-card transition" aria-label="Copiar">
        {copiado ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function fmtSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `há ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function idadeBadge(iso: string): "success" | "warning" | "muted" {
  const horas = (Date.now() - new Date(iso).getTime()) / 3600_000;
  if (horas < 30) return "success";
  if (horas < 24 * 7) return "warning";
  return "muted";
}
