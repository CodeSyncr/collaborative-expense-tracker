import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const categories = [
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

export async function compressImage(
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
