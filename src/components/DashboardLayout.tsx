import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { format } from "date-fns";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentDate] = useState(new Date());
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for existing session but don't block rendering
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth", { replace: true });
      }
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth", { replace: true });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You've been successfully signed out.",
      });
      navigate("/auth");
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b border-border bg-background sticky top-0 z-10">
            <div className="flex items-center justify-between h-16 px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <h1 className="text-lg font-semibold">Welcome back!</h1>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm font-medium text-foreground hidden md:block">
                  {format(currentDate, "EEEE, MMMM dd, yyyy")}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{session?.user?.email}</p>
                  <p className="text-xs text-muted-foreground">Administrator</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  title="Profile"
                  onClick={() => navigate("/settings")}
                >
                  <User className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto bg-secondary/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
