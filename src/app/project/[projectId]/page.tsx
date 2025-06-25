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

// Define a type for the component's props
type PageProps = {
  params: { projectId: string };
  searchParams?: { [key: string]: string | string[] | undefined }; // It's good practice to include searchParams
};

export default function ProjectDetail({ params }: PageProps) {
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
        const projectDocRef = doc(db, "projects", params.projectId);
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
      collection(db, "projects", params.projectId, "expenses"),
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
  }, [params.projectId, user]);

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
  const remainingBudget = project.totalBudget - totalSpent;
  const spentPercentage = (totalSpent / project.totalBudget) * 100;
  const memberSpending = Object.keys(project.members).reduce(
    (acc, memberId) => {
      const memberExpenses = expenses.filter(
        (expense) => expense.createdBy === memberId
      );
      const totalSpent = memberExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0
      );
      acc[memberId] = totalSpent;
      return acc;
    },
    {} as Record<string, number>
  );

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
                {Object.values(project.members).map(
                  (member: { displayName: string; photoURL?: string }, index) =>
                    index === 0 ? (
                      <DropdownMenu key={index}>
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
                    ) : (
                      <Avatar
                        key={index}
                        className="h-10 w-10 border-2 border-white shadow-lg ring-2 ring-purple-500/20"
                      >
                        <AvatarImage
                          src={member.photoURL || "/placeholder.svg"}
                        />
                        <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                          {member.displayName[0]}
                        </AvatarFallback>
                      </Avatar>
                    )
                )}
              </div>
              <Button
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0 shadow-lg"
                onClick={handleShare}
                disabled={shareLoading}
              >
                <Share2 className="h-4 w-4 mr-2" />
                {shareLoading ? "Generating..." : "Share Project"}
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
              {/* Key Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="w-5 h-5 text-red-200" />
                    <p className="text-red-100 text-sm font-medium">
                      Total Spent
                    </p>
                  </div>
                  <p className="text-3xl font-bold">
                    ₹{totalSpent.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-200" />
                    <p className="text-green-100 text-sm font-medium">
                      Remaining Budget
                    </p>
                  </div>
                  <p className="text-3xl font-bold">
                    ₹{remainingBudget.toLocaleString()}
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
                    ₹{project.totalBudget.toLocaleString()}
                  </p>
                </div>
              </div>
              {/* Progress Bar */}
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
                    style={{ width: `${Math.min(spentPercentage, 100)}%` }}
                  ></div>
                </div>
              </div>
              {/* Spending by Member */}
              <div className="space-y-6">
                <h3 className="font-bold text-xl text-white">
                  Team Spending Breakdown
                </h3>
                {Object.entries(project.members).map(
                  ([memberId, member]: [
                    string,
                    {
                      displayName: string;
                      photoURL?: string;
                      contribution: number;
                    }
                  ]) => {
                    const spent = memberSpending[memberId] || 0;
                    const spentPercentage = (spent / member.contribution) * 100;
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
                                {member.contribution.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-xl text-white">
                              ₹{spent.toLocaleString()}
                            </p>
                            <p className="text-white/70 text-sm">
                              {spentPercentage.toFixed(1)}% used
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
                  }
                )}
              </div>
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
          <ExpenseList projectId={project.id} project={project} />
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
