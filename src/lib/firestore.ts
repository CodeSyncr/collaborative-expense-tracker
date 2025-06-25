/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "./firebase";

export const createProject = async (
  projectName: string,
  totalBudget: number,
  members: { email: string; contribution: number }[],
  ownerId: string
) => {
  try {
    const memberEmails = members.map((m) => m.email);

    // 1. Resolve member emails to UIDs and user data
    const usersQuery = query(
      collection(db, "users"),
      where("email", "in", memberEmails)
    );
    const usersSnapshot = await getDocs(usersQuery);

    const foundUsers: { [email: string]: any } = {};
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      foundUsers[userData.email] = { uid: doc.id, ...userData };
    });

    // Check if all members were found
    if (Object.keys(foundUsers).length !== memberEmails.length) {
      const notFoundEmails = memberEmails.filter((email) => !foundUsers[email]);
      throw new Error(`Could not find user(s): ${notFoundEmails.join(", ")}`);
    }

    // 2. Prepare the members map for the project document
    const membersMap: { [uid: string]: any } = {};
    members.forEach((member) => {
      const user = foundUsers[member.email];
      membersMap[user.uid] = {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        contribution: member.contribution,
      };
    });

    const memberUids = Object.keys(membersMap);

    // 3. Create the project document
    const projectDocRef = await addDoc(collection(db, "projects"), {
      projectName,
      totalBudget,
      ownerId,
      members: membersMap,
      memberEmails,
      memberUids, // For secure querying
      createdAt: new Date(),
      shareableId: null, // Initially null
    });

    return { id: projectDocRef.id };
  } catch (error) {
    console.error("Error creating project: ", error);
    throw error;
  }
};

export const addExpense = async (
  projectId: string,
  expenseData: {
    description: string;
    amount: number;
    category: string;
    createdBy: string; // user.uid
    createdAt?: Timestamp;
  },
  receiptFiles: File[]
) => {
  try {
    // 1. Upload all files to Storage if any
    let receipts: {
      imageUrl: string;
      imagePath: string;
      name: string;
      type: string;
    }[] = [];
    if (receiptFiles && receiptFiles.length > 0) {
      receipts = await Promise.all(
        receiptFiles.map(async (file) => {
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

    // 2. Add expense to the expenses subcollection of the project
    const expenseCollectionRef = collection(
      db,
      "projects",
      projectId,
      "expenses"
    );
    const docData = {
      ...expenseData,
      createdAt: expenseData.createdAt || Timestamp.now(),
      ...(receipts.length > 0 ? { receipts } : {}),
    };

    const expenseDocRef = await addDoc(expenseCollectionRef, docData);

    return { id: expenseDocRef.id };
  } catch (error) {
    console.error("Error adding expense: ", error);
    throw error;
  }
};

export const deleteExpense = async (
  projectId: string,
  expenseId: string,
  imagePath: string | null
) => {
  try {
    // 1. Delete image from Storage if it exists
    if (imagePath) {
      const imageRef = ref(storage, imagePath);
      await deleteObject(imageRef);
    }

    // 2. Delete expense document from Firestore
    const expenseDocRef = doc(db, "projects", projectId, "expenses", expenseId);
    await deleteDoc(expenseDocRef);
  } catch (error) {
    console.error("Error deleting expense: ", error);
    throw error;
  }
};

export const generateShareableLink = async (projectId: string) => {
  try {
    const shareableId = `shared-${projectId}-${Math.random()
      .toString(36)
      .substring(2, 10)}`;
    const projectDocRef = doc(db, "projects", projectId);
    await updateDoc(projectDocRef, { shareableId });
    return shareableId;
  } catch (error) {
    console.error("Error generating shareable link: ", error);
    throw error;
  }
};

// Delete a project and all its expenses
export const deleteProject = async (projectId: string) => {
  try {
    // Delete all expenses in the subcollection
    const expensesSnap = await getDocs(
      collection(db, "projects", projectId, "expenses")
    );
    const batchDeletes = expensesSnap.docs.map((docSnap) =>
      deleteDoc(docSnap.ref)
    );
    await Promise.all(batchDeletes);
    // Delete the project document
    await deleteDoc(doc(db, "projects", projectId));
  } catch (error) {
    console.error("Error deleting project: ", error);
    throw error;
  }
};

// Update project details
export const updateProject = async (
  projectId: string,
  updates: {
    projectName?: string;
    totalBudget?: number;
    members?: { [uid: string]: any };
    memberEmails?: string[];
    memberUids?: string[];
  }
) => {
  try {
    const projectDocRef = doc(db, "projects", projectId);
    await updateDoc(projectDocRef, updates);
  } catch (error) {
    console.error("Error updating project: ", error);
    throw error;
  }
};
