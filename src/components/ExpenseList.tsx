"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { deleteExpense, updateExpense } from "@/lib/firestore";
import { Expense, Project } from "@/lib/types";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDoc,
} from "firebase/firestore";
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
  DollarSign,
  Tag,
  Upload,
  X,
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
import { toast } from "sonner";
import {
  Dialog as EditDialog,
  DialogContent as EditDialogContent,
  DialogHeader as EditDialogHeader,
  DialogTitle as EditDialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { categories, compressImage } from "@/lib/utils";

interface ExpenseListProps {
  projectId: string;
  project: Project;
}

// User type for fetched users
type User = {
  displayName: string;
  email: string;
  photoURL?: string;
};

type ReceiptFile = {
  imageUrl: string;
  imagePath?: string;
  name?: string;
  type: string;
};

const ExpenseList = ({ projectId, project }: ExpenseListProps) => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptDialogFiles, setReceiptDialogFiles] = useState<
    ReceiptFile[] | null
  >(null);
  const [receiptDialogIndex, setReceiptDialogIndex] = useState(0);
  const [filterMonth, setFilterMonth] = useState<number>(() =>
    new Date().getMonth()
  );
  const [filterYear, setFilterYear] = useState<number>(() =>
    new Date().getFullYear()
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    expenseId: string;
    imagePath: string | null;
  } | null>(null);
  const [userMap, setUserMap] = useState<Record<string, User>>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

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

  // Fetch user data for expenses not in project.members
  useEffect(() => {
    const missingUids = expenses
      .map((expense) => expense.createdBy)
      .filter((uid) => !project.members[uid] && !userMap[uid]);
    if (missingUids.length === 0) return;
    const fetchUsers = async () => {
      const updates: Record<string, User> = {};
      await Promise.all(
        missingUids.map(async (uid) => {
          try {
            const userDoc = await getDoc(doc(db, "users", uid));
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
  }, [expenses, project.members]);

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
      toast.success("Expense deleted successfully!");
    } catch (error) {
      console.error("Failed to delete expense:", error);
      toast.error("Failed to delete expense. Please try again.");
    }
  };

  // Helper to format date
  function formatDate(ts: Timestamp) {
    const d = ts.toDate();
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
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

  // Group expenses by date string
  function groupExpensesByDate(expenses: Expense[]) {
    const grouped: Record<string, Expense[]> = {};
    for (const expense of expenses) {
      const dateStr = expense.createdAt.toDate().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(expense);
    }
    return grouped;
  }

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
            <div className="space-y-6 sm:space-y-8">
              {Object.entries(groupExpensesByDate(filteredExpenses)).map(
                ([date, expenses]) => (
                  <div key={date}>
                    <div className="font-bold text-lg text-gray-700 mb-2 mt-6">
                      {date}
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                      {expenses.map((expense, index) => {
                        const member =
                          project.members[expense.createdBy] ||
                          userMap[expense.createdBy];
                        const isCurrentUser =
                          expense.createdBy === currentUserId;
                        const categoryColor =
                          categoryColors[expense.category] ||
                          categoryColors["Other"];
                        const receipts = (
                          expense as { receipts?: ReceiptFile[] }
                        ).receipts;
                        const imageUrl = (expense as { imageUrl?: string })
                          ?.imageUrl;
                        const imagePath =
                          (expense as { imagePath?: string })?.imagePath ??
                          null;
                        let receiptFiles: ReceiptFile[] = [];
                        if (
                          receipts &&
                          Array.isArray(receipts) &&
                          receipts.length > 0
                        ) {
                          receiptFiles = receipts as ReceiptFile[];
                        } else if (imageUrl) {
                          // fallback for old data
                          receiptFiles = [
                            {
                              imageUrl,
                              imagePath: imagePath ?? undefined,
                              name: imageUrl.split("/").pop(),
                              type: "image/jpeg",
                            },
                          ];
                        }
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
                                    {receiptFiles.length > 0 && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="ml-2 px-2 sm:px-3 py-1 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                        onClick={() => {
                                          setReceiptDialogFiles(receiptFiles);
                                          setReceiptDialogIndex(0);
                                          setReceiptDialogOpen(true);
                                        }}
                                      >
                                        View Receipt
                                        {receiptFiles.length > 1 ? "s" : ""}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="text-right">
                                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                                    ₹{expense.amount.toLocaleString("en-US")}
                                  </p>
                                  <p className="text-xs sm:text-sm text-gray-500">
                                    Expense #{index + 1}
                                  </p>
                                </div>
                                {isCurrentUser && (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 hover:bg-blue-50 w-8 h-8 sm:w-10 sm:h-10"
                                      onClick={() => {
                                        setEditingExpense(expense);
                                        setEditModalOpen(true);
                                      }}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={1.5}
                                        stroke="currentColor"
                                        className="w-5 h-5"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L7.5 19.79l-4 1 1-4 14.362-14.303ZM19 7l-2-2"
                                        />
                                      </svg>
                                    </Button>
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
                                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50 w-8 h-8 sm:w-10 sm:h-10"
                                        >
                                          <Trash2 className="h-5 w-5" />
                                        </Button>
                                      </AlertDialogTrigger>
                                    </AlertDialog>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Multi-Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          {receiptDialogFiles && receiptDialogFiles.length > 0 && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={receiptDialogIndex === 0}
                  onClick={() =>
                    setReceiptDialogIndex((i) => Math.max(0, i - 1))
                  }
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <span className="text-sm text-gray-600">
                  {receiptDialogIndex + 1} / {receiptDialogFiles.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={
                    receiptDialogIndex === receiptDialogFiles.length - 1
                  }
                  onClick={() =>
                    setReceiptDialogIndex((i) =>
                      Math.min(receiptDialogFiles.length - 1, i + 1)
                    )
                  }
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
              {(() => {
                const file = receiptDialogFiles[receiptDialogIndex];
                if (!file) return null;
                if (file.type.startsWith("image/")) {
                  return (
                    <Image
                      src={file.imageUrl}
                      alt={file.name || "Receipt"}
                      width={600}
                      height={800}
                      className="w-full rounded-xl"
                      style={{ height: "auto" }}
                    />
                  );
                } else if (file.type === "application/pdf") {
                  return (
                    <a
                      href={file.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline text-center block"
                    >
                      Open PDF: {file.name}
                    </a>
                  );
                } else {
                  return <span>Unsupported file type</span>;
                }
              })()}
              <div className="flex gap-2 mt-2 flex-wrap justify-center">
                {receiptDialogFiles.map((file, idx) => (
                  <button
                    key={file.imageUrl + idx}
                    className={`border-2 rounded-md p-1 ${
                      idx === receiptDialogIndex
                        ? "border-emerald-500"
                        : "border-transparent"
                    }`}
                    onClick={() => setReceiptDialogIndex(idx)}
                    type="button"
                  >
                    {file.type.startsWith("image/") ? (
                      <Image
                        src={file.imageUrl}
                        alt={file.name || "Receipt"}
                        width={60}
                        height={60}
                        className="object-cover rounded"
                      />
                    ) : (
                      <span className="text-xs text-blue-600">PDF</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
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
      {/* Edit Expense Modal */}
      <EditDialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <EditDialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-none bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl p-6">
          <EditDialogHeader className="pb-6">
            <EditDialogTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16.862 4.487a2.1 2.1 0 012.97 2.97L7.5 19.79l-4 1 1-4 14.362-14.303zM19 7l-2-2"
                  />
                </svg>
              </div>
              Edit Expense
            </EditDialogTitle>
            <p className="text-gray-500 text-base sm:text-lg">
              Update this expense&apos;s details and receipts
            </p>
          </EditDialogHeader>
          {editingExpense && (
            <EditExpenseForm
              expense={editingExpense}
              projectId={projectId}
              onClose={() => {
                setEditModalOpen(false);
                setEditingExpense(null);
              }}
              onExpenseUpdated={() => {
                setEditModalOpen(false);
                setEditingExpense(null);
              }}
            />
          )}
        </EditDialogContent>
      </EditDialog>
    </>
  );
};

function EditExpenseForm({
  expense,
  projectId,
  onClose,
  onExpenseUpdated,
}: {
  expense: Expense;
  projectId: string;
  onClose: () => void;
  onExpenseUpdated: () => void;
}) {
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(expense.amount.toString());
  const [category, setCategory] = useState(expense.category);
  const [date, setDate] = useState(() =>
    expense.createdAt.toDate().toISOString().slice(0, 10)
  );
  const [files, setFiles] = useState<File[]>([]);
  const [existingReceipts, setExistingReceipts] = useState<ReceiptFile[]>(
    (expense as { receipts?: ReceiptFile[] }).receipts || []
  );
  const [receiptsToRemove, setReceiptsToRemove] = useState<string[]>([]); // imagePath
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCategory = categories.find((cat) => cat.value === category);

  const handleRemoveExisting = (imagePath: string) => {
    setReceiptsToRemove((prev) => [...prev, imagePath]);
    setExistingReceipts((prev) =>
      prev.filter((r) => r.imagePath !== imagePath)
    );
  };

  const handleRemoveNew = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setError("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    const selectedFiles: File[] = Array.from(fileList);
    for (const file of selectedFiles) {
      if (!allowedTypes.includes(file.type)) {
        setError("Only JPG, JPEG, PNG, or PDF files are allowed.");
        setFiles([]);
        return;
      }
    }
    setError("");
    setCompressing(true);
    try {
      const processedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          if (file.type === "application/pdf") return file;
          try {
            return await compressImage(file);
          } catch {
            return file;
          }
        })
      );
      setFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        return [
          ...prev,
          ...processedFiles.filter((f) => !existingNames.has(f.name)),
        ];
      });
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // 1. Upload new files
      let newReceipts: ReceiptFile[] = [];
      if (files.length > 0) {
        const { uploadBytes, getDownloadURL, ref } = await import(
          "firebase/storage"
        );
        const { storage } = await import("@/lib/firebase");
        newReceipts = await Promise.all(
          files.map(async (file) => {
            const imageRef = ref(
              storage,
              `expenses/${projectId}/${Date.now()}_${file.name}`
            );
            const snapshot = await uploadBytes(imageRef, file);
            const imageUrl = await getDownloadURL(snapshot.ref);
            return {
              imageUrl,
              imagePath: snapshot.ref.fullPath,
              name: file.name,
              type: file.type,
            };
          })
        );
      }
      // 2. Remove deleted receipts from existingReceipts
      const updatedReceipts = [
        ...existingReceipts.filter(
          (r) => !receiptsToRemove.includes(r.imagePath || "")
        ),
        ...newReceipts,
      ];
      // 3. Update expense
      await updateExpense(projectId, expense.id, {
        description,
        amount: Number(amount),
        category,
        createdAt: Timestamp.fromDate(new Date(date)),
        receipts: updatedReceipts,
      });
      onExpenseUpdated();
      toast.success("Expense updated successfully!");
    } catch {
      setError("Failed to update expense. Please try again.");
      toast.error("Failed to update expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      <div className="space-y-2 sm:space-y-3">
        <Label
          htmlFor="description"
          className="text-sm font-semibold text-gray-700 flex items-center gap-1 sm:gap-2"
        >
          <Receipt className="w-4 h-4 text-emerald-600" />
          Description
        </Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What did you spend on? (e.g., Office supplies, Equipment rental)"
          className="h-10 sm:h-12 bg-white/70 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 text-base"
          required
        />
      </div>
      <div className="space-y-2 sm:space-y-3">
        <Label
          htmlFor="amount"
          className="text-sm font-semibold text-gray-700 flex items-center gap-1 sm:gap-2"
        >
          <DollarSign className="w-4 h-4 text-emerald-600" />
          Amount
        </Label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold text-lg">
            ₹
          </span>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="h-12 sm:h-14 pl-10 sm:pl-12 text-lg sm:text-xl font-bold bg-white/70 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20"
            required
          />
        </div>
      </div>
      <div className="space-y-2 sm:space-y-3">
        <Label
          htmlFor="category"
          className="text-sm font-semibold text-gray-700 flex items-center gap-1 sm:gap-2"
        >
          <Tag className="w-4 h-4 text-emerald-600" />
          Category
        </Label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 sm:h-12 bg-white/70 border-gray-200 focus:border-emerald-500 rounded-lg w-full px-2 sm:px-3 text-base"
          required
        >
          <option value="" disabled>
            Select expense category
          </option>
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.icon} {cat.label}
            </option>
          ))}
        </select>
        {selectedCategory && (
          <div
            className={`p-2 sm:p-3 rounded-xl bg-gradient-to-r ${selectedCategory.color} bg-opacity-10 border border-opacity-20`}
          >
            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium">
              <span className="text-base sm:text-lg">
                {selectedCategory.icon}
              </span>
              <span>Selected: {selectedCategory.label}</span>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2 sm:space-y-3">
        <Label
          htmlFor="date"
          className="text-sm font-semibold text-gray-700 flex items-center gap-1 sm:gap-2"
        >
          <Calendar className="w-4 h-4 text-emerald-600" />
          Date
        </Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 sm:h-12 bg-white/70 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 text-base"
          required
        />
      </div>
      <div className="space-y-2 sm:space-y-3">
        {(existingReceipts.length > 0 || files.length > 0) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {existingReceipts.map((file, idx) => (
              <div
                key={file.imagePath || file.imageUrl || idx}
                className="flex items-center bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1 text-sm shadow-sm gap-2"
              >
                <span className="truncate max-w-[120px]">{file.name}</span>
                <button
                  type="button"
                  aria-label="Remove file"
                  className="text-emerald-600 hover:text-red-500 focus:outline-none"
                  onClick={() => handleRemoveExisting(file.imagePath || "")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {files.map((file, idx) => (
              <div
                key={file.name + idx}
                className="flex items-center bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1 text-sm shadow-sm gap-2"
              >
                <span className="truncate max-w-[120px]">{file.name}</span>
                <button
                  type="button"
                  aria-label="Remove file"
                  className="text-emerald-600 hover:text-red-500 focus:outline-none"
                  onClick={() => handleRemoveNew(idx)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Label
          htmlFor="edit-receipt"
          className="text-sm font-semibold text-gray-700 flex items-center gap-1 sm:gap-2"
        >
          <Upload className="w-4 h-4 text-emerald-600" />
          Upload Receipt (Optional)
        </Label>
        <div className="border-2 border-dashed border-emerald-200 rounded-xl sm:rounded-2xl p-4 sm:p-8 text-center hover:border-emerald-400 transition-colors bg-gradient-to-br from-emerald-50 to-teal-50 group cursor-pointer">
          <input
            id="edit-receipt"
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="edit-receipt" className="cursor-pointer">
            <div className="w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
              {files.length > 0 || existingReceipts.length > 0 ? (
                <Receipt className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              ) : (
                <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              )}
            </div>
            <p className="font-semibold text-gray-700 mb-1 text-xs sm:text-base">
              {compressing ? "Compressing..." : "Click to upload receipt(s)"}
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              PNG, JPG or PDF up to 10MB
            </p>
          </label>
        </div>
      </div>
      {error && (
        <div className="text-red-500 text-xs sm:text-sm text-center">
          {error}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1 h-10 sm:h-12 border-gray-300 hover:bg-gray-50"
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 h-10 sm:h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-base font-semibold"
          disabled={loading || compressing}
        >
          <svg
            className="h-4 w-4 sm:h-5 sm:w-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16.862 4.487a2.1 2.1 0 012.97 2.97L7.5 19.79l-4 1 1-4 14.362-14.303zM19 7l-2-2"
            />
          </svg>
          {loading ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

export default ExpenseList;
