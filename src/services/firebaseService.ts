import { db, auth } from '../firebase';
import { collection, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { ActivePoll } from '../types';

export const savePollToFirebase = async (poll: ActivePoll) => {
  if (!auth.currentUser) return;
  try {
    // Strip undefined values to prevent Firestore errors
    const cleanPoll = JSON.parse(JSON.stringify(poll));
    if (cleanPoll.isStopped === undefined) {
      cleanPoll.isStopped = false;
    }
    
    // We don't need to store computed counts in the database
    delete cleanPoll.totalVoterCount;
    if (cleanPoll.options) {
      cleanPoll.options.forEach((opt: any) => {
        delete opt.voter_count;
      });
    }

    await setDoc(doc(db, 'polls', poll.id), cleanPoll);
  } catch (err) {
    console.error('Failed to save poll to Firebase', err);
  }
};

export const saveRawUpdatesToFirebase = async (updates: any[]) => {
  if (!auth.currentUser || updates.length === 0) return;
  try {
    const rawUpdatesCollection = collection(db, 'rawUpdates');
    for (const update of updates) {
      const pollId = update.poll?.id || update.poll_answer?.poll_id || update.pollId || null;
      
      const docData = {
        ...update,
        pollId,
        processed: false
      };

      if (update.update_id) {
        await setDoc(doc(rawUpdatesCollection, update.update_id.toString()), docData);
      } else {
        await addDoc(rawUpdatesCollection, docData);
      }
    }
  } catch (err) {
    console.error('Failed to save raw updates to Firebase', err);
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
