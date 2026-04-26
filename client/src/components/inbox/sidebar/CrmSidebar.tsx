/**
 * CrmSidebar — Right panel with full CRM context for the selected conversation.
 * Orchestrates all dialogs for autonomous CRM operations from the inbox.
 */
import { useState, useCallback } from "react";
import { PanelRightClose } from "lucide-react";
import { trpc } from "@/lib/trpc";
import SidebarSaveContact from "./SidebarSaveContact";
import SidebarContactCard from "./SidebarContactCard";
import SidebarMetrics from "./SidebarMetrics";
import SidebarDeals from "./SidebarDeals";
import SidebarNotes from "./SidebarNotes";
import SidebarCustomFields from "./SidebarCustomFields";
import SidebarTimeline from "./SidebarTimeline";
import ContactDetailDialog from "./ContactDetailDialog";
import DealEditDialog from "./DealEditDialog";
import DealProductsDialog from "./DealProductsDialog";
import DealParticipantsDialog from "./DealParticipantsDialog";
import DealFilesDialog from "./DealFilesDialog";
import MarkDealLostDialog from "./MarkDealLostDialog";

interface CrmSidebarProps {
  open: boolean;
  onToggle: () => void;
  selectedJid: string | null;
  crmContactId: number | null;
  pushName: string | null;
  avatarUrl: string | null;
  onCreateContact: () => void;
  onCreateDeal: () => void;
}

export default function CrmSidebar({
  open, onToggle, selectedJid, crmContactId, pushName, avatarUrl,
  onCreateContact, onCreateDeal,
}: CrmSidebarProps) {
  const phone = selectedJid?.split("@")[0] || "";

  // Dialog states
  const [showContactDetail, setShowContactDetail] = useState(false);
  const [editDealId, setEditDealId] = useState<number | null>(null);
  const [productsDealId, setProductsDealId] = useState<number | null>(null);
  const [participantsDealId, setParticipantsDealId] = useState<number | null>(null);
  const [filesDealId, setFilesDealId] = useState<number | null>(null);
  const [lostDealId, setLostDealId] = useState<number | null>(null);

  // Fetch full contact data when we have a CRM contact
  const contactQ = trpc.crm.contacts.get.useQuery(
    { id: crmContactId! },
    { enabled: !!crmContactId && open, staleTime: 60_000 }
  );
  const contact = contactQ.data as any;

  const utils = trpc.useUtils();
  const handleContactUpdated = useCallback(() => {
    if (crmContactId) utils.crm.contacts.get.invalidate({ id: crmContactId });
  }, [crmContactId, utils]);

  if (!selectedJid) return null;

  return (
    <>
      <div className={`inbox-sidebar-glass scrollbar-thin shrink-0 hidden lg:flex flex-col ${!open ? "collapsed" : ""}`}>
        {/* Header */}
        <div className="inbox-sidebar-header h-[59px] flex items-center justify-between px-4 shrink-0">
          <h3 className="text-[13px] font-semibold text-foreground">Detalhes do Contato</h3>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {!crmContactId || (contactQ.isFetched && !contact) ? (
            /* ═══ Contact NOT in CRM OR deletado/órfão ═══ */
            <SidebarSaveContact
              pushName={pushName}
              phone={phone}
              avatarUrl={avatarUrl}
              onCreateContact={onCreateContact}
              onCreateDeal={onCreateDeal}
            />
          ) : contact ? (
            /* ═══ Contact EXISTS in CRM ═══ */
            <>
              <SidebarContactCard
                contact={{
                  id: contact.id,
                  name: contact.name,
                  email: contact.email,
                  phone: contact.phone || contact.phoneE164,
                  avatarUrl: avatarUrl || contact.avatarUrl,
                  lifecycleStage: contact.lifecycleStage,
                }}
                onUpdated={handleContactUpdated}
                onOpenDetails={() => setShowContactDetail(true)}
              />

              <div className="h-px bg-border/50 mx-4" />
              <SidebarMetrics contactId={crmContactId} />

              <div className="h-px bg-border/50 mx-4" />
              <SidebarDeals
                contactId={crmContactId}
                onCreateDeal={onCreateDeal}
                onEditDeal={(id) => setEditDealId(id)}
                onDealProducts={(id) => setProductsDealId(id)}
                onDealParticipants={(id) => setParticipantsDealId(id)}
                onDealFiles={(id) => setFilesDealId(id)}
                onMarkDealLost={(id) => setLostDealId(id)}
              />

              <div className="h-px bg-border/50 mx-4" />
              <SidebarNotes contactId={crmContactId} />

              <div className="h-px bg-border/50 mx-4" />
              <SidebarCustomFields contactId={crmContactId} />

              <div className="h-px bg-border/50 mx-4" />
              <SidebarTimeline contactId={crmContactId} />

              <div className="h-8" />
            </>
          ) : contactQ.isLoading ? (
            <div className="px-4 pt-5 space-y-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-32" />
                  <div className="h-3 bg-muted rounded w-20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg" />)}
              </div>
              <div className="h-20 bg-muted rounded-lg" />
            </div>
          ) : null}
        </div>
      </div>

      {/* ═══ DIALOGS — rendered outside sidebar for proper z-index ═══ */}
      {crmContactId && (
        <ContactDetailDialog
          open={showContactDetail}
          onClose={() => setShowContactDetail(false)}
          contactId={crmContactId}
        />
      )}
      {editDealId && (
        <DealEditDialog
          open={!!editDealId}
          onClose={() => setEditDealId(null)}
          dealId={editDealId}
        />
      )}
      {productsDealId && (
        <DealProductsDialog
          open={!!productsDealId}
          onClose={() => setProductsDealId(null)}
          dealId={productsDealId}
        />
      )}
      {participantsDealId && (
        <DealParticipantsDialog
          open={!!participantsDealId}
          onClose={() => setParticipantsDealId(null)}
          dealId={participantsDealId}
        />
      )}
      {filesDealId && (
        <DealFilesDialog
          open={!!filesDealId}
          onClose={() => setFilesDealId(null)}
          dealId={filesDealId}
        />
      )}
      {lostDealId && (
        <MarkDealLostDialog
          open={!!lostDealId}
          onClose={() => setLostDealId(null)}
          dealId={lostDealId}
        />
      )}
    </>
  );
}
