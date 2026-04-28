import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import TopNavLayout from "./components/TopNavLayout";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { lazyWithRetry } from "./lib/lazyWithRetry";

// Lazy load pages with automatic retry on chunk load failure
const Home = lazyWithRetry(() => import("./pages/Home"));
const Contacts = lazyWithRetry(() => import("./pages/Contacts"));
const Deals = lazyWithRetry(() => import("./pages/Deals"));
const Pipeline = lazyWithRetry(() => import("./pages/Pipeline"));
const ServiceDelivery = lazyWithRetry(() => import("./pages/ServiceDelivery"));
const Tasks = lazyWithRetry(() => import("./pages/Tasks"));
const InboxPage = lazyWithRetry(() => import("./pages/Inbox"));
const WhatsApp = lazyWithRetry(() => import("./pages/WhatsApp"));
const Agentes = lazyWithRetry(() => import("./pages/Agentes"));
const Proposals = lazyWithRetry(() => import("./pages/Proposals"));
const Portal = lazyWithRetry(() => import("./pages/Portal"));
const Insights = lazyWithRetry(() => import("./pages/Insights"));
const Goals = lazyWithRetry(() => import("./pages/Goals"));
const Academy = lazyWithRetry(() => import("./pages/Academy"));
const Integrations = lazyWithRetry(() => import("./pages/Integrations"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const ApiDocs = lazyWithRetry(() => import("./pages/ApiDocs"));
const DealDetail = lazyWithRetry(() => import("./pages/DealDetail"));
const SettingsPage = lazyWithRetry(() => import("./pages/Settings"));
const AgentManagement = lazyWithRetry(() => import("./pages/AgentManagement"));
const NotificationsPage = lazyWithRetry(() => import("./pages/Notifications"));
const ContactProfile = lazyWithRetry(() => import("./pages/ContactProfile"));
const CustomFieldsSettings = lazyWithRetry(() => import("./pages/CustomFieldsSettings"));
const PipelineSettings = lazyWithRetry(() => import("./pages/PipelineSettings"));
const ProductCatalog = lazyWithRetry(() => import("./pages/ProductCatalog"));
const ProductReports = lazyWithRetry(() => import("./pages/ProductReports"));
const ConversationDebug = lazyWithRetry(() => import("./pages/ConversationDebug"));
const SourcesAndCampaigns = lazyWithRetry(() => import("./pages/SourcesAndCampaigns"));
const LossReasons = lazyWithRetry(() => import("./pages/LossReasons"));
const RDStationIntegration = lazyWithRetry(() => import("./pages/RDStationIntegration"));
const RDFieldMappings = lazyWithRetry(() => import("./pages/RDFieldMappings"));
const RDCrmImport = lazyWithRetry(() => import("./pages/RDCrmImport"));
const TaskAutomationSettings = lazyWithRetry(() => import("./pages/TaskAutomationSettings"));
const ClassificationSettings = lazyWithRetry(() => import("./pages/ClassificationSettings"));
const DateAutomationSettings = lazyWithRetry(() => import("./pages/DateAutomationSettings"));
const StageOwnerRuleSettings = lazyWithRetry(() => import("./pages/StageOwnerRuleSettings"));
const SalesAutomationHub = lazyWithRetry(() => import("./pages/SalesAutomationHub"));
const AiTrainingSettings = lazyWithRetry(() => import("./pages/AiTrainingSettings"));
const BrandingSettings = lazyWithRetry(() => import("./pages/BrandingSettings"));
const RfvMatrix = lazyWithRetry(() => import("./pages/RfvMatrix"));
const BirthdayCalendar = lazyWithRetry(() => import("./pages/BirthdayCalendar"));
const Campaigns = lazyWithRetry(() => import("./pages/Campaigns"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const CampaignDetail = lazyWithRetry(() => import("./pages/CampaignDetail"));
const Supervision = lazyWithRetry(() => import("./pages/Supervision"));
const Trash = lazyWithRetry(() => import("./pages/Trash"));
const CustomMessages = lazyWithRetry(() => import("./pages/CustomMessages"));
const Agenda = lazyWithRetry(() => import("./pages/Agenda"));
const Referrals = lazyWithRetry(() => import("./pages/Referrals"));
const Analytics = lazyWithRetry(() => import("./pages/Analytics"));
const RecurrenceDashboard = lazyWithRetry(() => import("./pages/RecurrenceDashboard"));
const GoalsReport = lazyWithRetry(() => import("./pages/GoalsReport"));
const CRMLive = lazyWithRetry(() => import("./pages/CRMLive"));
const SourcesCampaignsReport = lazyWithRetry(() => import("./pages/SourcesCampaignsReport"));
const PostSaleReport = lazyWithRetry(() => import("./pages/PostSaleReport"));
const SupportReport = lazyWithRetry(() => import("./pages/SupportReport"));

// SaaS pages (outside TopNavLayout)
const SaasLogin = lazyWithRetry(() => import("./pages/SaasLogin"));
const SaasRegister = lazyWithRetry(() => import("./pages/SaasRegister"));
const Upgrade = lazyWithRetry(() => import("./pages/Upgrade"));
const Landing = lazyWithRetry(() => import("./pages/Landing"));
const SuperAdmin = lazyWithRetry(() => import("./pages/SuperAdmin"));
const SaasBillingDashboard = lazyWithRetry(() => import("./pages/SaasBillingDashboard"));
const ZapiAdmin = lazyWithRetry(() => import("./pages/ZapiAdmin"));
const SuperAdminDashboard = lazyWithRetry(() => import("./pages/SuperAdminDashboard"));
const SuperAdminTenants = lazyWithRetry(() => import("./pages/SuperAdminTenants"));
const SuperAdminTenantDetail = lazyWithRetry(() => import("./pages/SuperAdminTenantDetail"));
const SuperAdminAdoption = lazyWithRetry(() => import("./pages/SuperAdminAdoption"));
const SuperAdminHealth = lazyWithRetry(() => import("./pages/SuperAdminHealth"));
const SuperAdminCommercial = lazyWithRetry(() => import("./pages/SuperAdminCommercial"));
const SuperAdminStrategicHelp = lazyWithRetry(() => import("./pages/SuperAdminStrategicHelp"));
const SuperAdminPlans = lazyWithRetry(() => import("./pages/SuperAdminPlans"));
const SuperAdminManagement = lazyWithRetry(() => import("./pages/SuperAdminManagement"));
import SuperAdminLayout from "./components/SuperAdminLayout";
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));

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
        <Route path="/" component={Landing} />
        <Route path="/login" component={SaasLogin} />
        <Route path="/register" component={SaasRegister} />
        <Route path="/upgrade" component={Upgrade} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />

        {/* App pages (with TopNavLayout) */}
        <Route>
          <TopNavLayout>
            <Suspense fallback={<PageLoader />}>
              <Switch>
                {/* Main nav */}
                <Route path="/dashboard" component={Home} />
                <Route path="/pipeline" component={Pipeline} />
                <Route path="/contacts" component={Contacts} />
                <Route path="/tasks" component={Tasks} />
                <Route path="/insights" component={Insights} />
                <Route path="/analytics" component={Analytics} />
                <Route path="/goals" component={Goals} />

                {/* Detail pages */}
                <Route path="/deal/:id" component={DealDetail} />
                <Route path="/deals" component={Deals} />

                {/* Settings sub-pages */}
                <Route path="/profile" component={Profile} />
                <Route path="/settings" component={SettingsPage} />
                <Route path="/settings/agents" component={AgentManagement} />
                <Route path="/settings/branding" component={BrandingSettings} />
                <Route path="/settings/custom-fields" component={CustomFieldsSettings} />
                <Route path="/settings/pipelines" component={PipelineSettings} />
                <Route path="/settings/products" component={ProductCatalog} />
                <Route path="/analytics/products" component={ProductReports} />
                <Route path="/analytics/goals" component={GoalsReport} />
                <Route path="/analytics/crm-live" component={CRMLive} />
                <Route path="/analytics/sources-campaigns" component={SourcesCampaignsReport} />
                <Route path="/analytics/post-sale" component={PostSaleReport} />
                <Route path="/analytics/support" component={SupportReport} />
                <Route path="/contact/:id" component={ContactProfile} />
                <Route path="/inbox" component={InboxPage} />
                <Route path="/rfv" component={RfvMatrix} />
                <Route path="/birthdays" component={BirthdayCalendar} />
                <Route path="/campaigns" component={Campaigns} />
                <Route path="/campaigns/:id" component={CampaignDetail} />
                <Route path="/whatsapp" component={WhatsApp} />
                <Route path="/chatbot">{() => <Redirect to="/agentes" />}</Route>
                <Route path="/agentes" component={Agentes} />
                <Route path="/proposals" component={Proposals} />
                <Route path="/portal" component={Portal} />
                <Route path="/services" component={ServiceDelivery} />
                <Route path="/agenda" component={Agenda} />
                <Route path="/referrals" component={Referrals} />
                <Route path="/recurrence" component={RecurrenceDashboard} />
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
                <Route path="/supervision" component={Supervision} />
                <Route path="/settings/automation-hub" component={SalesAutomationHub} />
                <Route path="/settings/automations" component={TaskAutomationSettings} />
                <Route path="/settings/date-automations" component={DateAutomationSettings} />
                <Route path="/settings/stage-owner-rules" component={StageOwnerRuleSettings} />
                <Route path="/settings/classification" component={ClassificationSettings} />
                <Route path="/settings/ai-training" component={AiTrainingSettings} />
                <Route path="/settings/custom-messages" component={CustomMessages} />

                {/* Super Admin — each route individually wrapped in SuperAdminLayout */}
                <Route path="/super-admin">
                  <SuperAdminLayout><SuperAdmin /></SuperAdminLayout>
                </Route>
                <Route path="/super-admin/billing">
                  <SuperAdminLayout><SaasBillingDashboard /></SuperAdminLayout>
                </Route>
                <Route path="/super-admin/zapi">
                  <SuperAdminLayout><ZapiAdmin /></SuperAdminLayout>
                </Route>
                <Route path="/super-admin/dashboard">
                  <SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>
                </Route>
                <Route path="/super-admin/tenants">
                  <SuperAdminLayout><SuperAdminTenants /></SuperAdminLayout>
                </Route>
                <Route path="/super-admin/tenant/:id">
                  <SuperAdminLayout><SuperAdminTenantDetail /></SuperAdminLayout>
                </Route>
                <Route path="/super-admin/adoption">
                  <SuperAdminLayout><SuperAdminAdoption /></SuperAdminLayout>
                </Route>
                <Route path="/super-admin/health">
                  <SuperAdminLayout><SuperAdminHealth /></SuperAdminLayout>
                </Route>
                <Route path="/super-admin/commercial">
                  <SuperAdminLayout><SuperAdminCommercial /></SuperAdminLayout>
                </Route>
                <Route path="/super-admin/strategic-help">
                  <SuperAdminLayout><SuperAdminStrategicHelp /></SuperAdminLayout>
                </Route>
                <Route path="/super-admin/plans">
                  <SuperAdminLayout><SuperAdminPlans /></SuperAdminLayout>
                </Route>
                <Route path="/super-admin/management">
                  <SuperAdminLayout><SuperAdminManagement /></SuperAdminLayout>
                </Route>

                {/* Trash */}
                <Route path="/trash" component={Trash} />

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
