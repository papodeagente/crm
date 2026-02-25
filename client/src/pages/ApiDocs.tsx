import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Globe, Send, Wifi } from "lucide-react";

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  return (
    <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm font-mono">
      <code>{code}</code>
    </pre>
  );
}

export default function ApiDocs() {
  const baseUrl = window.location.origin;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentação da API</h1>
          <p className="text-muted-foreground mt-1">
            Endpoints REST para integração externa com o WhatsApp
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              URL Base
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={baseUrl} />
          </CardContent>
        </Card>

        <Tabs defaultValue="status">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="send-text">Enviar Texto</TabsTrigger>
            <TabsTrigger value="send-media">Enviar Mídia</TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">GET</Badge>
                  <CardTitle className="text-base font-mono">/api/v1/status/:sessionId</CardTitle>
                </div>
                <CardDescription>Retorna o status da conexão de uma sessão do WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Exemplo de requisição:</p>
                  <CodeBlock
                    code={`curl ${baseUrl}/api/v1/status/minha-sessao`}
                    language="bash"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Resposta:</p>
                  <CodeBlock
                    code={JSON.stringify(
                      {
                        status: "connected",
                        user: {
                          id: "5511999999999:0@s.whatsapp.net",
                          name: "Meu Nome",
                        },
                      },
                      null,
                      2
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="send-text">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">POST</Badge>
                  <CardTitle className="text-base font-mono">/api/v1/send-message</CardTitle>
                </div>
                <CardDescription>Envia uma mensagem de texto via WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Body (JSON):</p>
                  <CodeBlock
                    code={JSON.stringify(
                      {
                        sessionId: "minha-sessao",
                        number: "5511999999999",
                        message: "Olá! Esta é uma mensagem de teste.",
                      },
                      null,
                      2
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Exemplo com cURL:</p>
                  <CodeBlock
                    code={`curl -X POST ${baseUrl}/api/v1/send-message \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "minha-sessao",
    "number": "5511999999999",
    "message": "Olá! Esta é uma mensagem de teste."
  }'`}
                    language="bash"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Resposta:</p>
                  <CodeBlock
                    code={JSON.stringify(
                      {
                        success: true,
                        messageId: "3EB0A1B2C3D4E5F6",
                      },
                      null,
                      2
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="send-media">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">POST</Badge>
                  <CardTitle className="text-base font-mono">/api/v1/send-media</CardTitle>
                </div>
                <CardDescription>Envia mídia (imagem, áudio ou documento) via WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Body (JSON):</p>
                  <CodeBlock
                    code={JSON.stringify(
                      {
                        sessionId: "minha-sessao",
                        number: "5511999999999",
                        mediaUrl: "https://exemplo.com/imagem.jpg",
                        mediaType: "image",
                        caption: "Legenda da imagem (opcional)",
                        fileName: "documento.pdf (apenas para tipo document)",
                      },
                      null,
                      2
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Tipos de mídia suportados:</p>
                  <div className="flex gap-2">
                    <Badge variant="secondary">image</Badge>
                    <Badge variant="secondary">audio</Badge>
                    <Badge variant="secondary">document</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Resposta:</p>
                  <CodeBlock
                    code={JSON.stringify(
                      {
                        success: true,
                        messageId: "3EB0A1B2C3D4E5F6",
                      },
                      null,
                      2
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              WebSocket (Socket.IO)
            </CardTitle>
            <CardDescription>Eventos em tempo real via Socket.IO</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Conexão:</p>
              <CodeBlock
                code={`import { io } from "socket.io-client";

const socket = io("${baseUrl}", {
  path: "/api/socket.io",
  transports: ["websocket", "polling"],
});`}
                language="javascript"
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Eventos disponíveis:</p>
              <div className="space-y-3">
                <div className="p-3 rounded-lg border">
                  <code className="text-sm font-mono text-primary">whatsapp:qr</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Emitido quando um novo QR Code é gerado. Contém sessionId e qrDataUrl.
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <code className="text-sm font-mono text-primary">whatsapp:status</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Emitido quando o status da conexão muda (connected/disconnected).
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <code className="text-sm font-mono text-primary">whatsapp:message</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Emitido quando uma nova mensagem é recebida ou enviada.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
