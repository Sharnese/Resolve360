import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import Home from "./pages/Home";
import Services from "./pages/Services";
import GetStarted from "./pages/GetStarted";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import ClientPortal from "./pages/ClientPortal";
import ClientRequestDetail from "./pages/ClientRequestDetail";
import AdminDashboard from "./pages/AdminDashboard";
import AdminRequestDetail from "./pages/AdminRequestDetail";
import AdminUsers from "./pages/AdminUsers";
import AdminRatings from "./pages/AdminRatings";
import StatementSubmission from "./pages/StatementSubmission";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/get-started" element={<GetStarted />} />
              <Route path="/login" element={<Login />} />
              <Route path="/change-password" element={<ChangePassword />} />
              <Route path="/portal" element={<ClientPortal />} />
              <Route path="/portal/request/:id" element={<ClientRequestDetail />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/request/:id" element={<AdminRequestDetail />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/ratings" element={<AdminRatings />} />
              <Route path="/statement/:token" element={<StatementSubmission />} />

              <Route path="*" element={<NotFound />} />

            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
