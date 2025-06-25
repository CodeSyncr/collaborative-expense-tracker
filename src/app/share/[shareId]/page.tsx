/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Share2,
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc as firestoreDoc,
  getDoc as firestoreGetDoc,
} from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

// User type for fetched users
type User = {
  displayName: string;
  email: string;
  photoURL?: string;
};

export default function ShareProjectPage({
  params,
}: {
  params: { shareId: string };
}) {
  const [project, setProject] = useState<{ [key: string]: any } | null>(null);
  const [expenses, setExpenses] = useState<
    Array<{ id: string; [key: string]: unknown }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userMap, setUserMap] = useState<Record<string, User>>({});

  // Helper: check if a string is a UID (very basic, you can improve this)
  const isUid = (str: string) => /^[a-zA-Z0-9]{20,}$/.test(str);
  // Collect all unique UIDs: from project.members and from expenses
  const memberUids = project ? Object.keys(project.members).filter(isUid) : [];
  const expenseUids = expenses.map((e) => e.createdBy as string);
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
  }, [allUids, project ? project.members : {}, expenses]);

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      setError("");
      try {
        // Find project by shareableId
        const projectsSnap = await getDocs(collection(db, "projects"));
        let foundProject: any = null;
        projectsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.shareableId === params.shareId) {
            foundProject = { id: docSnap.id, ...data };
          }
        });
        if (!foundProject) {
          setError("Project not found or not shared.");
          setLoading(false);
          return;
        }
        setProject(foundProject);
        // Fetch expenses
        const expensesSnap = await getDocs(
          query(
            collection(db, "projects", foundProject.id, "expenses"),
            orderBy("createdAt", "desc")
          )
        );
        const expensesArr: Array<{ id: string; [key: string]: unknown }> = [];
        (expensesSnap.docs as QueryDocumentSnapshot<DocumentData>[]).forEach(
          (d: QueryDocumentSnapshot<DocumentData>) => {
            expensesArr.push({ id: d.id, ...d.data() });
          }
        );
        setExpenses(expensesArr);
      } catch {
        setError("Failed to load project.");
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [params.shareId]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="flex flex-col items-center justify-center p-10 rounded-3xl shadow-2xl bg-white/80 backdrop-blur-xl border border-white/20 animate-fade-in">
          <div className="w-20 h-20 mb-6 bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-400 rounded-full flex items-center justify-center animate-spin-slow shadow-lg">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-30"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-80"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Loading project…
          </h2>
          <p className="text-gray-500 text-lg">
            Fetching public analytics. Please wait.
          </p>
        </div>
      </main>
    );
  }
  if (error || !project) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="bg-white/90 rounded-2xl p-10 shadow-xl">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            {error || "Project not found."}
          </h2>
        </div>
      </main>
    );
  }

  // Analytics calculations
  const totalSpent = expenses.reduce(
    (sum, expense) => sum + ((expense.amount as number) || 0),
    0
  );
  const remainingBudget = (project.totalBudget as number) - totalSpent;
  const spentPercentage = (totalSpent / (project.totalBudget as number)) * 100;
  const memberSpending = allUids.reduce((acc, memberId) => {
    const memberExpenses = expenses.filter(
      (expense) => expense.createdBy === memberId
    );
    const totalSpent = memberExpenses.reduce(
      (sum, expense) => sum + ((expense.amount as number) || 0),
      0
    );
    acc[memberId] = totalSpent;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-6 shadow-lg">
            <Share2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
            {project.projectName}
          </h1>
          <p className="text-xl text-gray-600">
            Public expense overview • Real-time project analytics
          </p>
        </div>

        {/* Analytics Dashboard */}
        <Card className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 border-0 text-white overflow-hidden relative shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>

          <CardHeader className="relative z-10 pb-8">
            <CardTitle className="text-3xl font-bold flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-7 h-7" />
              </div>
              Project Analytics Dashboard
            </CardTitle>
            <p className="text-purple-100 text-lg">
              Live expense tracking and budget monitoring
            </p>
          </CardHeader>

          <CardContent className="space-y-10 relative z-10">
            {/* Key Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-red-200" />
                </div>
                <p className="text-red-100 text-sm font-medium mb-2">
                  Total Spent
                </p>
                <p className="text-4xl font-bold">
                  ₹{totalSpent.toLocaleString()}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-green-200" />
                </div>
                <p className="text-green-100 text-sm font-medium mb-2">
                  Remaining Budget
                </p>
                <p className="text-4xl font-bold">
                  ₹{remainingBudget.toLocaleString()}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-blue-200" />
                </div>
                <p className="text-blue-100 text-sm font-medium mb-2">
                  Total Budget
                </p>
                <p className="text-4xl font-bold">
                  ₹{project.totalBudget.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-white/90 font-semibold text-xl">
                  Budget Utilization
                </span>
                <div className="flex items-center gap-3">
                  {spentPercentage > 80 && (
                    <AlertTriangle className="w-6 h-6 text-yellow-300" />
                  )}
                  <span className="font-bold text-3xl">
                    {spentPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-6">
                <div
                  className="h-6 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000 ease-out shadow-lg"
                  style={{ width: `${Math.min(spentPercentage, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Spending by Member */}
            <div className="space-y-8">
              <h3 className="font-bold text-2xl text-white flex items-center gap-3">
                <Users className="w-6 h-6" />
                Team Spending Breakdown
              </h3>
              {allUids
                .map((memberId) => {
                  const member = project.members[memberId] || userMap[memberId];
                  if (!member) return null;
                  const spent = memberSpending[memberId] || 0;
                  // Find contribution: prefer by UID, else by matching email
                  let contribution = 0;
                  if ((project.members as Record<string, any>)[memberId]) {
                    contribution =
                      (project.members as Record<string, any>)[memberId]
                        .contribution || 0;
                  } else if (member && member.email) {
                    const found = Object.values(project.members).find(
                      (m: any) => m.email === member.email
                    );
                    if (found) {
                      contribution = (found as any).contribution || 0;
                    }
                  }
                  const spentPercentage =
                    contribution > 0 ? (spent / contribution) * 100 : 0;
                  return (
                    <div
                      key={memberId}
                      className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20"
                    >
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-16 w-16 ring-4 ring-white/30 shadow-xl">
                            <AvatarImage
                              src={member.photoURL || "/placeholder.svg"}
                            />
                            <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-xl">
                              {member.displayName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-bold text-2xl text-white">
                              {member.displayName}
                            </span>
                            <p className="text-white/70 text-lg">
                              Contribution: ₹{contribution.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-3xl text-white">
                            ₹{spent.toLocaleString()}
                          </p>
                          <p className="text-white/70 text-lg">
                            {contribution > 0
                              ? `${spentPercentage.toFixed(1)}% utilized`
                              : "No contribution set"}
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-4">
                        <div
                          className="h-4 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000 ease-out shadow-lg"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
