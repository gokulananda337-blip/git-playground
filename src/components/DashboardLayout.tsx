import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, User, Bell, Sparkles, Droplets } from "lucide-react";
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth", { replace: true });
      }
    });

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
          <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
            <div className="flex items-center justify-between h-16 px-4 md:px-6">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="h-9 w-9" />
                <div className="hidden sm:flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold leading-tight">Welcome back!</h1>
                    <p className="text-xs text-muted-foreground">Let's make some cars shine</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:gap-4">
                {/* Date Badge */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 text-sm font-medium">
                  <Droplets className="h-3.5 w-3.5 text-primary" />
                  {format(currentDate, "EEE, MMM dd, yyyy")}
                </div>
                
                {/* User Info */}
                <div className="flex items-center gap-3 pl-3 border-l border-border">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium truncate max-w-[160px]">{session?.user?.email}</p>
                    <p className="text-xs text-muted-foreground">Administrator</p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-full"
                      title="Profile"
                      onClick={() => navigate("/settings")}
                    >
                      <User className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive"
                      onClick={handleSignOut} 
                      title="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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