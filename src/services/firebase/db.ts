import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './errorHandling';

export const getCollectionData = async (colName: string) => {
  try {
    const snapshot = await getDocs(collection(db, colName));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colName);
  }
};

export const addData = async (colName: string, data: any) => {
  try {
    return await addDoc(collection(db, colName), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, colName);
  }
};

export const updateData = async (colName: string, id: string, data: any) => {
  try {
    await updateDoc(doc(db, colName, id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${colName}/${id}`);
  }
};

export const deleteData = async (colName: string, id: string) => {
  try {
    await deleteDoc(doc(db, colName, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${colName}/${id}`);
  }
};
