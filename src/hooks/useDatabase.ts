import { useState, useEffect } from 'react';
import { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../db/database';

export function useDatabase(): SQLiteDatabase | null {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);

  useEffect(() => {
    getDatabase().then(setDb).catch(() => {});
  }, []);

  return db;
}
