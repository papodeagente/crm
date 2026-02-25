import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { Wifi, WifiOff, QrCode, Plus, Trash2, RefreshCw, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";

export default function Home() {
  const { user } = useAuth();
  const { qrData, waStatus } = useSocket();
  const [newSessionId, setNewSessionId] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const sessionsQuery = trpc.whatsapp.sessions.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const statusQuery = trpc.whatsapp.status.useQuery(
    { sessionId: activeSessionId || "" },
    { enabled: !!activeSessionId, refetchInterval: 3000 }
  );

  const connectMutation = trpc.whatsapp.connect.useMutation({
    onSuccess: (data) => {
      setActiveSessionId(data.sessionId);
      sessionsQuery.refetch();
    },
  });

  const disconnectMutation = trpc.whatsapp.disconnect.useMutation({
    onSuccess: () => {
      sessionsQuery.refetch();
    },
  });

  const handleConnect = () => {
    const sid = newSessionId.trim() || `session-${Date.now()}`;
    setActiveSessionId(sid);
    connectMutation.mutate({ sessionId: sid });
    setNewSessionId("");
  };

  // Update QR from socket events
  const currentQr = qrData?.sessionId === activeSessionId ? qrData?.qrDataUrl : statusQuery.data?.qrDataUrl;
  const currentStatus = waStatus?.sessionId === activeSessionId ? waStatus?.status : statusQuery.data?.status || "disconnected";
  const currentUser = waStatus?.sessionId === activeSessionId ? waStatus?.user : statusQuery.data?.user;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas conexões do WhatsApp</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Sessões Ativas</CardDescription>
              <CardTitle className="text-3xl">
                {sessionsQuery.data?.filter((s) => s.liveStatus === "connected").length || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                de {sessionsQuery.data?.length || 0} sessões totais
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Status da Conexão</CardDescription>
              <CardTitle className="flex items-center gap-2">
                {currentStatus === "connected" ? (
                  <>
                    <Wifi className="h-5 w-5 text-primary" />
                    <span className="text-primary">Conectado</span>
                  </>
                ) : currentStatus === "connecting" ? (
                  <>
                    <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />
                    <span className="text-yellow-500">Conectando...</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-5 w-5 text-destructive" />
                    <span className="text-destructive">Desconectado</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentUser && (
                <p className="text-xs text-muted-foreground">
                  {currentUser.name || currentUser.id}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Usuário Logado</CardDescription>
              <CardTitle className="text-lg truncate">{user?.name || "N/A"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
            </CardContent>
          </Card>
        </div>

        {/* Connect New Session */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nova Conexão
            </CardTitle>
            <CardDescription>
              Crie uma nova sessão do WhatsApp ou reconecte uma existente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="ID da sessão (ex: minha-sessao)"
                value={newSessionId}
                onChange={(e) => setNewSessionId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
              <Button
                onClick={handleConnect}
                disabled={connectMutation.isPending}
                className="shrink-0"
              >
                {connectMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <QrCode className="h-4 w-4 mr-2" />
                )}
                Conectar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Code Display */}
        {currentQr && currentStatus !== "connected" && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Escaneie o QR Code
              </CardTitle>
              <CardDescription>
                Abra o WhatsApp no seu celular, vá em Configurações &gt; Aparelhos Conectados &gt; Conectar um aparelho
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <div className="bg-white p-4 rounded-xl shadow-lg">
                <img src={currentQr} alt="QR Code WhatsApp" className="w-64 h-64" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Sessions List */}
        {sessionsQuery.data && sessionsQuery.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sessões</CardTitle>
              <CardDescription>Todas as sessões do WhatsApp registradas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sessionsQuery.data.map((session) => (
                  <div
                    key={session.sessionId}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          session.liveStatus === "connected"
                            ? "bg-primary"
                            : session.liveStatus === "connecting"
                            ? "bg-yellow-500 animate-pulse"
                            : "bg-muted-foreground/30"
                        }`}
                      />
                      <div>
                        <p className="font-medium text-sm">{session.sessionId}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.pushName || session.phoneNumber || "Sem informações"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={session.liveStatus === "connected" ? "default" : "secondary"}
                      >
                        {session.liveStatus === "connected"
                          ? "Conectado"
                          : session.liveStatus === "connecting"
                          ? "Conectando"
                          : "Desconectado"}
                      </Badge>
                      {session.liveStatus !== "connected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveSessionId(session.sessionId);
                            connectMutation.mutate({ sessionId: session.sessionId });
                          }}
                          disabled={connectMutation.isPending}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                      {session.liveStatus === "connected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => disconnectMutation.mutate({ sessionId: session.sessionId })}
                          disabled={disconnectMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
