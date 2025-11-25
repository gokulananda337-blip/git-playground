import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, User, Award, Clock, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Staff = () => {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeView, setActiveView] = useState<"staff" | "departments">("staff");
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "staff" as any
  });

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles (role)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: performance } = useQuery({
    queryKey: ["staff-performance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_cards")
        .select("assigned_staff_id, status");
      
      const perfMap: any = {};
      data?.forEach(job => {
        if (job.assigned_staff_id) {
          if (!perfMap[job.assigned_staff_id]) {
            perfMap[job.assigned_staff_id] = { total: 0, completed: 0 };
          }
          perfMap[job.assigned_staff_id].total++;
          if (job.status === "completed" || job.status === "delivered") {
            perfMap[job.assigned_staff_id].completed++;
          }
        }
      });
      return perfMap;
    }
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, phone, email, address, is_active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const addDepartment = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("branches").insert({
        user_id: user.id,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        is_active: true
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast({ title: "Department created" });
      setDepartmentDialogOpen(false);
      setDepartmentForm({ name: "", phone: "", email: "", address: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateStaffDepartment = useMutation({
    mutationFn: async ({ profileId, departmentId }: { profileId: string; departmentId: string | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ branch_id: departmentId })
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({ title: "Department updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const addStaff = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.functions.invoke('create-staff', {
        body: data
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({ title: "Staff member created successfully", description: "Password reset email has been sent." });
      setIsAddOpen(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        role: "staff"
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const filteredStaff = staff?.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const roleColors: Record<string, string> = {
    admin: "bg-purple-500",
    manager: "bg-blue-500",
    staff: "bg-green-500"
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Staff Management</h1>
            <p className="text-muted-foreground">Manage team members and track performance</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Staff Member</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password reset link will be sent to their email
                </p>
                <Button 
                  onClick={() => addStaff.mutate(formData)}
                  disabled={!formData.full_name || !formData.email || !formData.phone || addStaff.isPending}
                >
                  {addStaff.isPending ? "Creating..." : "Create Staff Account"}
                </Button>
              </div>
            </DialogContent>
           </Dialog>
         </div>

         <div className="flex gap-2 mt-4">
           <Button
             size="sm"
             variant={activeView === "staff" ? "default" : "outline"}
             onClick={() => setActiveView("staff")}
           >
             Staff
           </Button>
           <Button
             size="sm"
             variant={activeView === "departments" ? "default" : "outline"}
             onClick={() => setActiveView("departments")}
           >
             Departments
           </Button>
         </div>

         {activeView === "staff" && (
         <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading staff...</div>
            ) : filteredStaff?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No staff members found</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredStaff?.map((member) => {
                  const perf = performance?.[member.id];
                  const completionRate = perf ? ((perf.completed / perf.total) * 100).toFixed(0) : 0;
                  
                  return (
                    <Card key={member.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <p className="font-bold">{member.full_name || "No Name"}</p>
                              <p className="text-xs text-muted-foreground">{member.phone}</p>
                              {departments && (
                                <div className="mt-2">
                                  <Label className="text-[10px] text-muted-foreground">Department</Label>
                                  <Select
                                    value={(member as any).branch_id || ""}
                                    onValueChange={(value) =>
                                      updateStaffDepartment.mutate({
                                        profileId: member.id,
                                        departmentId: value || null,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 mt-1 w-40">
                                      <SelectValue placeholder="Assign" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="">Unassigned</SelectItem>
                                      {departments?.map((dept: any) => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                          {dept.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge className={`${roleColors[(member.user_roles as any)?.[0]?.role || "staff"]} text-white capitalize`}>
                            {(member.user_roles as any)?.[0]?.role || "staff"}
                          </Badge>
                        </div>

                        {perf && (
                          <div className="space-y-2 border-t pt-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Award className="h-3 w-3" />
                                Jobs Completed
                              </span>
                              <span className="font-medium">{perf.completed}/{perf.total}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                Success Rate
                              </span>
                              <span className="font-medium text-green-600">{completionRate}%</span>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => navigate(`/job-cards?staff=${member.id}`)}
                          >
                            View Jobs
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1">
                            <Clock className="h-3 w-3 mr-1" />
                            Attendance
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
             )}
           </CardContent>
         </Card>
         )}

         {activeView === "departments" && (
           <Card>
             <CardHeader className="flex flex-row items-center justify-between">
               <div>
                 <h2 className="text-xl font-semibold">Departments</h2>
                 <p className="text-sm text-muted-foreground">
                   Create departments and group your staff
                 </p>
               </div>
               <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
                 <DialogTrigger asChild>
                   <Button size="sm" className="gap-2">
                     <Plus className="h-4 w-4" />
                     Add Department
                   </Button>
                 </DialogTrigger>
                 <DialogContent>
                   <DialogHeader>
                     <DialogTitle>Create Department</DialogTitle>
                   </DialogHeader>
                   <div className="grid gap-3">
                     <div className="space-y-1">
                       <Label>Name *</Label>
                       <Input
                         value={departmentForm.name}
                         onChange={(e) =>
                           setDepartmentForm({ ...departmentForm, name: e.target.value })
                         }
                       />
                     </div>
                     <div className="space-y-1">
                       <Label>Phone</Label>
                       <Input
                         value={departmentForm.phone}
                         onChange={(e) =>
                           setDepartmentForm({ ...departmentForm, phone: e.target.value })
                         }
                       />
                     </div>
                     <div className="space-y-1">
                       <Label>Email</Label>
                       <Input
                         type="email"
                         value={departmentForm.email}
                         onChange={(e) =>
                           setDepartmentForm({ ...departmentForm, email: e.target.value })
                         }
                       />
                     </div>
                     <div className="space-y-1">
                       <Label>Address</Label>
                       <Input
                         value={departmentForm.address}
                         onChange={(e) =>
                           setDepartmentForm({ ...departmentForm, address: e.target.value })
                         }
                       />
                     </div>
                     <Button
                       onClick={() => addDepartment.mutate(departmentForm)}
                       disabled={!departmentForm.name || addDepartment.isPending}
                     >
                       {addDepartment.isPending ? "Creating..." : "Create Department"}
                     </Button>
                   </div>
                 </DialogContent>
               </Dialog>
             </CardHeader>
             <CardContent>
               {departments && departments.length > 0 ? (
                 <div className="space-y-3">
                   {departments.map((dept: any) => (
                     <Card key={dept.id}>
                       <CardContent className="p-3 flex items-center justify-between">
                         <div>
                           <p className="font-medium">{dept.name}</p>
                           {dept.address && (
                             <p className="text-xs text-muted-foreground">{dept.address}</p>
                           )}
                         </div>
                         <Badge variant={dept.is_active ? "default" : "secondary"}>
                           {dept.is_active ? "Active" : "Inactive"}
                         </Badge>
                       </CardContent>
                     </Card>
                   ))}
                 </div>
               ) : (
                 <p className="text-sm text-muted-foreground">
                   No departments created yet.
                 </p>
               )}
             </CardContent>
           </Card>
         )}
       </div>
    </DashboardLayout>
  );
};

export default Staff;
