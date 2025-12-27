import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, Search, TrendingUp, Users, MessageSquare, ThumbsUp, Download, Filter } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

const Reviews = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          *,
          customers (name, phone, email),
          job_cards (
            id,
            services,
            vehicles (vehicle_number, brand, model)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: stats } = useQuery({
    queryKey: ["review-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("rating");
      if (error) throw error;
      
      const total = data?.length || 0;
      const avgRating = total > 0 ? data.reduce((sum, r) => sum + r.rating, 0) / total : 0;
      const ratings = [1, 2, 3, 4, 5].map(r => ({
        rating: r,
        count: data?.filter(review => review.rating === r).length || 0
      }));
      
      const positiveCount = data?.filter(r => r.rating >= 4).length || 0;
      const satisfactionRate = total > 0 ? (positiveCount / total) * 100 : 0;
      
      return { total, avgRating, ratings, satisfactionRate };
    }
  });

  const filteredReviews = reviews?.filter(review => {
    const matchesSearch = review.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review.feedback?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRating = ratingFilter === "all" || review.rating === parseInt(ratingFilter);
    return matchesSearch && matchesRating;
  });

  const COLORS = ["hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--accent))", "hsl(var(--info))", "hsl(var(--success))"];

  const ratingDistribution = stats?.ratings?.map((r, idx) => ({
    name: `${r.rating} Star`,
    value: r.count,
    fill: COLORS[idx]
  })) || [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Reviews & Ratings</h1>
            <p className="text-muted-foreground">Monitor customer feedback and satisfaction</p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Reviews
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-md border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
              <MessageSquare className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">All time reviews</p>
            </CardContent>
          </Card>

          <Card className="shadow-md border-l-4 border-l-warning">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-5 w-5 text-warning fill-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats?.avgRating.toFixed(1) || "0.0"}</div>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "h-3 w-3",
                      star <= Math.round(stats?.avgRating || 0) ? "fill-warning text-warning" : "text-muted-foreground"
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-l-4 border-l-success">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Satisfaction Rate</CardTitle>
              <ThumbsUp className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats?.satisfactionRate.toFixed(0) || 0}%</div>
              <p className="text-xs text-muted-foreground mt-1">4+ star ratings</p>
            </CardContent>
          </Card>

          <Card className="shadow-md border-l-4 border-l-info">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">5 Star Reviews</CardTitle>
              <TrendingUp className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-info">
                {stats?.ratings?.find(r => r.rating === 5)?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Top rated services</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-md">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-warning" />
                Rating Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ratingDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={70} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {ratingDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-info" />
                Rating Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={ratingDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {ratingDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="shadow-md">
          <CardHeader className="border-b">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name or feedback..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All Ratings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="1">1 Star</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading reviews...</div>
            ) : filteredReviews?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No reviews found</div>
            ) : (
              <div className="divide-y">
                {filteredReviews?.map((review) => (
                  <div key={review.id} className="p-4 hover:bg-secondary/30 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="bg-foreground text-background rounded-full w-10 h-10 flex items-center justify-center font-bold">
                            {review.customers?.name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <p className="font-semibold">{review.customers?.name || "Unknown Customer"}</p>
                            <p className="text-xs text-muted-foreground">{review.customers?.phone}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={cn(
                                  "h-4 w-4",
                                  star <= review.rating ? "fill-warning text-warning" : "text-muted-foreground"
                                )}
                              />
                            ))}
                          </div>
                          <Badge variant={review.rating >= 4 ? "default" : review.rating >= 3 ? "secondary" : "destructive"}>
                            {review.rating} Star{review.rating !== 1 ? "s" : ""}
                          </Badge>
                        </div>

                        {review.feedback && (
                          <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                            "{review.feedback}"
                          </p>
                        )}

                        {review.job_cards && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Vehicle: {review.job_cards.vehicles?.vehicle_number}</span>
                            <span>•</span>
                            <span>
                              Services: {Array.isArray(review.job_cards.services) 
                                ? review.job_cards.services.map((s: any) => s.name).join(", ")
                                : "N/A"}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-right text-sm text-muted-foreground">
                        {format(new Date(review.created_at), "MMM dd, yyyy")}
                        <br />
                        <span className="text-xs">{format(new Date(review.created_at), "hh:mm a")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Reviews;
