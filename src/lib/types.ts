import { Timestamp } from "firebase/firestore";

export interface Project {
  id: string;
  projectName: string;
  totalBudget: number;
  memberEmails: string[];
  members: {
    [uid: string]: {
      displayName: string;
      email: string;
      photoURL: string;
      contribution: number;
    };
  };
  sharedBudget?: boolean;
  projectType?: string;
  monthlyBudget?: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  createdBy: string;
  imageUrl?: string;
  imagePath?: string;
  createdAt: Timestamp;
}
