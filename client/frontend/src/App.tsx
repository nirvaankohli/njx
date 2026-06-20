import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OrgGate } from "@/components/OrgGate";
import AuthPage from "./pages/docshield/AuthPage";
import OnboardingPage from "./pages/docshield/OnboardingPage";
import DocShieldLayout from "./components/DocShieldLayout";
import DashboardPage from "./pages/docshield/DashboardPage";
import DocumentsPage from "./pages/docshield/DocumentsPage";
import DocumentDetailPage from "./pages/docshield/DocumentDetailPage";
import DocumentDownloadPage from "./pages/docshield/DocumentDownloadPage";
import VerifyPage from "./pages/docshield/VerifyPage";
import AccessEventsPage from "./pages/docshield/AccessEventsPage";
import ReferencePage from "./pages/docshield/ReferencePage";
import SettingsPage from "./pages/docshield/SettingsPage";
import SetupPage from "./pages/docshield/SetupPage";
import Index from "./pages/Index";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <OrgGate>
                      <DocShieldLayout />
                    </OrgGate>
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="documents/:id/download" element={<DocumentDownloadPage />} />
                <Route path="documents/:id" element={<DocumentDetailPage />} />
                <Route path="verify" element={<VerifyPage />} />
                <Route path="access-events" element={<AccessEventsPage />} />
                <Route path="reference" element={<ReferencePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="setup" element={<SetupPage />} />

              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
