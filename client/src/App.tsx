import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import SendMessage from "./pages/SendMessage";
import Messages from "./pages/Messages";
import Logs from "./pages/Logs";
import Chatbot from "./pages/Chatbot";
import ApiDocs from "./pages/ApiDocs";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/send" component={SendMessage} />
      <Route path="/messages" component={Messages} />
      <Route path="/logs" component={Logs} />
      <Route path="/chatbot" component={Chatbot} />
      <Route path="/api-docs" component={ApiDocs} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
