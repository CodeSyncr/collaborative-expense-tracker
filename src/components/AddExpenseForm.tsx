"use client";

import { useAuth } from "@/context/AuthContext";
import { addExpense } from "@/lib/firestore";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  Plus,
  Receipt,
  DollarSign,
  Tag,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";

interface AddExpenseFormProps {
  open: boolean;
  projectId: string;
  onExpenseAdded: () => void;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  {
    value: "Construction Material",
    label: "Construction Material",
    color: "from-orange-500 to-red-500",
    icon: "🏗️",
  },
  {
    value: "Labor",
    label: "Labor",
    color: "from-blue-500 to-cyan-500",
    icon: "👷",
  },
  {
    value: "Equipment Rental",
    label: "Equipment Rental",
    color: "from-purple-500 to-pink-500",
    icon: "🔧",
  },
  {
    value: "Transportation",
    label: "Transportation",
    color: "from-green-500 to-emerald-500",
    icon: "🚚",
  },
  {
    value: "Utilities",
    label: "Utilities",
    color: "from-yellow-500 to-orange-500",
    icon: "⚡",
  },
  {
    value: "Carpentering",
    label: "Carpentering",
    color: "from-amber-700 to-yellow-400",
    icon: "🪚",
  },
  {
    value: "Painting",
    label: "Painting",
    color: "from-pink-500 to-yellow-300",
    icon: "🎨",
  },
  {
    value: "Interior Design",
    label: "Interior Design",
    color: "from-indigo-500 to-pink-400",
    icon: "🛋️",
  },
  {
    value: "Consultancy",
    label: "Consultancy",
    color: "from-blue-900 to-blue-400",
    icon: "💼",
  },
  {
    value: "Legal Fees",
    label: "Legal Fees",
    color: "from-gray-700 to-gray-400",
    icon: "📜",
  },
  {
    value: "Permits & Licenses",
    label: "Permits & Licenses",
    color: "from-green-700 to-green-300",
    icon: "📝",
  },
  {
    value: "Cleaning",
    label: "Cleaning",
    color: "from-teal-400 to-blue-200",
    icon: "🧹",
  },
  {
    value: "Miscellaneous",
    label: "Miscellaneous",
    color: "from-gray-500 to-slate-500",
    icon: "📦",
  },
  {
    value: "Other",
    label: "Other",
    color: "from-gray-400 to-gray-600",
    icon: "❓",
  },
];

// Utility to compress image to JPEG
async function compressImage(
  file: File,
  maxSize = 1200,
  quality = 0.7
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          resolve(
            new File([blob], file.name.replace(/\.(png|jpeg|jpg)$/i, ".jpg"), {
              type: "image/jpeg",
            })
          );
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = (e) => reject(e);
    img.src = URL.createObjectURL(file);
  });
}

const AddExpenseForm = ({
  projectId,
  onExpenseAdded,
  open,
  onOpenChange,
}: AddExpenseFormProps) => {
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0].value);
  const [files, setFiles] = useState<File[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to add an expense.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await addExpense(
        projectId,
        {
          description,
          amount: Number(amount),
          category,
          createdBy: user.uid,
          createdAt: Timestamp.fromDate(new Date(date)),
        },
        files
      );
      setDescription("");
      setAmount("");
      setCategory(categories[0].value);
      setFiles([]);
      setDate(() => {
        const today = new Date();
        return today.toISOString().slice(0, 10);
      });
      const fileInput = document.getElementById("receipt") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      onExpenseAdded();
    } catch (err) {
      console.error(err);
      setError("Failed to add expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find((cat) => cat.value === category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-none bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl p-6"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <DialogHeader className="pb-6">
          <DialogTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            Add New Expense
          </DialogTitle>
          <p className="text-gray-500 text-base sm:text-lg">
            Record a new expense for this project
          </p>
        </DialogHeader>
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
              <CalendarIcon className="w-4 h-4 text-emerald-600" />
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
            {files.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
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
                      onClick={() => {
                        setFiles((prev) => prev.filter((_, i) => i !== idx));
                        setError("");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Label
              htmlFor="receipt"
              className="text-sm font-semibold text-gray-700 flex items-center gap-1 sm:gap-2"
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              Upload Receipt (Optional)
            </Label>
            <div className="border-2 border-dashed border-emerald-200 rounded-xl sm:rounded-2xl p-4 sm:p-8 text-center hover:border-emerald-400 transition-colors bg-gradient-to-br from-emerald-50 to-teal-50 group cursor-pointer">
              <input
                id="receipt"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                multiple
                onChange={async (e) => {
                  const fileList = e.target.files;
                  if (!fileList || fileList.length === 0) return;
                  const allowedTypes = [
                    "image/jpeg",
                    "image/png",
                    "application/pdf",
                  ];
                  const selectedFiles: File[] = Array.from(fileList);
                  for (const file of selectedFiles) {
                    if (!allowedTypes.includes(file.type)) {
                      setError(
                        "Only JPG, JPEG, PNG, or PDF files are allowed."
                      );
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
                        ...processedFiles.filter(
                          (f) => !existingNames.has(f.name)
                        ),
                      ];
                    });
                  } finally {
                    setCompressing(false);
                  }
                }}
                className="hidden"
              />
              <label htmlFor="receipt" className="cursor-pointer">
                <div className="w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
                  {files.length > 0 ? (
                    <Receipt className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  ) : (
                    <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  )}
                </div>
                <p className="font-semibold text-gray-700 mb-1 text-xs sm:text-base">
                  {compressing
                    ? "Compressing..."
                    : "Click to upload receipt(s)"}
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
              onClick={onExpenseAdded}
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
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              {loading ? "Adding..." : "Add Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </Dialog>
  );
};

export default AddExpenseForm;
