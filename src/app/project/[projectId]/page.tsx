/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Share2,
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { Expense, Project } from "@/lib/types";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import React from "react";
import ExpenseList from "@/components/ExpenseList";
import AddExpenseForm from "@/components/AddExpenseForm";
import { generateShareableLink } from "@/lib/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { deleteProject, updateProject } from "@/lib/firestore";
import { EditProjectModal } from "@/components/EditProjectModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  doc as firestoreDoc,
  getDoc as firestoreGetDoc,
} from "firebase/firestore";

// Define a type for the component's props
type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: { [key: string]: string | string[] | undefined }; // It's good practice to include searchParams
};

// User type for fetched users
type User = {
  displayName: string;
  email: string;
  photoURL?: string;
};

export default function ProjectDetail({ params }: PageProps) {
  const { projectId } = React.use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, User>>({});
  // Add month/year state at the top of the component
  const [filterMonth, setFilterMonth] = useState<number>(() => new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number>(() => new Date().getFullYear());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchProject = async () => {
      try {
        setLoading(true);
        const projectDocRef = doc(db, "projects", projectId);
        const projectDoc = await getDoc(projectDocRef);
        if (projectDoc.exists()) {
          setProject({ id: projectDoc.id, ...projectDoc.data() } as Project);
        } else {
          setError("Project not found.");
        }
      } catch {
        setError("Failed to load project.");
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
    const expensesQuery = query(
      collection(db, "projects", projectId, "expenses"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
      const expensesData: Expense[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Expense[];
      setExpenses(expensesData);
    });
    return () => unsubscribe();
  }, [projectId, user]);

  // Helper: check if a string is a UID (very basic, you can improve this)
  const isUid = (str: string) => /^[a-zA-Z0-9]{20,}$/.test(str);

  // Collect all unique UIDs: from project.members and from expenses
  const memberUids = project ? Object.keys(project.members).filter(isUid) : [];
  const expenseUids = expenses.map((e) => e.createdBy);
  const allUidsSet = new Set([...memberUids, ...expenseUids]);
  const allUids = Array.from(allUidsSet);

  // Fetch user data for UIDs not in project.members
  useEffect(() => {
    if (!project) return;
    const missingUids = allUids.filter(
      (uid) => !project.members[uid] && !userMap[uid]
    );
    if (missingUids.length === 0) return;
    const fetchUsers = async () => {
      const updates: Record<string, User> = {};
      await Promise.all(
        missingUids.map(async (uid) => {
          try {
            const userDoc = await firestoreGetDoc(
              firestoreDoc(db, "users", uid)
            );
            if (userDoc.exists()) {
              const data = userDoc.data();
              updates[uid] = {
                displayName: data.displayName || data.email || "Unknown",
                email: data.email || "",
                photoURL: data.photoURL || undefined,
              };
            }
          } catch {}
        })
      );
      if (Object.keys(updates).length > 0) {
        setUserMap((prev) => ({ ...prev, ...updates }));
      }
    };
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Fix: Check if project is not null before accessing project.members in dependency array
  }, [allUids, project ? project.members : {}, expenses]);

  const handleShare = async () => {
    if (!project) return;
    setShareLoading(true);
    setShareError("");
    try {
      const shareId = await generateShareableLink(project.id);
      const link = `${window.location.origin}/share/${shareId}`;
      setShareLink(link);
      setShareDialogOpen(true);
    } catch (error: any) {
      setShareError("Could not generate share link. Please try again.");
    } finally {
      setShareLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    try {
      await deleteProject(project.id);
      router.push("/dashboard");
    } catch (err) {
      setError("Failed to delete project. Please try again.");
    }
  };

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
        <p>Loading project...</p>
      </main>
    );
  }
  if (error || !project) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
        <p className="text-red-500">{error || "Project not found."}</p>
      </main>
    );
  }

  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remainingBudget = project ? project.totalBudget - totalSpent : 0;
  // For Team Spending Breakdown, use filtered expenses for monthly budget projects
  const isMonthlyBudgetProject = project.projectType === "Roommates/Flatmates" || project.projectType === "Family Budget";
  const memberSpending = allUids.reduce((acc, memberId) => {
    const relevantExpenses = isMonthlyBudgetProject
      ? expenses.filter((expense) => {
          const date = expense.createdAt.toDate ? expense.createdAt.toDate() : new Date(expense.createdAt.seconds * 1000);
          return date.getMonth() === filterMonth && date.getFullYear() === filterYear && expense.createdBy === memberId;
        })
      : expenses.filter((expense) => expense.createdBy === memberId);
    const totalSpent = relevantExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    acc[memberId] = totalSpent;
    return acc;
  }, {} as Record<string, number>);

  // Calculate monthly spent for monthly budget projects using filterMonth/filterYear
  const monthlySpent = isMonthlyBudgetProject && project.monthlyBudget ? expenses.filter((expense) => {
      const date = expense.createdAt.toDate ? expense.createdAt.toDate() : new Date(expense.createdAt.seconds * 1000);
      return date.getMonth() === filterMonth && date.getFullYear() === filterYear;
    }).reduce((sum, expense) => sum + expense.amount, 0) : 0;
  // Robust utilization calculations
  let spentPercentage = 0;
  if (!isMonthlyBudgetProject && project.sharedBudget !== false && project.projectType !== 'Simple (Personal)' && project.totalBudget > 0) {
    spentPercentage = Math.max(0, Math.min((totalSpent / project.totalBudget) * 100, 100));
  }
  let monthlyUtilization = 0;
  if (isMonthlyBudgetProject && (project.monthlyBudget ?? 0) > 0) {
    monthlyUtilization = Math.max(0, Math.min((monthlySpent / (project.monthlyBudget ?? 0)) * 100, 100));
  }

  // For month/year selector
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const years = Array.from(new Set(expenses.map((e) => e.createdAt.toDate().getFullYear())));
  if (!years.includes(new Date().getFullYear())) years.push(new Date().getFullYear());
  years.sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-6">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors group"
              >
                <div className="w-10 h-10 bg-gray-100 group-hover:bg-purple-100 rounded-xl flex items-center justify-center transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                </div>
                <span className="font-medium">Back to Dashboard</span>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {allUids.map((uid, index) => {
                  const member = project.members[uid] || userMap[uid];
                  if (!member) return null;
                  // First avatar gets dropdown
                  if (index === 0) {
                    return (
                      <DropdownMenu key={uid}>
                        <DropdownMenuTrigger asChild>
                          <Avatar className="h-10 w-10 border-2 border-white shadow-lg ring-2 ring-purple-500/20 cursor-pointer">
                            <AvatarImage
                              src={member.photoURL || "/placeholder.svg"}
                            />
                            <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                              {member.displayName[0]}
                            </AvatarFallback>
                          </Avatar>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditDialogOpen(true)}
                          >
                            Edit Project
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteDialogOpen(true)}
                            className="text-red-600"
                          >
                            Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  }
                  return (
                    <Avatar
                      key={uid}
                      className="h-10 w-10 border-2 border-white shadow-lg ring-2 ring-purple-500/20"
                    >
                      <AvatarImage
                        src={member.photoURL || "/placeholder.svg"}
                      />
                      <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                        {member.displayName[0]}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
              </div>
              <Button
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0 shadow-lg"
                onClick={handleShare}
                disabled={shareLoading}
              >
                <Share2 className="h-4 w-4 mr-2" />
                {shareLoading ? "Generating..." : "Share"}
              </Button>
            </div>
          </div>
          <div className="pb-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              {project.projectName}
            </h1>
            <p className="text-gray-500 mt-2">
              Track expenses and collaborate with your team
            </p>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analytics Dashboard */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 border-0 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
            <CardHeader className="relative z-10">
              <CardTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                Project Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 relative z-10">
              {/* Key Stats - show only Total Spent for Simple (Personal) projects */}
              {project.projectType === 'Simple (Personal)' ? (
                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                    <div className="flex items-center gap-3 mb-2">
                      <DollarSign className="w-5 h-5 text-red-200" />
                      <p className="text-red-100 text-sm font-medium">
                        Total Spent
                      </p>
                    </div>
                    <p className="text-3xl font-bold">
                      ₹{totalSpent.toLocaleString("en-US")}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                      <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="w-5 h-5 text-red-200" />
                        <p className="text-red-100 text-sm font-medium">
                          {isMonthlyBudgetProject ? "Monthly Spent" : "Total Spent"}
                        </p>
                      </div>
                      <p className="text-3xl font-bold">
                        ₹{(isMonthlyBudgetProject ? monthlySpent : totalSpent).toLocaleString("en-US")}
                      </p>
                    </div>
                    {isMonthlyBudgetProject && (project.monthlyBudget ?? 0) > 0 ? (
                      <>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                          <div className="flex items-center gap-3 mb-2">
                            <TrendingUp className="w-5 h-5 text-green-200" />
                            <p className="text-green-100 text-sm font-medium">
                              Monthly Budget
                            </p>
                          </div>
                          <p className="text-3xl font-bold">
                            ₹{(project.monthlyBudget ?? 0).toLocaleString("en-US")}
                          </p>
                        </div>
                      </>
                    ) : project.sharedBudget !== false && project.projectType !== 'Simple (Personal)' && (
                      <>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                          <div className="flex items-center gap-3 mb-2">
                            <TrendingUp className="w-5 h-5 text-green-200" />
                            <p className="text-green-100 text-sm font-medium">
                              Remaining Budget
                            </p>
                          </div>
                          <p className="text-3xl font-bold">
                            ₹{remainingBudget.toLocaleString("en-US")}
                          </p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                          <div className="flex items-center gap-3 mb-2">
                            <Users className="w-5 h-5 text-blue-200" />
                            <p className="text-blue-100 text-sm font-medium">
                              Total Budget
                            </p>
                          </div>
                          <p className="text-3xl font-bold">
                            ₹{project.totalBudget.toLocaleString("en-US")}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Progress Bar - show monthly utilization for monthly budget projects */}
                  {isMonthlyBudgetProject && (project.monthlyBudget ?? 0) > 0 ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-medium">
                          Monthly Utilization
                        </span>
                        <div className="flex items-center gap-2">
                          {monthlyUtilization > 80 && (
                            <AlertTriangle className="w-4 h-4 text-yellow-300" />
                          )}
                          <span className="font-bold text-xl">
                            {monthlyUtilization.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-4">
                        <div
                          className="h-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000 ease-out"
                          style={{ width: `${monthlyUtilization}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : isMonthlyBudgetProject && (project.monthlyBudget ?? 0) <= 0 ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-medium">
                          Monthly Utilization
                        </span>
                        <span className="font-bold text-xl">0%</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-4">
                        <div
                          className="h-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000 ease-out"
                          style={{ width: `0%` }}
                        ></div>
                      </div>
                    </div>
                  ) : project.sharedBudget !== false && project.projectType !== 'Simple (Personal)' && project.totalBudget > 0 ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-medium">
                          Budget Utilization
                        </span>
                        <div className="flex items-center gap-2">
                          {spentPercentage > 80 && (
                            <AlertTriangle className="w-4 h-4 text-yellow-300" />
                          )}
                          <span className="font-bold text-xl">
                            {spentPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-4">
                        <div
                          className="h-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000 ease-out"
                          style={{ width: `${spentPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : project.sharedBudget !== false && project.projectType !== 'Simple (Personal)' && project.totalBudget <= 0 ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-medium">
                          Budget Utilization
                        </span>
                        <span className="font-bold text-xl">0%</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-4">
                        <div
                          className="h-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000 ease-out"
                          style={{ width: `0%` }}
                        ></div>
                      </div>
                    </div>
                  ) : null}
                  {/* Spending by Member */}
                  <div className="space-y-6">
                    <h3 className="font-bold text-xl text-white">
                      Team Spending Breakdown
                    </h3>
                    {project &&
                      allUids
                        .map((memberId) => {
                          const member =
                            project.members[memberId] || userMap[memberId];
                          if (!member) return null;
                          const spent = memberSpending[memberId] || 0;
                          // Find contribution: prefer by UID, else by matching email
                          let contribution = 0;
                          if (project.members[memberId]) {
                            contribution =
                              project.members[memberId].contribution || 0;
                          } else if (member && member.email) {
                            const found = Object.values(project.members).find(
                              (m) => m.email === member.email
                            );
                            if (found) {
                              contribution = found.contribution || 0;
                            }
                          }
                          const spentPercentage =
                            contribution > 0 ? (spent / contribution) * 100 : 0;
                          return (
                            <div
                              key={memberId}
                              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
                            >
                              <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-12 w-12 ring-2 ring-white/30">
                                    <AvatarImage
                                      src={member.photoURL || "/placeholder.svg"}
                                    />
                                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold">
                                      {member.displayName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <span className="font-semibold text-lg text-white">
                                      {member.displayName}
                                    </span>
                                    <p className="text-white/70 text-sm">
                                      Contribution: ₹
                                      {contribution
                                        ? contribution.toLocaleString("en-US")
                                        : "-"}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-xl text-white">
                                    ₹{spent.toLocaleString("en-US")}
                                  </p>
                                  <p className="text-white/70 text-sm">
                                    {contribution > 0
                                      ? `${spentPercentage.toFixed(1)}% used`
                                      : "No contribution set"}
                                  </p>
                                </div>
                              </div>
                              <div className="w-full bg-white/20 rounded-full h-3">
                                <div
                                  className="h-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000 ease-out"
                                  style={{
                                    width: `${Math.min(spentPercentage, 100)}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          );
                        })
                        .filter(Boolean)}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-8">
          {/* Add Expense Button */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Project Expenses
              </h2>
              <p className="text-gray-500 mt-1">
                Track and manage all project expenses
              </p>
            </div>
            <Button
              onClick={() => setShowAddExpenseModal(true)}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
          {/* Expense List */}
          {isMonthlyBudgetProject && (
            <div className="flex items-center gap-2 mb-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (filterMonth === 0) {
                    setFilterMonth(11);
                    setFilterYear(filterYear - 1);
                  } else {
                    setFilterMonth(filterMonth - 1);
                  }
                }}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold text-base">
                {months[filterMonth]} {filterYear}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (filterMonth === 11) {
                    setFilterMonth(0);
                    setFilterYear(filterYear + 1);
                  } else {
                    setFilterMonth(filterMonth + 1);
                  }
                }}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          <ExpenseList projectId={project.id} project={project} filterMonth={filterMonth} filterYear={filterYear} />
        </div>
        {/* Add Expense Modal */}
        <AddExpenseForm
          open={showAddExpenseModal}
          onOpenChange={setShowAddExpenseModal}
          projectId={project.id}
          onExpenseAdded={() => setShowAddExpenseModal(false)}
        />
        {/* Share Link Dialog */}
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle>Share Project Link</DialogTitle>
            </DialogHeader>
            {shareError ? (
              <div className="text-red-500 text-center">{shareError}</div>
            ) : shareLink ? (
              <div className="space-y-4">
                <p className="text-gray-700">
                  Anyone with this link can view the project in read-only mode:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(shareLink);
                    }}
                    className="h-10 px-4 text-sm"
                  >
                    Copy
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center">
                Generating link...
              </div>
            )}
          </DialogContent>
        </Dialog>
        {/* Delete Project AlertDialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this project? This action cannot
                be undone and will delete all expenses.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 pt-4">
              <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteProject}>
                Delete
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
        {/* Edit Project Modal Placeholder */}
        <EditProjectModal
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          project={project}
          onProjectUpdated={(updated) => setProject(updated)}
        />
      </main>
    </div>
  );
}
