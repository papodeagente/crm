import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import TopNavLayout from "./components/TopNavLayout";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy load pages
const Home = lazy(() => import("./pages/Home"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Deals = lazy(() => import("./pages/Deals"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Trips = lazy(() => import("./pages/Trips"));
const Tasks = lazy(() => import("./pages/Tasks"));
const InboxPage = lazy(() => import("./pages/Inbox"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const Chatbot = lazy(() => import("./pages/Chatbot"));
const Proposals = lazy(() => import("./pages/Proposals"));
const Portal = lazy(() => import("./pages/Portal"));
const Insights = lazy(() => import("./pages/Insights"));
const Goals = lazy(() => import("./pages/Goals"));
const Academy = lazy(() => import("./pages/Academy"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Admin = lazy(() => import("./pages/Admin"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const DealDetail = lazy(() => import("./pages/DealDetail"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const AgentManagement = lazy(() => import("./pages/AgentManagement"));
const NotificationsPage = lazy(() => import("./pages/Notifications"));
const ContactProfile = lazy(() => import("./pages/ContactProfile"));
const CustomFieldsSettings = lazy(() => import("./pages/CustomFieldsSettings"));
const PipelineSettings = lazy(() => import("./pages/PipelineSettings"));
const ProductCatalog = lazy(() => import("./pages/ProductCatalog"));
const ProductReports = lazy(() => import("./pages/ProductReports"));
const ConversationDebug = lazy(() => import("./pages/ConversationDebug"));
const SourcesAndCampaigns = lazy(() => import("./pages/SourcesAndCampaigns"));
const LossReasons = lazy(() => import("./pages/LossReasons"));
const RDStationIntegration = lazy(() => import("./pages/RDStationIntegration"));
const RDFieldMappings = lazy(() => import("./pages/RDFieldMappings"));
const RDCrmImport = lazy(() => import("./pages/RDCrmImport"));

// SaaS pages (outside TopNavLayout)
const SaasLogin = lazy(() => import("./pages/SaasLogin"));
const SaasRegister = lazy(() => import("./pages/SaasRegister"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const Landing = lazy(() => import("./pages/Landing"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* SaaS public pages (no TopNavLayout) */}
        <Route path="/landing" component={Landing} />
        <Route path="/login" component={SaasLogin} />
        <Route path="/register" component={SaasRegister} />
        <Route path="/upgrade" component={Upgrade} />
        <Route path="/super-admin" component={SuperAdmin} />

        {/* App pages (with TopNavLayout) */}
        <Route>
          <TopNavLayout>
            <Suspense fallback={<PageLoader />}>
              <Switch>
                {/* Main nav */}
                <Route path="/" component={Home} />
                <Route path="/pipeline" component={Pipeline} />
                <Route path="/contacts" component={Contacts} />
                <Route path="/tasks" component={Tasks} />
                <Route path="/insights" component={Insights} />
                <Route path="/goals" component={Goals} />

                {/* Detail pages */}
                <Route path="/deal/:id" component={DealDetail} />
                <Route path="/deals" component={Deals} />

                {/* Settings sub-pages */}
                <Route path="/settings" component={SettingsPage} />
                <Route path="/settings/agents" component={AgentManagement} />
                <Route path="/settings/custom-fields" component={CustomFieldsSettings} />
                <Route path="/settings/pipelines" component={PipelineSettings} />
                <Route path="/settings/products" component={ProductCatalog} />
                <Route path="/analytics/products" component={ProductReports} />
                <Route path="/contact/:id" component={ContactProfile} />
                <Route path="/inbox" component={InboxPage} />
                <Route path="/whatsapp" component={WhatsApp} />
                <Route path="/chatbot" component={Chatbot} />
                <Route path="/proposals" component={Proposals} />
                <Route path="/portal" component={Portal} />
                <Route path="/trips" component={Trips} />
                <Route path="/academy" component={Academy} />
                <Route path="/integrations" component={Integrations} />
                <Route path="/admin" component={Admin} />
                <Route path="/api-docs" component={ApiDocs} />
                <Route path="/settings/conversation-debug" component={ConversationDebug} />
                <Route path="/settings/sources" component={SourcesAndCampaigns} />
                <Route path="/settings/loss-reasons" component={LossReasons} />
                <Route path="/settings/rdstation" component={RDStationIntegration} />
                <Route path="/settings/rdstation/mappings" component={RDFieldMappings} />
                <Route path="/settings/import-rd-crm" component={RDCrmImport} />

                {/* Notifications */}
                <Route path="/notifications" component={NotificationsPage} />

                <Route path="/404" component={NotFound} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </TopNavLayout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
