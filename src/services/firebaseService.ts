import { db, auth } from '../firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ActivePoll } from '../types';

export const savePollToFirebase = async (poll: ActivePoll) => {
  if (!auth.currentUser) return;
  try {
    await setDoc(doc(db, 'polls', poll.id), poll);
  } catch (err) {
    console.error('Failed to save poll to Firebase', err);
  }
};

export const deletePollFromFirebase = async (pollId: string) => {
  if (!auth.currentUser) return;
  try {
    await deleteDoc(doc(db, 'polls', pollId));
  } catch (err) {
    console.error('Failed to delete poll from Firebase', err);
  }
};

export const saveLastUpdateId = async (id: number) => {
  if (!auth.currentUser) return;
  try {
    await setDoc(doc(db, 'settings', 'telegram'), { lastUpdateId: id }, { merge: true });
  } catch (err) {
    console.error('Failed to save lastUpdateId', err);
  }
};
