import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import TodaysWork from "./pages/TodaysWork";
import Customers from "./pages/Customers";
import Vehicles from "./pages/Vehicles";
import Bookings from "./pages/Bookings";
import BookingDetail from "./pages/BookingDetail";
import Invoices from "./pages/Invoices";
import Reports from "./pages/Reports";
import Staff from "./pages/Staff";
import Settings from "./pages/Settings";
import Inventory from "./pages/Inventory";
import Branches from "./pages/Branches";
import Subscriptions from "./pages/Subscriptions";
import Services from "./pages/Services";
import Expenses from "./pages/Expenses";
import Reviews from "./pages/Reviews";
import CustomerPortal from "./pages/CustomerPortal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/todays-work" element={<TodaysWork />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/bookings/:id" element={<BookingDetail />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/branches" element={<Branches />} />
          <Route path="/services" element={<Services />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/customer-portal" element={<CustomerPortal />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
