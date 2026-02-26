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
const Alerts = lazy(() => import("./pages/Alerts"));
const DealDetail = lazy(() => import("./pages/DealDetail"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <TopNavLayout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/deals" component={Deals} />
          <Route path="/pipeline" component={Pipeline} />
          <Route path="/deal/:id" component={DealDetail} />
          <Route path="/trips" component={Trips} />
          <Route path="/tasks" component={Tasks} />
          <Route path="/inbox" component={InboxPage} />
          <Route path="/whatsapp" component={WhatsApp} />
          <Route path="/chatbot" component={Chatbot} />
          <Route path="/proposals" component={Proposals} />
          <Route path="/portal" component={Portal} />
          <Route path="/insights" component={Insights} />
          <Route path="/goals" component={Goals} />
          <Route path="/academy" component={Academy} />
          <Route path="/integrations" component={Integrations} />
          <Route path="/admin" component={Admin} />
          <Route path="/api-docs" component={ApiDocs} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </TopNavLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
