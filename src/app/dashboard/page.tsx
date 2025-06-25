/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  doc as firestoreDoc,
  getDoc as firestoreGetDoc,
  onSnapshot as onFirestoreSnapshot,
  collection as firestoreCollection,
  deleteDoc,
} from "firebase/firestore";
import Link from "next/link";
import { NewProjectModal } from "@/components/NewProjectModal";
// Import your UI components (replace with your actual imports)
// If you haven't already, install sonner: npm install sonner
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";

import {
  TrendingUp,
  Users,
  DollarSign,
  Bell,
  Plus,
  Search,
} from "lucide-react";

type Notification = {
  id: string;
  type: string;
  projectId: string;
  expenseId: string;
  by: string;
  byName: string;
  description: string;
  amount: number;
  createdAt: { seconds: number; nanoseconds: number };
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  type DashboardProject = {
    id: string;
    totalBudget: number;
    projectName: string;
    members: any;
    expenses: any[];
    allUids: string[];
    [key: string]: any;
  };
  const [projectsWithExpenses, setProjectsWithExpenses] = useState<
    DashboardProject[]
  >([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [search, setSearch] = useState("");
  const [userMap, setUserMap] = useState<
    Record<string, { displayName: string; email: string; photoURL?: string }>
  >({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastNotificationId = useRef<string | null>(null);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    } else if (user) {
      const q = query(
        collection(db, "projects"),
        where("memberUids", "array-contains", user.uid)
      );
      const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const projectsData: any[] = [];
        const allUidsSet = new Set<string>();
        for (const docSnap of querySnapshot.docs) {
          const base = docSnap.data();
          // Fetch expenses subcollection
          const expensesSnap = await getDocs(
            collection(db, "projects", docSnap.id, "expenses")
          );
          const expenses = expensesSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          // Collect UIDs from members and expenses
          const memberUids = base.members
            ? Object.keys(base.members).filter((uid) =>
                /^[a-zA-Z0-9]{20,}$/.test(uid)
              )
            : [];
          const expenseUids = expenses
            .map((e: any) => e.createdBy)
            .filter(Boolean);
          expenseUids.forEach((uid: string) => allUidsSet.add(uid));
          memberUids.forEach((uid: string) => allUidsSet.add(uid));
          const project: DashboardProject = {
            id: docSnap.id,
            totalBudget: base.totalBudget,
            projectName: base.projectName,
            members: base.members,
            expenses,
            allUids: Array.from(new Set([...memberUids, ...expenseUids])),
            ...base,
          };
          projectsData.push(project);
        }
        setProjectsWithExpenses(projectsData);
        setLoadingExpenses(false);
        // Fetch user data for UIDs not in any project.members
        const allUids = Array.from(allUidsSet);
        const missingUids = allUids.filter((uid) => {
          return (
            !projectsData.some((p) => p.members && p.members[uid]) &&
            !userMap[uid]
          );
        });
        if (missingUids.length > 0) {
          const updates: Record<
            string,
            { displayName: string; email: string; photoURL?: string }
          > = {};
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
        }
      });
      return () => unsubscribe();
    }
  }, [user, loading, router]);

  // Listen for notifications
  useEffect(() => {
    if (!user) return;
    const notificationsRef = firestoreCollection(
      db,
      "users",
      user.uid,
      "notifications"
    );
    const unsubscribe = onFirestoreSnapshot(notificationsRef, (snapshot) => {
      const notifs = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Notification)
      );
      setNotifications(
        notifs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
      );
      setUnreadCount(notifs.length);
      // Show toast for new notification
      if (notifs.length > 0 && notifs[0].id !== lastNotificationId.current) {
        const notif = notifs[0];
        if (notif.type === "expense_added") {
          toast.success(
            `${notif.byName || "A member"} added an expense: ${
              notif.description
            } (₹${notif.amount})`,
            { duration: 6000 }
          );
        }
        lastNotificationId.current = notifs[0].id;
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Mark all as read (delete notifications)
  const clearNotifications = async () => {
    if (!user) return;
    const notifs = [...notifications];
    setNotifications([]);
    setUnreadCount(0);
    await Promise.all(
      notifs.map((notif) =>
        deleteDoc(
          firestoreDoc(db, "users", user.uid, "notifications", notif.id)
        )
      )
    );
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (loading || !user || loadingExpenses) {
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
            Loading your dashboard…
          </h2>
          <p className="text-gray-500 text-lg">
            Fetching your projects and analytics. Please wait.
          </p>
        </div>
      </main>
    );
  }

  // Calculate stats
  const totalBudget = projectsWithExpenses.reduce(
    (sum, p) => sum + (p.totalBudget || 0),
    0
  );
  const totalSpent = projectsWithExpenses.reduce(
    (sum, p) =>
      sum +
      (p.expenses
        ? p.expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0)
        : 0),
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <p className="text-sm text-gray-500">
                  Welcome back, {user.displayName || user.email}!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search projects..."
                  className="pl-10 w-64 bg-white/50 border-white/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <DropdownMenu
                  open={notifDropdownOpen}
                  onOpenChange={setNotifDropdownOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 p-0">
                    <div className="p-3 border-b font-semibold text-gray-700 flex justify-between items-center">
                      Notifications
                      {notifications.length > 0 && (
                        <button
                          onClick={clearNotifications}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No notifications
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div key={notif.id} className="p-3 text-sm">
                            {notif.type === "expense_added" ? (
                              <div>
                                <span className="font-semibold text-emerald-700">
                                  {notif.byName || "A member"}
                                </span>{" "}
                                added an expense:
                                <br />
                                <span className="font-medium">
                                  {notif.description}
                                </span>{" "}
                                <span className="text-gray-500">
                                  (₹{notif.amount})
                                </span>
                              </div>
                            ) : (
                              <span>Unknown notification</span>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                              {notif.createdAt &&
                                new Date(
                                  notif.createdAt.seconds * 1000
                                ).toLocaleString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                  month: "short",
                                  day: "numeric",
                                })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Avatar className="w-10 h-10 ring-2 ring-purple-500/20">
                <AvatarImage
                  src={user.photoURL || "/placeholder.svg?height=40&width=40"}
                />
                <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  {user.displayName ? user.displayName[0] : "U"}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="outline"
                className="hidden sm:flex border-gray-200 hover:bg-gray-50"
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-purple-500 to-pink-500 border-0 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">
                    Total Projects
                  </p>
                  <p className="text-3xl font-bold">
                    {projectsWithExpenses.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500 to-cyan-500 border-0 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">
                    Total Budget
                  </p>
                  <p className="text-3xl font-bold">
                    ₹{(totalBudget / 100000).toFixed(1)}L
                  </p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-emerald-500 to-teal-500 border-0 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">
                    Total Spent
                  </p>
                  <p className="text-3xl font-bold">
                    ₹{(totalSpent / 100000).toFixed(1)}L
                  </p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Your Projects
            </h2>
            <p className="text-gray-500 mt-1">
              Manage and track your collaborative expenses
            </p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {projectsWithExpenses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projectsWithExpenses
              .filter((project) =>
                project.projectName.toLowerCase().includes(search.toLowerCase())
              )
              .map((project) => {
                const totalSpent = project.expenses
                  ? project.expenses.reduce(
                      (s: number, e: any) => s + (e.amount || 0),
                      0
                    )
                  : 0;
                const spentPercentage =
                  (totalSpent / (project.totalBudget || 1)) * 100;
                const color = "from-purple-500 to-pink-500"; // You can randomize or assign based on project
                return (
                  <Link key={project.id} href={`/project/${project.id}`}>
                    <Card className="group hover:shadow-2xl transition-all duration-300 transform hover:scale-105 bg-white/80 backdrop-blur-sm border-white/20 overflow-hidden relative">
                      <div
                        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${color}`}
                      ></div>
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                              {project.projectName}
                            </h3>
                            <p className="text-gray-500 text-sm">
                              Budget: ₹
                              {project.totalBudget.toLocaleString("en-US")}
                            </p>
                          </div>
                          <div
                            className={`w-12 h-12 bg-gradient-to-r ${color} rounded-xl flex items-center justify-center shadow-lg`}
                          >
                            <TrendingUp className="w-6 h-6 text-white" />
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-600">Spent</span>
                            <span className="font-semibold">
                              ₹{totalSpent.toLocaleString("en-US")}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
                              style={{
                                width: `${Math.min(spentPercentage, 100)}%`,
                              }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {spentPercentage.toFixed(1)}% of budget used
                          </p>
                        </div>

                        {/* Members */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              {project.members
                                ? Object.keys(project.members).length
                                : 0}{" "}
                              members
                            </span>
                          </div>
                          <div className="flex -space-x-2">
                            {project.allUids &&
                              project.allUids.slice(0, 3).map((uid: string) => {
                                const member =
                                  project.members?.[uid] || userMap[uid];
                                if (!member) return null;
                                return (
                                  <Avatar
                                    key={uid}
                                    className="h-8 w-8 border-2 border-white shadow-sm"
                                  >
                                    <AvatarImage
                                      src={
                                        member.photoURL || "/placeholder.svg"
                                      }
                                    />
                                    <AvatarFallback className="text-xs bg-gradient-to-r from-gray-400 to-gray-500 text-white">
                                      {member.displayName
                                        ? member.displayName[0]
                                        : "M"}
                                    </AvatarFallback>
                                  </Avatar>
                                );
                              })}
                            {project.allUids && project.allUids.length > 3 && (
                              <div className="h-8 w-8 bg-gray-100 border-2 border-white rounded-full flex items-center justify-center shadow-sm">
                                <span className="text-xs text-gray-600">
                                  +{project.allUids.length - 3}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Plus className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Ready to start tracking?
              </h3>
              <p className="text-gray-500 mb-8 text-lg">
                Create your first project and invite your team to collaborate on
                expense tracking.
              </p>
              <Button
                onClick={() => setIsModalOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 px-8 py-3 text-lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Project
              </Button>
            </div>
          </div>
        )}
      </main>

      <NewProjectModal
        open={isModalOpen}
        onOpenChange={() => setIsModalOpen(false)}
      />
    </div>
  );
}
