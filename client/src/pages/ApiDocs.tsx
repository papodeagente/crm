import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Globe, Send, Wifi, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 overflow-x-auto text-[12px] font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700/50 hover:bg-slate-600 text-slate-300 rounded-lg"
        onClick={() => { navigator.clipboard.writeText(code); toast.success("Copiado!"); }}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  const styles = method === "GET"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return <span className={`inline-flex text-[11px] font-bold px-2.5 py-1 rounded-lg border ${styles}`}>{method}</span>;
}

export default function ApiDocs() {
  const baseUrl = window.location.origin;

  return (
    <div className="p-5 lg:px-8 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Documentação da API</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Endpoints REST para integração externa com o WhatsApp.</p>
      </div>

      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><Globe className="h-4 w-4 text-primary" /></div>
            <p className="text-[14px] font-semibold">URL Base</p>
          </div>
          <CodeBlock code={baseUrl} />
        </div>
      </Card>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList className="bg-muted/30 border-0 rounded-lg p-1">
          <TabsTrigger value="status" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Wifi className="h-3.5 w-3.5" />Status</TabsTrigger>
          <TabsTrigger value="send-text" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Send className="h-3.5 w-3.5" />Enviar Texto</TabsTrigger>
          <TabsTrigger value="send-media" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Code className="h-3.5 w-3.5" />Enviar Mídia</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <Card className="border border-border/40 shadow-none rounded-xl">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <MethodBadge method="GET" />
                <code className="text-[13px] font-mono font-semibold text-foreground">/api/v1/status/:sessionId</code>
              </div>
              <p className="text-[13px] text-muted-foreground">Retorna o status da conexão de uma sessão do WhatsApp.</p>
              <div>
                <p className="text-[12px] font-semibold text-muted-foreground mb-2">Exemplo:</p>
                <CodeBlock code={`curl ${baseUrl}/api/v1/status/minha-sessao`} />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-muted-foreground mb-2">Resposta:</p>
                <CodeBlock code={JSON.stringify({ status: "connected", user: { id: "5511999999999:0@s.whatsapp.net", name: "Meu Nome" } }, null, 2)} />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="send-text">
          <Card className="border border-border/40 shadow-none rounded-xl">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <MethodBadge method="POST" />
                <code className="text-[13px] font-mono font-semibold text-foreground">/api/v1/send-message</code>
              </div>
              <p className="text-[13px] text-muted-foreground">Envia uma mensagem de texto via WhatsApp.</p>
              <div>
                <p className="text-[12px] font-semibold text-muted-foreground mb-2">Body (JSON):</p>
                <CodeBlock code={JSON.stringify({ sessionId: "minha-sessao", number: "5511999999999", message: "Olá!" }, null, 2)} />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-muted-foreground mb-2">Resposta:</p>
                <CodeBlock code={JSON.stringify({ success: true, messageId: "3EB0A1B2C3D4E5F6" }, null, 2)} />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="send-media">
          <Card className="border border-border/40 shadow-none rounded-xl">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <MethodBadge method="POST" />
                <code className="text-[13px] font-mono font-semibold text-foreground">/api/v1/send-media</code>
              </div>
              <p className="text-[13px] text-muted-foreground">Envia mídia (imagem, áudio ou documento) via WhatsApp.</p>
              <div>
                <p className="text-[12px] font-semibold text-muted-foreground mb-2">Body (JSON):</p>
                <CodeBlock code={JSON.stringify({ sessionId: "minha-sessao", number: "5511999999999", mediaUrl: "https://exemplo.com/imagem.jpg", mediaType: "image", caption: "Legenda opcional" }, null, 2)} />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-muted-foreground mb-2">Tipos suportados:</p>
                <div className="flex gap-2">
                  {["image", "audio", "document"].map((t) => (
                    <span key={t} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted/40">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center"><Wifi className="h-4 w-4 text-violet-600" /></div>
            <div>
              <p className="text-[14px] font-semibold">WebSocket (Socket.IO)</p>
              <p className="text-[12px] text-muted-foreground">Eventos em tempo real</p>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-muted-foreground mb-2">Conexão:</p>
            <CodeBlock code={`import { io } from "socket.io-client";\n\nconst socket = io("${baseUrl}", {\n  path: "/api/socket.io",\n  transports: ["websocket", "polling"],\n});`} />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-muted-foreground mb-3">Eventos disponíveis:</p>
            <div className="space-y-2.5">
              {[
                { event: "whatsapp:qr", desc: "Emitido quando um novo QR Code é gerado. Contém sessionId e qrDataUrl." },
                { event: "whatsapp:status", desc: "Emitido quando o status da conexão muda (connected/disconnected)." },
                { event: "whatsapp:message", desc: "Emitido quando uma nova mensagem é recebida ou enviada." },
              ].map((e) => (
                <div key={e.event} className="p-3.5 rounded-xl bg-muted/30 border border-border/20">
                  <code className="text-[12px] font-mono font-semibold text-primary">{e.event}</code>
                  <p className="text-[12px] text-muted-foreground mt-1">{e.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
