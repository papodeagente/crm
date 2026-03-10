import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  Trash2,
  User,
  Lock,
  Calendar,
  Mail,
  Shield,
  Check,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Unlink,
} from "lucide-react";

export default function Profile() {
  const [, setLocation] = useLocation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ───
  const { data: profile, isLoading, refetch } = trpc.profile.getProfile.useQuery();

  // ─── Profile Update ───
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const updateProfile = trpc.profile.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado — suas informações foram salvas.");
      setIsEditingProfile(false);
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const startEditProfile = useCallback(() => {
    if (profile) {
      setEditName(profile.name);
      setEditPhone(profile.phone || "");
      setIsEditingProfile(true);
    }
  }, [profile]);

  // ─── Avatar ───
  const uploadAvatar = trpc.profile.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Foto de perfil atualizada.");
      refetch();
    },
    onError: (err) => toast.error(`Erro ao enviar foto: ${err.message}`),
  });

  const removeAvatar = trpc.profile.removeAvatar.useMutation({
    onSuccess: () => {
      toast.success("Foto removida.");
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande — a imagem deve ter no máximo 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadAvatar.mutate({ base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadAvatar]);

  // ─── Password ───
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const changePassword = trpc.profile.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso.");
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handlePasswordSubmit = useCallback(() => {
    if (newPassword !== confirmPassword) {
      toast.error("Senhas não conferem — a nova senha e a confirmação devem ser iguais.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Senha muito curta — deve ter pelo menos 6 caracteres.");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  }, [currentPassword, newPassword, confirmPassword, changePassword]);

  // ─── Google Calendar ───
  const connectGCal = trpc.profile.connectGoogleCalendar.useMutation({
    onSuccess: () => {
      toast.success("Google Calendar conectado.");
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const disconnectGCal = trpc.profile.disconnectGoogleCalendar.useMutation({
    onSuccess: () => {
      toast.success("Google Calendar desconectado.");
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleConnectGoogleCalendar = useCallback(() => {
    // Google OAuth2 flow — redirect to Google consent screen
    const clientId = (window as any).__GOOGLE_CALENDAR_CLIENT_ID;
    if (!clientId) {
      toast.error("O Google Calendar Client ID não está configurado. Entre em contato com o administrador.");
      return;
    }
    const redirectUri = `${window.location.origin}/api/google-calendar/callback`;
    const scope = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events";
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    window.location.href = url;
  }, [toast]);

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Não foi possível carregar o perfil.</p>
      </div>
    );
  }

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
            <p className="text-muted-foreground text-sm">Gerencie suas informações pessoais e integrações</p>
          </div>
        </div>

        {/* ═══ AVATAR SECTION ═══ */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="h-5 w-5 text-primary" />
              Foto de Perfil
            </CardTitle>
            <CardDescription>Sua foto será exibida no sistema e nas conversas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Avatar Preview */}
              <div className="relative group">
                <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-semibold text-muted-foreground">{initials}</span>
                  )}
                </div>
                {/* Overlay on hover */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  <Camera className="h-6 w-6 text-white" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadAvatar.isPending}
                  >
                    {uploadAvatar.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
                    Alterar foto
                  </Button>
                  {profile.avatarUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAvatar.mutate()}
                      disabled={removeAvatar.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      {removeAvatar.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP ou GIF. Máximo 5MB.</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* ═══ PERSONAL INFO SECTION ═══ */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-primary" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription>Seus dados de identificação no sistema</CardDescription>
              </div>
              {!isEditingProfile && (
                <Button variant="outline" size="sm" onClick={startEditProfile}>
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingProfile ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome completo</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Telefone</Label>
                  <Input
                    id="edit-phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                    <Mail className="h-4 w-4" />
                    {profile.email}
                    <Badge variant="outline" className="ml-auto text-xs">Não editável</Badge>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => updateProfile.mutate({ name: editName, phone: editPhone || undefined })}
                    disabled={updateProfile.isPending || editName.length < 2}
                    size="sm"
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nome</p>
                    <p className="font-medium">{profile.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Email</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {profile.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Telefone</p>
                    <p className="font-medium">{profile.phone || "Não informado"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Permissão</p>
                    <Badge variant={profile.role === "admin" ? "default" : "secondary"} className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      {profile.role === "admin" ? "Administrador" : "Usuário"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Membro desde</p>
                  <p className="text-sm">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ PASSWORD SECTION ═══ */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5 text-primary" />
                  Senha de Acesso
                </CardTitle>
                <CardDescription>Altere sua senha de login</CardDescription>
              </div>
              {!showPasswordForm && (
                <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>
                  Alterar senha
                </Button>
              )}
            </div>
          </CardHeader>
          {showPasswordForm && (
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-pw">Senha atual</Label>
                  <div className="relative">
                    <Input
                      id="current-pw"
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Digite sua senha atual"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-pw">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-pw"
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pw">Confirmar nova senha</Label>
                  <Input
                    id="confirm-pw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">As senhas não conferem</p>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handlePasswordSubmit}
                    disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                    size="sm"
                  >
                    {changePassword.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Alterar senha
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ═══ GOOGLE CALENDAR SECTION ═══ */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Google Calendar
            </CardTitle>
            <CardDescription>
              Conecte sua conta do Google para sincronizar eventos e compromissos com o CRM
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile.googleCalendar.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-green-800 dark:text-green-200">Conectado</p>
                    {profile.googleCalendar.email && (
                      <p className="text-sm text-green-600 dark:text-green-400">{profile.googleCalendar.email}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectGCal.mutate()}
                    disabled={disconnectGCal.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    {disconnectGCal.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Unlink className="h-4 w-4 mr-2" />
                    )}
                    Desconectar
                  </Button>
                </div>
                {profile.googleCalendar.connectedAt && (
                  <p className="text-xs text-muted-foreground">
                    Conectado em {new Date(profile.googleCalendar.connectedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Não conectado</p>
                    <p className="text-sm text-muted-foreground">Conecte para ver seus compromissos no CRM</p>
                  </div>
                </div>
                <Button onClick={handleConnectGoogleCalendar} className="w-full sm:w-auto">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Conectar Google Calendar
                </Button>
                <p className="text-xs text-muted-foreground">
                  Ao conectar, você autoriza o acesso somente leitura aos seus eventos do Google Calendar.
                  Você pode desconectar a qualquer momento.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <div className="text-center text-xs text-muted-foreground pb-8">
          ID do usuário: {profile.id} &middot; Tenant: {profile.tenantId}
        </div>
      </div>
    </div>
  );
}
