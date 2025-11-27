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
import { Plus, Search, User, Award, Users } from "lucide-react";

const Staff = () => {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeView, setActiveView] = useState<"staff" | "departments">("staff");
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    department: "unassigned"
  });

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
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
      toast({ title: "Department created successfully" });
      setDepartmentDialogOpen(false);
      setDepartmentForm({ name: "", phone: "", email: "", address: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const addStaff = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("profiles").insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        branch_id: data.department === "unassigned" ? null : data.department
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({ title: "Staff member added successfully" });
      setIsAddOpen(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        department: "unassigned"
      });
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

  const filteredStaff = staff?.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const getDeptMembers = (deptId: string) => {
    return staff?.filter(s => (s as any).branch_id === deptId) || [];
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 bg-background min-h-screen">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Staff Management</h1>
            <p className="text-muted-foreground mt-1">Manage team members and departments</p>
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
                  <Label>Department</Label>
                  <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {departments?.map((dept: any) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: This creates a staff record without account access
                </p>
                <Button 
                  onClick={() => addStaff.mutate(formData)}
                  disabled={!formData.full_name || !formData.email || !formData.phone || addStaff.isPending}
                >
                  {addStaff.isPending ? "Adding..." : "Add Staff Member"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={activeView === "staff" ? "default" : "outline"}
            onClick={() => setActiveView("staff")}
          >
            <User className="h-4 w-4 mr-1" />
            Staff
          </Button>
          <Button
            size="sm"
            variant={activeView === "departments" ? "default" : "outline"}
            onClick={() => setActiveView("departments")}
          >
            <Users className="h-4 w-4 mr-1" />
            Departments
          </Button>
        </div>

        {activeView === "staff" && (
        <Card>
          <CardHeader className="border-b">
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
          <CardContent className="pt-6">
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
                    <Card key={member.id} className="hover:shadow-md transition-shadow border">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-foreground">{member.full_name || "No Name"}</p>
                              <p className="text-xs text-muted-foreground">{member.phone}</p>
                              <div className="mt-2">
                                <Label className="text-[10px] text-muted-foreground">Department</Label>
                                <Select
                                  value={(member as any).branch_id || "unassigned"}
                                  onValueChange={(value) =>
                                    updateStaffDepartment.mutate({
                                      profileId: member.id,
                                      departmentId: value === "unassigned" ? null : value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8 mt-1 w-full">
                                    <SelectValue placeholder="Assign" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {departments?.map((dept: any) => (
                                      <SelectItem key={dept.id} value={dept.id}>
                                        {dept.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
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
                              <span className="text-muted-foreground">Success Rate</span>
                              <Badge variant="secondary" className="bg-success/10 text-success">{completionRate}%</Badge>
                            </div>
                          </div>
                        )}
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
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <div>
                <h2 className="text-xl font-semibold">Departments</h2>
                <p className="text-sm text-muted-foreground">
                  Create departments and assign staff
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
            <CardContent className="pt-6">
              {departments?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No departments created yet
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {departments?.map((dept) => {
                    const members = getDeptMembers(dept.id);
                    return (
                      <Card
                        key={dept.id}
                        className="hover:shadow-md transition-shadow cursor-pointer border"
                        onClick={() => setSelectedDept(selectedDept === dept.id ? null : dept.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-lg">{dept.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {members.length} member{members.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                            <Badge variant="secondary">{dept.is_active ? "Active" : "Inactive"}</Badge>
                          </div>

                          {selectedDept === dept.id && members.length > 0 && (
                            <div className="mt-4 pt-4 border-t space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Members:</p>
                              {members.map((member) => (
                                <div key={member.id} className="flex items-center gap-2 text-sm">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span>{member.full_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Staff;
