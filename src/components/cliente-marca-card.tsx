"use client";
/**
 * Marca do cliente (Portal v3 — Fase 1).
 *
 * Card no detalhe do cliente pra subir o LOGO do cliente + escolher uma
 * COR DE ACENTO. O portal usa isso pra white-label leve: mostra a marca
 * do cliente no header em vez do "S" genérico da SAL.
 *
 * Persiste via PATCH /api/clientes/[id] (campos logoUrl + corPrimaria já
 * aceitos pelo clienteSchema). Logo é comprimido client-side pra dataURL
 * (mesma técnica do avatar / identidade da proposta) — PNG preserva
 * transparência; limita a ~256x96 pra não inflar o banco.
 *
 * Sem <style jsx>. A corPrimaria entra via style inline só nos previews
 * (é cor de dado). Mobile-first: alvos de toque, botões h-9/h-7.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { Palette, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COR_SAL = "#7E30E1";

const PRESETS = [
  "#7E30E1", // roxo SAL (default)
  "#10B981", // emerald
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#EC4899", // pink
  "#14B8A6", // teal
  "#EF4444", // red
  "#0F172A", // slate
];

export function ClienteMarcaCard({
  clienteId,
  clienteNome,
  logoUrl: logoInicial,
  corPrimaria: corInicial,
  onChange,
}: {
  clienteId: string;
  clienteNome: string;
  logoUrl: string | null;
  corPrimaria: string | null;
  /** Notifica o pai (ex.: sheet) pra refletir o estado sem refetch. */
  onChange?: (patch: { logoUrl?: string | null; corPrimaria?: string | null }) => void;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(logoInicial);
  const [corPrimaria, setCorPrimaria] = useState<string>(corInicial || COR_SAL);
  const [salvando, setSalvando] = useState(false);
  const [processando, setProcessando] = useState(false);

  async function salvar(patch: { logoUrl?: string | null; corPrimaria?: string | null }) {
    setSalvando(true);
    try {
      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha ao salvar marca");
        return false;
      }
      onChange?.(patch);
      return true;
    } finally {
      setSalvando(false);
    }
  }

  async function escolherLogo(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (PNG, JPG ou WebP)");
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("Imagem grande demais — máximo 2MB");
      return;
    }
    setProcessando(true);
    try {
      const dataUrl = await comprimirLogo(file, 256, 96);
      setLogoUrl(dataUrl);
      const ok = await salvar({ logoUrl: dataUrl });
      if (ok) toast.success("Logo atualizado");
    } catch {
      toast.error("Falha ao processar imagem");
    } finally {
      setProcessando(false);
    }
  }

  async function removerLogo() {
    setLogoUrl(null);
    const ok = await salvar({ logoUrl: null });
    if (ok) toast.success("Logo removido");
  }

  function aplicarCor(cor: string) {
    setCorPrimaria(cor);
    void salvar({ corPrimaria: cor });
  }

  const temCorCustom = corPrimaria.toUpperCase() !== COR_SAL;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-sal-400" />
          <span className="text-sm font-medium">Marca do cliente</span>
          {salvando && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1.5">
          O portal mostra a marca do cliente (logo + acento) no lugar do selo da SAL — sensação de
          área dele, entregue por você.
        </p>

        {/* Logo */}
        <div className="space-y-1.5">
          <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Logo</Label>
          <div className="flex items-center gap-2.5">
            <div className="h-14 w-14 rounded-full border border-border flex items-center justify-center overflow-hidden shrink-0 bg-white">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={clienteNome} className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={processando || salvando}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void escolherLogo(f);
                    e.target.value = "";
                  }}
                />
                <Button asChild size="sm" variant="outline" className="w-full h-9 sm:h-8 text-[12px] touch-feedback">
                  <span>
                    {processando ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5" />
                    )}
                    {logoUrl ? "Trocar logo" : "Enviar logo"}
                  </span>
                </Button>
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={removerLogo}
                  disabled={salvando}
                  className="text-[10.5px] text-destructive hover:underline self-start"
                >
                  Remover logo
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            PNG transparente fica melhor. Redimensiona pra ~256×96px automaticamente.
          </p>
        </div>

        {/* Cor de acento */}
        <div className="space-y-1.5 pt-2 border-t border-border/50">
          <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Cor de acento</Label>
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => aplicarCor(c)}
                className={cn(
                  "h-7 w-7 rounded-md border-2 transition touch-feedback",
                  corPrimaria.toUpperCase() === c ? "border-foreground scale-110" : "border-border"
                )}
                style={{ background: c }}
                title={c === COR_SAL ? "Roxo SAL (padrão)" : c}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={corPrimaria}
              onChange={(e) => aplicarCor(e.target.value)}
              className="h-7 w-12 rounded border border-border cursor-pointer bg-transparent"
              title="Cor personalizada"
              aria-label="Escolher cor personalizada"
            />
            <input
              type="text"
              value={corPrimaria}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                setCorPrimaria(v);
                if (/^#[0-9A-F]{6}$/.test(v)) void salvar({ corPrimaria: v });
              }}
              className="font-mono text-[11px] w-20 rounded border border-border bg-background/40 px-2 py-1"
              maxLength={7}
              aria-label="Hex da cor de acento"
            />
            <span className="text-[10px] text-muted-foreground">
              {temCorCustom ? "acento sutil no header do portal" : "padrão SAL"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Comprime o logo em canvas até maxW × maxH preservando aspect ratio.
 * PNG mantém transparência (logo sobre fundo claro/escuro); senão JPEG 85%.
 * Recodificar via canvas também descarta metadata (mesma defesa do avatar).
 */
async function comprimirLogo(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponível"));
        ctx.drawImage(img, 0, 0, w, h);
        const isPng = file.type === "image/png";
        resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}
