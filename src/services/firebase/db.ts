import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './errorHandling';

export const getCollectionData = async (colName: string) => {
  try {
    const snapshot = await getDocs(collection(db, colName));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colName);
    return [];
  }
};

export const getDocData = async (colName: string, id: string): Promise<any> => {
  try {
    const docSnap = await getDoc(doc(db, colName, id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${colName}/${id}`);
    return null;
  }
};

export const addData = async (colName: string, data: any) => {
  try {
    const docRef = await addDoc(collection(db, colName), data);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, colName);
    throw error;
  }
};

export const setDocData = async (colName: string, id: string, data: any) => {
  try {
    await setDoc(doc(db, colName, id), data, { merge: true });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${colName}/${id}`);
    throw error;
  }
};

export const updateData = async (colName: string, id: string, data: any) => {
  try {
    await updateDoc(doc(db, colName, id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${colName}/${id}`);
    throw error;
  }
};

export const deleteData = async (colName: string, id: string) => {
  try {
    await deleteDoc(doc(db, colName, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${colName}/${id}`);
    throw error;
  }
};

export const subscribeCollection = (
  colName: string,
  onData: (data: any[]) => void,
  orderField?: string
) => {
  try {
    const colRef = orderField
      ? query(collection(db, colName), orderBy(orderField, 'desc'))
      : collection(db, colName);

    return onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, colName);
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colName);
    return () => {};
  }
};

export const subscribeDoc = (
  colName: string,
  id: string,
  onData: (data: any) => void
) => {
  try {
    return onSnapshot(
      doc(db, colName, id),
      (snapshot) => {
        if (snapshot.exists()) {
          onData({ id: snapshot.id, ...snapshot.data() });
        } else {
          onData(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `${colName}/${id}`);
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${colName}/${id}`);
    return () => {};
  }
};
