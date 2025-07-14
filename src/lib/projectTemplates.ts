export interface ProjectTemplate {
  name: string;
  description: string;
  categories: string[];
  sharedBudget: boolean;
  defaultMembers?: string[];
  monthlyBudget?: number;
}

export const projectTemplates: ProjectTemplate[] = [
  {
    name: "Trip/Vacation",
    description: "For group travel, holidays, or road trips.",
    categories: ["Transport", "Accommodation", "Food", "Activities", "Shopping", "Miscellaneous"],
    sharedBudget: true,
  },
  {
    name: "Roommates/Flatmates",
    description: "For people sharing a home or apartment.",
    categories: ["Rent", "Utilities", "Groceries", "Internet", "Cleaning", "Repairs"],
    sharedBudget: true,
    monthlyBudget: 0,
  },
  {
    name: "Event/Party",
    description: "For organizing parties, birthdays, or celebrations.",
    categories: ["Venue", "Food & Drinks", "Decorations", "Entertainment", "Gifts"],
    sharedBudget: true,
  },
  {
    name: "Office/Work Project",
    description: "For tracking shared work expenses.",
    categories: ["Office Supplies", "Meals", "Travel", "Software", "Miscellaneous"],
    sharedBudget: true,
  },
  {
    name: "Wedding",
    description: "For wedding planning and expense tracking.",
    categories: ["Venue", "Catering", "Attire", "Decorations", "Photography", "Gifts", "Miscellaneous"],
    sharedBudget: true,
  },
  {
    name: "Family Budget",
    description: "For managing household or family expenses.",
    categories: ["Groceries", "Utilities", "Education", "Healthcare", "Transport", "Entertainment"],
    sharedBudget: true,
    monthlyBudget: 0,
  },
  {
    name: "Charity/Fundraiser",
    description: "For organizing and tracking charity events or fundraisers.",
    categories: ["Donations", "Venue", "Marketing", "Supplies", "Miscellaneous"],
    sharedBudget: true,
  },
  {
    name: "Simple (Personal)",
    description: "Track your own expenses. No sharing or group calculations.",
    categories: ["Food & Drinks", "Shopping", "Transport", "Entertainment", "Bills", "Miscellaneous"],
    sharedBudget: false,
  },
  {
    name: "Custom",
    description: "Start from scratch and define your own categories.",
    categories: [],
    sharedBudget: true,
  },
]; 