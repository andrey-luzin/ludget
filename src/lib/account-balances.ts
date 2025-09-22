import { collection, doc as firestoreDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Collections, SubCollections } from "@/types/collections";

export type BalanceAdjustment = {
  accountId: string;
  currencyId: string;
  delta: number;
};

async function upsertAccountBalance({
  ownerUid,
  accountId,
  currencyId,
  delta,
}: {
  ownerUid: string;
  accountId: string;
  currencyId: string;
  delta: number;
}) {
  if (!delta) return;
  const balancesCol = collection(db, Collections.Accounts, accountId, SubCollections.Balances);
  const existingSnap = await getDocs(
    query(
      balancesCol,
      where("ownerUid", "==", ownerUid),
      where("currencyId", "==", currencyId),
      limit(1)
    )
  );

  if (!existingSnap.empty) {
    const docSnap = existingSnap.docs[0];
    const currentAmount = Number(docSnap.data()?.amount ?? 0);
    const nextAmount = Number((currentAmount + delta).toFixed(2));
    await updateDoc(docSnap.ref, { amount: nextAmount });
    return;
  }

  const newDocRef = firestoreDoc(balancesCol, currencyId);
  const initialAmount = Number(delta.toFixed(2));
  await setDoc(newDocRef, {
    currencyId,
    amount: initialAmount,
    ownerUid,
    createdAt: serverTimestamp(),
  } as Record<string, unknown>);
}

export async function applyBalanceAdjustments(ownerUid: string | undefined | null, adjustments: BalanceAdjustment[]) {
  if (!ownerUid || !adjustments.length) return;
  const aggregated = new Map<string, number>();
  for (const { accountId, currencyId, delta } of adjustments) {
    if (!accountId || !currencyId || !delta) continue;
    const key = `${accountId}__${currencyId}`;
    const next = (aggregated.get(key) ?? 0) + delta;
    aggregated.set(key, Number(next.toFixed(2)));
  }

  const tasks: Promise<void>[] = [];
  for (const [key, delta] of aggregated.entries()) {
    if (!delta) continue;
    const [accountId, currencyId] = key.split("__");
    tasks.push(upsertAccountBalance({ ownerUid, accountId, currencyId, delta }));
  }

  await Promise.all(tasks);
}
