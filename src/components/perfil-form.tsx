"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, useSession } from "next-auth/react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Camera, Trash2, KeyRound, Mail, Calendar, Shield, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { formatDate } from "@/lib/utils";

type User = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "ADMIN" | "MEMBER";
  createdAt: string;
  temSenhaLocal: boolean;
  googleConectado: boolean;
};

export function PerfilForm({ user }: { user: User }) {
  const router = useRouter();
  const { update } = useSession();
  const [foto, setFoto] = useState<string | null>(user.image);
  const [nome, setNome] = useState(user.name ?? "");
  const [salvandoInfo, setSalvandoInfo] = useState(false);
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = nome !== (user.name ?? "") || foto !== user.image;

  async function escolherArquivo(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (JPG, PNG ou WebP)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máx 8 MB.");
      return;
    }
    setCarregandoFoto(true);
    try {
      const dataUrl = await comprimirImagem(file, 256, 0.85);
      setFoto(dataUrl);
    } catch (e) {
      toast.error("Não foi possível processar a imagem");
      console.error(e);
    } finally {
      setCarregandoFoto(false);
    }
  }

  async function salvarInfo() {
    setSalvandoInfo(true);
    const res = await fetch("/api/user/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nome.trim(), image: foto }),
    });
    setSalvandoInfo(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao salvar");
      return;
    }
    toast.success("Perfil atualizado");
    // Foto NÃO vai pro JWT (cookie tem limite ~4KB, dataURL grande estoura → erro 431).
    // Atualizamos só o nome na sessão; o avatar é re-buscado do banco no próximo render.
    await update({ name: nome.trim() });
    router.refresh();
  }

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-5 max-w-5xl">
      {/* Coluna esquerda: avatar + meta */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) escolherArquivo(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={carregandoFoto}
              className="relative h-32 w-32 rounded-full overflow-hidden flex items-center justify-center group transition shrink-0"
              style={{
                background: foto ? "transparent" : "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)",
                boxShadow: "0 8px 24px rgba(126,48,225,0.35)",
              }}
              aria-label="Trocar foto"
            >
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt={nome || user.email} className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-4xl font-semibold text-white">
                  {(nome || user.email).charAt(0).toUpperCase()}
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </button>

            <div className="mt-4 space-y-1 w-full">
              <div className="font-display font-semibold text-[16px] truncate">{nome || "Sem nome"}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>

            <div className="flex items-center justify-center gap-2 mt-3">
              <Badge variant={user.role === "ADMIN" ? "success" : "muted"} className="text-[10px]">
                <Shield className="h-2.5 w-2.5 mr-1" />{user.role}
              </Badge>
              {user.googleConectado && (
                <Badge variant="info" className="text-[10px]">Google conectado</Badge>
              )}
            </div>

            <div className="flex gap-1.5 mt-4 w-full">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => fileRef.current?.click()}
                disabled={carregandoFoto}
              >
                <Camera className="h-3.5 w-3.5" />
                {carregandoFoto ? "Processando..." : foto ? "Trocar" : "Adicionar foto"}
              </Button>
              {foto && (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setFoto(null)}
                  title="Remover foto"
                  className="shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <p className="text-[10.5px] text-muted-foreground/70 mt-2">
              JPG, PNG ou WebP — redimensiona para 256px automaticamente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3 text-[12.5px]">
            <Linha icon={<Mail className="h-3.5 w-3.5" />} label="Email" valor={user.email} />
            <Linha icon={<Calendar className="h-3.5 w-3.5" />} label="Conta criada" valor={formatDate(user.createdAt)} />
          </CardContent>
        </Card>
      </div>

      {/* Coluna direita: formulários */}
      <div className="space-y-5">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <div className="font-display font-semibold text-[15px]">Informações pessoais</div>
              <div className="text-xs text-muted-foreground mt-0.5">Como você aparece no Hub</div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={user.email} disabled className="opacity-70" />
                <p className="text-[10.5px] text-muted-foreground/70">Email não pode ser alterado pela UI por questões de segurança.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              {dirty && (
                <Button
                  variant="outline"
                  onClick={() => { setNome(user.name ?? ""); setFoto(user.image); }}
                >
                  Descartar
                </Button>
              )}
              <Button onClick={salvarInfo} disabled={!dirty || salvandoInfo}>
                {salvandoInfo ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <SenhaForm temSenhaLocal={user.temSenhaLocal} />

        {!user.googleConectado && (
          <Card style={{ borderColor: "rgba(126,48,225,0.3)" }}>
            <CardContent className="p-5 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-sal-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-[13px]">Google não conectado</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Para usar Drive e Agenda, conecte sua conta Google fazendo login com Google.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => signIn("google", { callbackUrl: "/perfil" })}>
                Conectar Google
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Linha({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="ml-auto font-medium truncate">{valor}</span>
    </div>
  );
}

/* ─────────────────── TROCA DE SENHA ─────────────────── */

const senhaSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z.string().min(8, "Mínimo 8 caracteres").max(120),
  confirmar: z.string(),
}).refine((d) => d.novaSenha === d.confirmar, { message: "As senhas não coincidem", path: ["confirmar"] });

type SenhaInput = z.infer<typeof senhaSchema>;

function SenhaForm({ temSenhaLocal }: { temSenhaLocal: boolean }) {
  const [verAtual, setVerAtual] = useState(false);
  const [verNova, setVerNova] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<SenhaInput>({
    resolver: zodResolver(senhaSchema),
    defaultValues: { senhaAtual: "", novaSenha: "", confirmar: "" },
  });

  const novaSenha = watch("novaSenha");
  const forca = forcaSenha(novaSenha ?? "");

  async function onSubmit(values: SenhaInput) {
    setTrocandoSenha(true);
    const res = await fetch("/api/user/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senhaAtual: values.senhaAtual, novaSenha: values.novaSenha }),
    });
    setTrocandoSenha(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao trocar senha");
      return;
    }
    toast.success("Senha alterada com sucesso");
    reset();
  }

  if (!temSenhaLocal) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="font-display font-semibold text-[15px] flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Senha de acesso
          </div>
          <p className="text-sm text-muted-foreground">
            Sua conta atualmente entra apenas via Google. Não há senha local para trocar. Caso queira definir uma,
            peça a um administrador para criar via console do Prisma.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <div className="font-display font-semibold text-[15px] flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Trocar senha
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Mínimo 8 caracteres. Use uma senha única e forte.</div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Senha atual</Label>
            <div className="relative">
              <Input type={verAtual ? "text" : "password"} {...register("senhaAtual")} className="pr-10" autoComplete="current-password" />
              <button
                type="button"
                onClick={() => setVerAtual(!verAtual)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={verAtual ? "Ocultar" : "Mostrar"}
              >
                {verAtual ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {errors.senhaAtual && <p className="text-[11px] text-destructive">{errors.senhaAtual.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <div className="relative">
              <Input type={verNova ? "text" : "password"} {...register("novaSenha")} className="pr-10" autoComplete="new-password" />
              <button
                type="button"
                onClick={() => setVerNova(!verNova)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={verNova ? "Ocultar" : "Mostrar"}
              >
                {verNova ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {errors.novaSenha && <p className="text-[11px] text-destructive">{errors.novaSenha.message}</p>}
            {(novaSenha?.length ?? 0) > 0 && <ForcaBar forca={forca} />}
          </div>

          <div className="space-y-1.5">
            <Label>Confirmar nova senha</Label>
            <Input type={verNova ? "text" : "password"} {...register("confirmar")} autoComplete="new-password" />
            {errors.confirmar && <p className="text-[11px] text-destructive">{errors.confirmar.message}</p>}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={trocandoSenha}>
              {trocandoSenha ? "Alterando..." : <><Check className="h-3.5 w-3.5" /> Alterar senha</>}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ForcaBar({ forca }: { forca: { score: number; label: string; cor: string } }) {
  return (
    <div className="space-y-1">
      <div className="flex gap-1 h-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-colors"
            style={{ background: i < forca.score ? forca.cor : "hsl(var(--secondary))" }}
          />
        ))}
      </div>
      <p className="text-[10.5px] text-muted-foreground" style={{ color: forca.cor }}>{forca.label}</p>
    </div>
  );
}

function forcaSenha(s: string): { score: number; label: string; cor: string } {
  let score = 0;
  if (s.length >= 8) score++;
  if (s.length >= 12) score++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++;
  if (/[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s)) score++;
  const niveis = [
    { label: "Fraca", cor: "#EF4444" },
    { label: "Razoável", cor: "#F59E0B" },
    { label: "Boa", cor: "#10B981" },
    { label: "Forte", cor: "#7E30E1" },
  ];
  return { score, ...(niveis[Math.max(0, score - 1)] ?? niveis[0]) };
}

/* ─────────────────── COMPRESSÃO DE IMAGEM ─────────────────── */

/**
 * Carrega arquivo, redimensiona para `maxSize` x `maxSize` e exporta JPEG.
 * Recodifica via canvas — qualquer payload em metadata é descartado (defesa contra imagens com EXIF malicioso).
 */
function comprimirImagem(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponível"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}
