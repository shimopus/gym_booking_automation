import { useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { savePollToFirebase } from '../services/firebaseService';

export function useMigration(user: any, isAuthReady: boolean) {
  useEffect(() => {
    const migrateData = async () => {
      if (!user || !isAuthReady) return;
      if (localStorage.getItem('hasMigratedToFirebase') === 'true') return;

      console.log('Migrating local data to Firebase...');
      let migratedSomething = false;

      // Migrate Polls
      const localPolls = localStorage.getItem('activePolls');
      if (localPolls) {
        try {
          const parsedPolls = JSON.parse(localPolls);
          if (Array.isArray(parsedPolls) && parsedPolls.length > 0) {
            for (const poll of parsedPolls) {
              await savePollToFirebase(poll);
            }
            migratedSomething = true;
          }
        } catch (err) {
          console.error('Failed to parse local polls for migration', err);
        }
      }

      // Migrate Telegram Settings
      const localToken = localStorage.getItem('tgBotToken');
      const localChatId = localStorage.getItem('tgChatId');
      const localLastUpdateId = localStorage.getItem('lastUpdateId');
      
      if (localToken || localChatId || localLastUpdateId) {
        try {
          const settingsObj: any = {};
          if (localToken) settingsObj.tgBotToken = localToken;
          if (localChatId) settingsObj.tgChatId = localChatId;
          if (localLastUpdateId) settingsObj.lastUpdateId = Number(localLastUpdateId);
          
          await setDoc(doc(db, 'settings', 'telegram'), settingsObj, { merge: true });
          migratedSomething = true;
        } catch (err) {
          console.error('Failed to migrate settings', err);
        }
      }

      localStorage.setItem('hasMigratedToFirebase', 'true');
      if (migratedSomething) {
        console.log('Migration complete!');
      }
    };

    migrateData();
  }, [user, isAuthReady]);
}
