import { MessageSquare, Phone, Lock } from "lucide-react";

export function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-background">
      <div className="text-center max-w-[500px] px-8">
        <div className="w-[320px] h-[188px] mx-auto mb-[28px] rounded-full bg-primary/5 flex items-center justify-center">
          <MessageSquare className="w-16 h-16 text-primary/40" />
        </div>
        <h1 className="text-[32px] font-light leading-tight mb-[14px] text-foreground">
          Entur WhatsApp
        </h1>
        <p className="text-[14px] leading-[20px] text-muted-foreground">
          Envie e receba mensagens sem precisar manter o celular conectado.
          <br />
          Use em até 4 aparelhos vinculados e 1 celular ao mesmo tempo.
        </p>
        <div className="mt-[40px] pt-[16px]">
          <p className="text-[13px] flex items-center justify-center gap-[6px] text-muted-foreground/60">
            <Lock className="w-[13px] h-[13px]" />
            Suas mensagens pessoais são protegidas com criptografia de ponta a ponta
          </p>
        </div>
      </div>
    </div>
  );
}

export function NoSession() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-xl font-medium text-foreground mb-2">WhatsApp não conectado</h2>
        <p className="text-[14px] text-muted-foreground mb-4">
          Conecte seu WhatsApp para enviar e receber mensagens diretamente pelo sistema.
        </p>
        <a href="/whatsapp"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all">
          <Phone className="w-4 h-4" />
          Conectar WhatsApp
        </a>
      </div>
    </div>
  );
}
