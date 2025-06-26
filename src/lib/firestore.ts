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
  getDoc,
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

    // 3. Send notifications to all project members except the creator
    // Fetch project to get members
    const projectDoc = await doc(db, "projects", projectId);
    const projectSnap = await getDoc(projectDoc);
    if (projectSnap.exists()) {
      const projectData = projectSnap.data();
      const members = projectData.members || {};
      const creatorUid = expenseData.createdBy;
      const creatorName = members[creatorUid]?.displayName || "Someone";
      const notification = {
        type: "expense_added",
        projectId,
        expenseId: expenseDocRef.id,
        by: creatorUid,
        byName: creatorName,
        description: expenseData.description,
        amount: expenseData.amount,
        createdAt: Timestamp.now(),
      };
      await Promise.all(
        Object.keys(members)
          .filter((uid) => uid !== creatorUid)
          .map((uid) =>
            addDoc(collection(db, "users", uid, "notifications"), notification)
          )
      );
    }

    return { id: expenseDocRef.id };
  } catch (error) {
    console.error("Error adding expense: ", error);
    throw error;
  }
};

export const deleteExpense = async (
  projectId: string,
  expenseId: string,
  imagePath: string | null,
  actorUid: string
) => {
  try {
    // 1. Delete image from Storage if it exists
    if (imagePath) {
      const imageRef = ref(storage, imagePath);
      await deleteObject(imageRef);
    }

    // 2. Fetch project and expense for notification BEFORE deleting
    const projectDocRef = doc(db, "projects", projectId);
    const projectSnap = await getDoc(projectDocRef);
    const expenseDocRef = doc(db, "projects", projectId, "expenses", expenseId);
    const expenseSnap = await getDoc(expenseDocRef);

    // 3. Delete expense document from Firestore
    await deleteDoc(expenseDocRef);

    // 4. Send notification
    if (projectSnap.exists() && expenseSnap.exists()) {
      const projectData = projectSnap.data();
      const members = projectData.members || {};
      const actorName = members[actorUid]?.displayName || "Someone";
      const expenseData = expenseSnap.data();
      const notification = {
        type: "expense_deleted",
        projectId,
        expenseId,
        by: actorUid,
        byName: actorName,
        description: expenseData.description,
        amount: expenseData.amount,
        createdAt: Timestamp.now(),
      };
      await Promise.all(
        Object.keys(members)
          .filter((uid) => uid !== actorUid)
          .map((uid) =>
            addDoc(collection(db, "users", uid, "notifications"), notification)
          )
      );
    }
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

// Update an expense
export const updateExpense = async (
  projectId: string,
  expenseId: string,
  updates: Partial<{
    description: string;
    amount: number;
    category: string;
    createdAt: Timestamp;
    receipts: any[];
  }>,
  actorUid: string
) => {
  try {
    const expenseDocRef = doc(db, "projects", projectId, "expenses", expenseId);
    await updateDoc(expenseDocRef, updates);

    // Fetch project and updated expense for notification
    const projectDocRef = doc(db, "projects", projectId);
    const projectSnap = await getDoc(projectDocRef);
    const expenseSnap = await getDoc(expenseDocRef);
    if (projectSnap.exists() && expenseSnap.exists()) {
      const projectData = projectSnap.data();
      const members = projectData.members || {};
      const actorName = members[actorUid]?.displayName || "Someone";
      const expenseData = expenseSnap.data();
      const notification = {
        type: "expense_edited",
        projectId,
        expenseId,
        by: actorUid,
        byName: actorName,
        description: expenseData.description,
        amount: expenseData.amount,
        createdAt: Timestamp.now(),
      };
      await Promise.all(
        Object.keys(members)
          .filter((uid) => uid !== actorUid)
          .map((uid) =>
            addDoc(collection(db, "users", uid, "notifications"), notification)
          )
      );
    }
  } catch (error) {
    console.error("Error updating expense: ", error);
    throw error;
  }
};
