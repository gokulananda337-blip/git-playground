import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, User, Award, Users, TrendingUp, Clock, CheckCircle, BarChart3 } from "lucide-react";

const Staff = () => {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({ full_name: "", email: "", phone: "", department: "unassigned" });
  const [departmentForm, setDepartmentForm] = useState({ name: "", phone: "", email: "", address: "" });

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: performance } = useQuery({
    queryKey: ["staff-performance"],
    queryFn: async () => {
      const { data } = await supabase.from("job_cards").select("assigned_staff_id, status, created_at, check_in_time, check_out_time");
      const perfMap: Record<string, { total: number; completed: number; avgTime: number; todayJobs: number }> = {};
      const today = new Date().toISOString().split("T")[0];
      
      data?.forEach(job => {
        if (job.assigned_staff_id) {
          if (!perfMap[job.assigned_staff_id]) {
            perfMap[job.assigned_staff_id] = { total: 0, completed: 0, avgTime: 0, todayJobs: 0 };
          }
          perfMap[job.assigned_staff_id].total++;
          if (job.status === "completed" || job.status === "delivered") {
            perfMap[job.assigned_staff_id].completed++;
          }
          if (job.created_at?.startsWith(today)) {
            perfMap[job.assigned_staff_id].todayJobs++;
          }
        }
      });
      return perfMap;
    }
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: reviews } = useQuery({
    queryKey: ["staff-reviews"],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("rating, job_card_id");
      return data || [];
    }
  });

  const addDepartment = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("branches").insert({ user_id: user.id, ...data, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast({ title: "Department created" });
      setDepartmentDialogOpen(false);
      setDepartmentForm({ name: "", phone: "", email: "", address: "" });
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
      toast({ title: "Staff member added" });
      setIsAddOpen(false);
      setFormData({ full_name: "", email: "", phone: "", department: "unassigned" });
    }
  });

  const updateStaffDepartment = useMutation({
    mutationFn: async ({ profileId, departmentId }: { profileId: string; departmentId: string | null }) => {
      const { error } = await supabase.from("profiles").update({ branch_id: departmentId }).eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({ title: "Department updated" });
    }
  });

  const filteredStaff = staff?.filter(s => s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.toLowerCase().includes(search.toLowerCase()));

  const totalJobs = Object.values(performance || {}).reduce((sum, p) => sum + p.total, 0);
  const completedJobs = Object.values(performance || {}).reduce((sum, p) => sum + p.completed, 0);
  const avgRating = reviews?.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : "N/A";

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Staff Management</h1>
            <p className="text-muted-foreground mt-1">Team performance and task assignments</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Add Staff</Button>
            </DialogTrigger>
            <DialogContent className="border">
              <DialogHeader><DialogTitle>Add New Staff Member</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input placeholder="John Doe" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" placeholder="john@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input placeholder="+91 98765 43210" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {departments?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => addStaff.mutate(formData)} disabled={!formData.full_name || !formData.email || !formData.phone || addStaff.isPending}>
                  {addStaff.isPending ? "Adding..." : "Add Staff Member"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Analytics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-color-blue/10"><Users className="h-5 w-5 text-color-blue" /></div>
                <div>
                  <p className="text-2xl font-bold text-color-blue">{staff?.length || 0}</p>
                  <p className="text-xs text-muted-foreground uppercase">Total Staff</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-color-green/10"><CheckCircle className="h-5 w-5 text-color-green" /></div>
                <div>
                  <p className="text-2xl font-bold text-color-green">{completedJobs}</p>
                  <p className="text-xs text-muted-foreground uppercase">Jobs Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-color-orange/10"><TrendingUp className="h-5 w-5 text-color-orange" /></div>
                <div>
                  <p className="text-2xl font-bold text-color-orange">{totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(0) : 0}%</p>
                  <p className="text-xs text-muted-foreground uppercase">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-color-yellow/10"><Award className="h-5 w-5 text-color-yellow" /></div>
                <div>
                  <p className="text-2xl font-bold text-color-yellow">{avgRating} ★</p>
                  <p className="text-xs text-muted-foreground uppercase">Avg Rating</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="staff" className="space-y-4">
          <TabsList className="bg-secondary border p-1">
            <TabsTrigger value="staff" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
              <User className="h-4 w-4" />Staff
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
              <BarChart3 className="h-4 w-4" />Analytics
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
              <Users className="h-4 w-4" />Departments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="staff">
            <Card className="border">
              <CardHeader className="border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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
                        <Card key={member.id} className="border hover:shadow-md transition-all">
                          <CardContent className="p-4 space-y-4">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-full bg-foreground flex items-center justify-center text-background font-bold">
                                {member.full_name?.charAt(0) || "?"}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold">{member.full_name || "No Name"}</p>
                                <p className="text-xs text-muted-foreground">{member.phone}</p>
                                <Select
                                  value={(member as any).branch_id || "unassigned"}
                                  onValueChange={(v) => updateStaffDepartment.mutate({ profileId: member.id, departmentId: v === "unassigned" ? null : v })}
                                >
                                  <SelectTrigger className="h-7 mt-2 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {departments?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {perf && (
                              <div className="grid grid-cols-3 gap-2 border-t pt-3">
                                <div className="text-center">
                                  <p className="text-lg font-bold text-color-blue">{perf.total}</p>
                                  <p className="text-xs text-muted-foreground">Total</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-color-green">{perf.completed}</p>
                                  <p className="text-xs text-muted-foreground">Done</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-color-orange">{completionRate}%</p>
                                  <p className="text-xs text-muted-foreground">Rate</p>
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
          </TabsContent>

          <TabsContent value="analytics">
            <Card className="border">
              <CardHeader className="border-b">
                <CardTitle>Performance Analytics</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {staff?.map((member) => {
                    const perf = performance?.[member.id];
                    if (!perf || perf.total === 0) return null;
                    const rate = (perf.completed / perf.total) * 100;
                    
                    return (
                      <div key={member.id} className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-background font-bold text-sm">
                          {member.full_name?.charAt(0) || "?"}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold">{member.full_name}</p>
                            <Badge className={rate >= 80 ? "bg-color-green" : rate >= 50 ? "bg-color-orange" : "bg-color-red"}>
                              {rate.toFixed(0)}%
                            </Badge>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${rate >= 80 ? "bg-color-green" : rate >= 50 ? "bg-color-orange" : "bg-color-red"}`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                            <span>{perf.completed} completed</span>
                            <span>{perf.total} total jobs</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments">
            <Card className="border">
              <CardHeader className="border-b flex flex-row items-center justify-between">
                <CardTitle>Departments</CardTitle>
                <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Add Department</Button>
                  </DialogTrigger>
                  <DialogContent className="border">
                    <DialogHeader><DialogTitle>Create Department</DialogTitle></DialogHeader>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={departmentForm.phone} onChange={(e) => setDepartmentForm({ ...departmentForm, phone: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={departmentForm.email} onChange={(e) => setDepartmentForm({ ...departmentForm, email: e.target.value })} />
                      </div>
                      <Button onClick={() => addDepartment.mutate(departmentForm)} disabled={!departmentForm.name || addDepartment.isPending}>
                        {addDepartment.isPending ? "Creating..." : "Create Department"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="pt-6">
                {departments?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No departments yet</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {departments?.map((dept: any) => {
                      const members = staff?.filter((s: any) => s.branch_id === dept.id) || [];
                      return (
                        <Card key={dept.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 rounded-lg bg-color-purple/10">
                                <Users className="h-5 w-5 text-color-purple" />
                              </div>
                              <div>
                                <p className="font-semibold">{dept.name}</p>
                                <p className="text-xs text-muted-foreground">{members.length} members</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {members.slice(0, 3).map((m: any) => (
                                <Badge key={m.id} variant="outline" className="text-xs">{m.full_name}</Badge>
                              ))}
                              {members.length > 3 && <Badge variant="outline" className="text-xs">+{members.length - 3}</Badge>}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Staff;
