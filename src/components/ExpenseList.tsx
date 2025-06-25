"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { deleteExpense } from "@/lib/firestore";
import { Expense, Project } from "@/lib/types";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Receipt,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import { Timestamp } from "firebase/firestore";
import Image from "next/image";

interface ExpenseListProps {
  projectId: string;
  project: Project;
}

const ExpenseList = ({ projectId, project }: ExpenseListProps) => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptDialogUrl, setReceiptDialogUrl] = useState<string | null>(null);
  const [receiptDialogType, setReceiptDialogType] = useState<string | null>(
    null
  );
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number>(
    new Date().getFullYear()
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    expenseId: string;
    imagePath: string | null;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
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
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteExpense(
        projectId,
        pendingDelete.expenseId,
        pendingDelete.imagePath
      );
      setDeleteDialogOpen(false);
      setPendingDelete(null);
    } catch (error) {
      console.error("Failed to delete expense:", error);
      // Optionally show a toast or error dialog here
    }
  };

  // Helper to format date
  function formatDate(ts: Timestamp) {
    const d = ts.toDate();
    return d.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Filter expenses by selected month/year
  const filteredExpenses = expenses.filter((expense) => {
    const d = expense.createdAt.toDate();
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  // For month/year selector
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const years = Array.from(
    new Set(expenses.map((e) => e.createdAt.toDate().getFullYear()))
  );
  if (!years.includes(new Date().getFullYear()))
    years.push(new Date().getFullYear());
  years.sort((a, b) => b - a);

  if (loading) {
    return <p>Loading expenses...</p>;
  }

  const currentUserId = user?.uid || "";

  const categoryColors: Record<string, string> = {
    "Construction Material": "from-orange-500 to-red-500",
    Labor: "from-blue-500 to-cyan-500",
    Equipment: "from-purple-500 to-pink-500",
    Transportation: "from-green-500 to-emerald-500",
    Utilities: "from-yellow-500 to-orange-500",
    Other: "from-gray-500 to-slate-500",
  };

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
        <CardHeader className="pb-6">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            Recent Expenses ({filteredExpenses.length})
          </CardTitle>
          <p className="text-gray-500">
            Track all project expenses and receipts
          </p>
          {/* Filter UI */}
          <div className="flex items-center gap-2 mt-4">
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
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-10 sm:py-16">
              <div className="w-20 h-20 sm:w-32 sm:h-32 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-2xl">
                <Receipt className="h-10 w-10 sm:h-16 sm:w-16 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-4">
                No expenses recorded yet
              </h3>
              <p className="text-gray-500 text-base sm:text-lg max-w-xs sm:max-w-md mx-auto">
                Start tracking your project expenses by clicking the &quot;Add
                Expense&quot; button above. Keep your team informed about
                spending in real-time.
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredExpenses.map((expense, index) => {
                const member = project.members[expense.createdBy];
                const isCurrentUser = expense.createdBy === currentUserId;
                const categoryColor =
                  categoryColors[expense.category] || categoryColors["Other"];
                const imageUrl = (expense as { imageUrl?: string }).imageUrl;
                const imagePath =
                  (expense as { imagePath?: string }).imagePath ?? null;
                const fileType = imageUrl
                  ? imageUrl.split(".").pop()?.toLowerCase()
                  : null;
                const isImage =
                  fileType &&
                  ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(
                    fileType
                  );
                return (
                  <div
                    key={expense.id}
                    className="group p-4 sm:p-6 border border-gray-200 rounded-xl sm:rounded-2xl hover:shadow-lg transition-all duration-300 bg-white/70 backdrop-blur-sm hover:bg-white/90"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                        <Avatar className="h-10 w-10 sm:h-12 sm:w-12 ring-2 ring-purple-500/20 shadow-lg">
                          <AvatarImage
                            src={member?.photoURL || "/placeholder.svg"}
                          />
                          <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold">
                            {member?.displayName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                            <h3 className="font-bold text-gray-900 text-base sm:text-lg truncate">
                              {expense.description}
                            </h3>
                            <div
                              className={`px-2 sm:px-3 py-1 rounded-full bg-gradient-to-r ${categoryColor} text-white text-xs font-semibold`}
                            >
                              {expense.category}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Added by {member?.displayName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(expense.createdAt)}
                            </span>
                            {imageUrl && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="ml-2 px-2 sm:px-3 py-1 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => {
                                  if (isImage) {
                                    setReceiptDialogUrl(imageUrl);
                                    setReceiptDialogType(fileType!);
                                  } else {
                                    window.open(imageUrl, "_blank");
                                  }
                                }}
                              >
                                View Receipt
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <p className="text-xl sm:text-2xl font-bold text-gray-900">
                            ₹{expense.amount.toLocaleString()}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-500">
                            Expense #{index + 1}
                          </p>
                        </div>
                        {isCurrentUser && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                onClick={() => {
                                  setPendingDelete({
                                    expenseId: expense.id,
                                    imagePath,
                                  });
                                  setDeleteDialogOpen(true);
                                }}
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50 w-8 h-8 sm:w-10 sm:h-10"
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </AlertDialogTrigger>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Receipt Dialog */}
      <Dialog
        open={!!receiptDialogUrl}
        onOpenChange={() => setReceiptDialogUrl(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          {receiptDialogUrl &&
          receiptDialogType &&
          ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(
            receiptDialogType
          ) ? (
            <Image
              src={receiptDialogUrl}
              alt="Receipt"
              width={600}
              height={800}
              className="w-full rounded-xl"
              style={{ height: "auto" }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 pt-4">
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ExpenseList;
