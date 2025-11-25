import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Filter } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  payment_method: string | null;
  notes: string | null;
}

const CATEGORIES = ["Rent", "Utilities", "Supplies", "Staff Salary", "Maintenance", "Marketing", "Other"];
const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer"];

const Expenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    category: "",
    description: "",
    amount: "",
    expense_date: new Date(),
    payment_method: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchExpenses();
  }, []);

  useEffect(() => {
    let filtered = expenses;

    if (searchQuery) {
      filtered = filtered.filter(
        (expense) =>
          expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          expense.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((expense) => expense.category === categoryFilter);
    }

    setFilteredExpenses(filtered);
  }, [searchQuery, categoryFilter, expenses]);

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
      setFilteredExpenses(data || []);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast({
        title: "Error",
        description: "Failed to load expenses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const expenseData = {
        ...formData,
        amount: parseFloat(formData.amount),
        expense_date: format(formData.expense_date, "yyyy-MM-dd"),
        user_id: userData.user.id,
      };

      if (selectedExpense) {
        const { error } = await supabase
          .from("expenses")
          .update(expenseData)
          .eq("id", selectedExpense.id);

        if (error) throw error;
        toast({ title: "Expense updated successfully" });
      } else {
        const { error } = await supabase.from("expenses").insert([expenseData]);

        if (error) throw error;
        toast({ title: "Expense recorded successfully" });
      }

      setDialogOpen(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast({
        title: "Error",
        description: "Failed to save expense",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);

      if (error) throw error;
      toast({ title: "Expense deleted successfully" });
      fetchExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setFormData({
      category: expense.category,
      description: expense.description || "",
      amount: expense.amount.toString(),
      expense_date: new Date(expense.expense_date),
      payment_method: expense.payment_method || "",
      notes: expense.notes || "",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedExpense(null);
    setFormData({
      category: "",
      description: "",
      amount: "",
      expense_date: new Date(),
      payment_method: "",
      notes: "",
    });
  };

  const openDetailDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setDetailDialogOpen(true);
  };

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Expenses</h1>
            <p className="text-muted-foreground">Track your business expenses</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              ₹{totalExpenses.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search expenses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="space-y-2">
                {filteredExpenses.map((expense) => (
                  <Card
                    key={expense.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => openDetailDialog(expense)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{expense.category}</span>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(expense.expense_date), "MMM dd, yyyy")}
                            </span>
                          </div>
                          {expense.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {expense.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-primary">
                            ₹{expense.amount.toLocaleString()}
                          </span>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(expense)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(expense.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedExpense ? "Edit Expense" : "Add New Expense"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Brief description"
                />
              </div>
              <div>
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  placeholder="1000"
                />
              </div>
              <div>
                <Label>Expense Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.expense_date && "text-muted-foreground"
                      )}
                    >
                      {formData.expense_date
                        ? format(formData.expense_date, "PPP")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.expense_date}
                      onSelect={(date) =>
                        date && setFormData({ ...formData, expense_date: date })
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) =>
                    setFormData({ ...formData, payment_method: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                {selectedExpense ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Expense Details</DialogTitle>
            </DialogHeader>
            {selectedExpense && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="text-lg font-semibold">{selectedExpense.category}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date</Label>
                    <p className="text-lg font-semibold">
                      {format(new Date(selectedExpense.expense_date), "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="text-2xl font-bold text-primary">
                    ₹{selectedExpense.amount.toLocaleString()}
                  </p>
                </div>
                {selectedExpense.description && (
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p>{selectedExpense.description}</p>
                  </div>
                )}
                {selectedExpense.payment_method && (
                  <div>
                    <Label className="text-muted-foreground">Payment Method</Label>
                    <p>{selectedExpense.payment_method}</p>
                  </div>
                )}
                {selectedExpense.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p>{selectedExpense.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Expenses;