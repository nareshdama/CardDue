import Dexie, { Table } from 'dexie';
import { encryptData, decryptData } from './lib/crypto';

export interface EncryptedCard {
  id: string;
  payload: string;
}

export interface EncryptedActivity {
  id: string;
  payload: string;
}

export class CardDueDB extends Dexie {
  cards!: Table<EncryptedCard>;
  activities!: Table<EncryptedActivity>;

  constructor() {
    super('CardDueDB_EncryptedSecure');
    this.version(1).stores({
      cards: 'id',
      activities: 'id, date'
    });
    // v2 drops the plaintext `date` index on activities so timestamps don't leak.
    this.version(2).stores({
      cards: 'id',
      activities: 'id'
    }).upgrade(tx =>
      tx.table('activities').toCollection().modify(record => {
        delete record.date;
      })
    );
  }
}

export const db = new CardDueDB();

export const rekeyDatabase = async (oldKey: string, newKey: string) => {
  const cards = await db.cards.toArray();
  const activities = await db.activities.toArray();

  // Validate the old key against a sample record before touching anything.
  // If there's no data yet, any key is acceptable (nothing to lose).
  const sample = cards[0] ?? activities[0];
  if (sample) {
    decryptData(sample.payload, oldKey); // throws if the key is wrong
  }

  // Decrypt + re-encrypt every record up front. Any failure aborts the rekey
  // before a single write happens.
  const cardWrites = cards.map(c => ({
    id: c.id,
    payload: encryptData(decryptData(c.payload, oldKey), newKey),
  }));
  const activityWrites = activities.map(a => ({
    id: a.id,
    payload: encryptData(decryptData(a.payload, oldKey), newKey),
  }));

  await db.transaction('rw', db.cards, db.activities, async () => {
    for (const w of cardWrites) await db.cards.update(w.id, { payload: w.payload });
    for (const w of activityWrites) await db.activities.update(w.id, { payload: w.payload });
  });
};

