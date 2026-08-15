export interface ParticipantBalance {
  participantId: string;
  balance: bigint;
}

export interface SettlementTransaction {
  debtorId: string;
  creditorId: string;
  amount: bigint;
}

export interface SettlementResult {
  transactions: SettlementTransaction[];
  totalVolume: bigint;
  transactionCount: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sumBalances: bigint;
  sumDebits: bigint;
  sumCredits: bigint;
}

export function validateBalances(
  balances: ParticipantBalance[],
): ValidationResult {
  let sumBalances = 0n;
  const seenIds = new Set<string>();

  for (const item of balances) {
    if (!item.participantId || item.participantId.trim() === "") {
      return {
        isValid: false,
        error: "Empty participant ID",
        sumBalances,
        sumDebits: 0n,
        sumCredits: 0n,
      };
    }
    if (seenIds.has(item.participantId)) {
      return {
        isValid: false,
        error: `Duplicate participant ID: ${item.participantId}`,
        sumBalances,
        sumDebits: 0n,
        sumCredits: 0n,
      };
    }
    seenIds.add(item.participantId);
    sumBalances += item.balance;
  }

  if (sumBalances !== 0n) {
    return {
      isValid: false,
      error: `Conservation failure: Net balances must sum to 0. Actual sum is ${sumBalances.toString()}`,
      sumBalances,
      sumDebits: 0n,
      sumCredits: 0n,
    };
  }

  const sumDebits = balances
    .filter((b) => b.balance < 0n)
    .reduce((sum, b) => sum - b.balance, 0n);
  const sumCredits = balances
    .filter((b) => b.balance > 0n)
    .reduce((sum, b) => sum + b.balance, 0n);

  return {
    isValid: true,
    sumBalances,
    sumDebits,
    sumCredits,
  };
}

export function calculateSettlement(
  balances: ParticipantBalance[],
): SettlementResult {
  const validation = validateBalances(balances);
  if (!validation.isValid) {
    throw new Error(validation.error || "Invalid balances input");
  }

  // Deep copy/map balances to structure lists
  const debtors = balances
    .filter((b) => b.balance < 0n)
    .map((b) => ({ id: b.participantId, owed: -b.balance }))
    .sort((a, b) => (b.owed > a.owed ? 1 : b.owed < a.owed ? -1 : 0));

  const creditors = balances
    .filter((b) => b.balance > 0n)
    .map((b) => ({ id: b.participantId, credit: b.balance }))
    .sort((a, b) => (b.credit > a.credit ? 1 : b.credit < a.credit ? -1 : 0));

  const transactions: SettlementTransaction[] = [];
  let totalVolume = 0n;

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    const amount =
      debtor.owed < creditor.credit ? debtor.owed : creditor.credit;

    if (amount > 0n) {
      transactions.push({
        debtorId: debtor.id,
        creditorId: creditor.id,
        amount,
      });
      totalVolume += amount;
      debtor.owed -= amount;
      creditor.credit -= amount;
    }

    if (debtor.owed === 0n) {
      debtorIndex++;
    }
    if (creditor.credit === 0n) {
      creditorIndex++;
    }
  }

  return {
    transactions,
    totalVolume,
    transactionCount: transactions.length,
  };
}
