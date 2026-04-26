/**
 * SidebarSaveContact — Prompt to save WhatsApp contact as CRM contact
 */
import { UserPlus, Briefcase } from "lucide-react";
import PhoneDisplay from "@/components/ui/PhoneDisplay";
import { WaAvatar } from "@/components/inbox/ConversationItem";

interface SidebarSaveContactProps {
  pushName: string | null;
  phone: string;
  avatarUrl?: string | null;
  onCreateContact: () => void;
  onCreateDeal: () => void;
}

export default function SidebarSaveContact({
  pushName, phone, avatarUrl, onCreateContact, onCreateDeal,
}: SidebarSaveContactProps) {
  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-4 gap-4">
      {/* Avatar — same WaAvatar as conversation list */}
      <div className="relative">
        <WaAvatar name={pushName || phone} size={64} pictureUrl={avatarUrl} />
      </div>

      {/* Name & Phone with flag */}
      <div className="text-center">
        <p className="text-[15px] font-semibold text-foreground">{pushName || "Contato"}</p>
        <div className="mt-1 flex items-center justify-center">
          <PhoneDisplay phone={phone} size="sm" />
        </div>
      </div>

      {/* Badge */}
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        Não cadastrado no CRM
      </span>

      {/* Actions */}
      <div className="w-full flex flex-col gap-2 mt-2">
        <button
          onClick={onCreateContact}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #600FED, #8B5CF6)" }}
        >
          <UserPlus className="w-4 h-4" />
          Salvar como Passageiro
        </button>
        <button
          onClick={onCreateDeal}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium text-foreground bg-accent hover:bg-accent/80 border border-border transition-all active:scale-[0.98]"
        >
          <Briefcase className="w-4 h-4" />
          Criar Negociação
        </button>
      </div>
    </div>
  );
}
