"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, Plus, Users, DollarSign } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createProject } from "@/lib/firestore";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Member {
  email: string;
  contribution: string;
  uid: string;
}

interface UserOption {
  uid: string;
  email: string;
  displayName: string;
}

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectModal({ open, onOpenChange }: NewProjectModalProps) {
  const { user } = useAuth();
  const [projectName, setProjectName] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  useEffect(() => {
    if (user?.email && user?.uid) {
      setMembers([{ email: user.email, contribution: "", uid: user.uid }]);
    }
  }, [user]);

  useEffect(() => {
    const fetchUsers = async () => {
      const usersSnap = await getDocs(collection(db, "users"));
      const users: UserOption[] = usersSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data.email,
          displayName: data.displayName || data.email,
        };
      });
      setUserOptions(users);
    };
    fetchUsers();
  }, []);

  const addMember = () => {
    setMembers([...members, { email: "", contribution: "", uid: "" }]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (
    index: number,
    field: keyof Member | "uid",
    value: string
  ) => {
    const updatedMembers = [...members];
    updatedMembers[index][field] = value;
    if (field === "uid") {
      const user = userOptions.find((u) => u.uid === value);
      if (user) updatedMembers[index].email = user.email;
    }
    setMembers(updatedMembers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("You must be logged in to create a project.");
      return;
    }
    if (!projectName.trim() || !totalBudget.trim()) {
      setError("Project name and total budget are required.");
      return;
    }
    const totalBudgetNum = Number(totalBudget);
    const memberContributions = members.map((m) => Number(m.contribution) || 0);
    const sumContributions = memberContributions.reduce((a, b) => a + b, 0);
    if (sumContributions !== totalBudgetNum) {
      setError(
        `Total contributions (₹${sumContributions}) must equal the total budget (₹${totalBudgetNum}).`
      );
      return;
    }
    setLoading(true);
    try {
      await createProject(
        projectName,
        totalBudgetNum,
        members.map((m) => ({
          email: m.email,
          contribution: Number(m.contribution),
        })),
        user.uid
      );
      onOpenChange(false);
      setProjectName("");
      setTotalBudget("");
      setMembers([
        { email: user.email ?? "", contribution: "", uid: user.uid },
      ]);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Failed to create project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-none bg-white/95 backdrop-blur-xl border-white/20"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <DialogHeader className="pb-6">
          <DialogTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Create New Project
          </DialogTitle>
          <p className="text-gray-500 text-base sm:text-lg">
            Set up a new collaborative expense tracking project
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="space-y-2 sm:space-y-3">
            <Label
              htmlFor="projectName"
              className="text-sm font-semibold text-gray-700"
            >
              Project Name
            </Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Office Renovation, Marketing Campaign"
              className="h-10 sm:h-12 bg-white/50 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20"
              required
            />
          </div>

          <div className="space-y-2 sm:space-y-3">
            <Label
              htmlFor="totalBudget"
              className="text-sm font-semibold text-gray-700"
            >
              Total Budget
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <Input
                id="totalBudget"
                type="number"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                placeholder="500000"
                className="h-10 sm:h-12 pl-8 sm:pl-12 bg-white/50 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20"
                required
              />
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              <Label className="text-sm font-semibold text-gray-700">
                Team Members & Contributions
              </Label>
            </div>

            <div className="space-y-2 sm:space-y-3">
              {members.map((member, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-end p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg sm:rounded-xl border border-purple-100"
                >
                  <div className="flex-1">
                    <Label className="text-xs text-gray-600 mb-1 block">
                      Member
                    </Label>
                    {index === 0 ? (
                      <Input
                        type="text"
                        value={user?.displayName || user?.email || ""}
                        readOnly
                        className="bg-white/70 border-white/50 focus:border-purple-500"
                      />
                    ) : (
                      <select
                        value={member.uid}
                        onChange={(e) =>
                          updateMember(index, "uid", e.target.value)
                        }
                        className="bg-white/70 border-white/50 focus:border-purple-500 rounded-md h-10 w-full"
                        required
                      >
                        <option value="" disabled>
                          Select a user
                        </option>
                        {userOptions
                          .filter(
                            (u) =>
                              u.uid !== user?.uid &&
                              !members.some(
                                (m, i) => i !== index && m.uid === u.uid
                              )
                          )
                          .map((u) => (
                            <option key={u.uid} value={u.uid}>
                              {u.displayName} ({u.email})
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-600 mb-1 block">
                      Contribution Amount
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs sm:text-sm">
                        ₹
                      </span>
                      <Input
                        type="number"
                        value={member.contribution}
                        onChange={(e) =>
                          updateMember(index, "contribution", e.target.value)
                        }
                        placeholder="250000"
                        className="pl-6 sm:pl-8 bg-white/70 border-white/50 focus:border-purple-500"
                        required
                      />
                    </div>
                  </div>
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMember(index)}
                      className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addMember}
              className="w-full border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
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
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10 sm:h-12"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-10 sm:h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Project"}
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
}
