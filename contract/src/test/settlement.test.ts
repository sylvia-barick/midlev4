import { describe, it, expect } from "vitest";
import {
  calculateSettlement,
  validateBalances,
  ParticipantBalance,
} from "../settlement";

describe("Minimum Cash Flow Settlement Algorithm", () => {
  // Helpers
  const verifyConservation = (balances: ParticipantBalance[]) => {
    const result = calculateSettlement(balances);
    const debtorPayments = new Map<string, bigint>();
    const creditorReceipts = new Map<string, bigint>();

    for (const tx of result.transactions) {
      debtorPayments.set(
        tx.debtorId,
        (debtorPayments.get(tx.debtorId) || 0n) + tx.amount,
      );
      creditorReceipts.set(
        tx.creditorId,
        (creditorReceipts.get(tx.creditorId) || 0n) + tx.amount,
      );
    }

    // Verify debtors pay exactly their debt
    for (const b of balances) {
      if (b.balance < 0n) {
        expect(debtorPayments.get(b.participantId)).toEqual(-b.balance);
      } else if (b.balance > 0n) {
        expect(creditorReceipts.get(b.participantId)).toEqual(b.balance);
      } else {
        expect(debtorPayments.get(b.participantId)).toBeUndefined();
        expect(creditorReceipts.get(b.participantId)).toBeUndefined();
      }
    }

    // Total debit = Total credit volume
    const sumDebits = result.transactions.reduce(
      (sum, tx) => sum + tx.amount,
      0n,
    );
    expect(result.totalVolume).toEqual(sumDebits);
  };

  it("handles 2 participants (one debtor, one creditor)", () => {
    const balances: ParticipantBalance[] = [
      { participantId: "Alice", balance: 500n },
      { participantId: "Bob", balance: -500n },
    ];
    verifyConservation(balances);

    const result = calculateSettlement(balances);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toEqual({
      debtorId: "Bob",
      creditorId: "Alice",
      amount: 500n,
    });
  });

  it("handles 3 participants", () => {
    const balances: ParticipantBalance[] = [
      { participantId: "Alice", balance: 500n },
      { participantId: "Bob", balance: -100n },
      { participantId: "Charlie", balance: -400n },
    ];
    verifyConservation(balances);

    const result = calculateSettlement(balances);
    expect(result.transactions).toHaveLength(2);
  });

  it("handles 4 participants", () => {
    const balances: ParticipantBalance[] = [
      { participantId: "Alice", balance: 600n },
      { participantId: "Bob", balance: -200n },
      { participantId: "Charlie", balance: -300n },
      { participantId: "David", balance: -100n },
    ];
    verifyConservation(balances);
  });

  it("handles one creditor / multiple debtors", () => {
    const balances: ParticipantBalance[] = [
      { participantId: "Alice", balance: 1000n },
      { participantId: "Bob", balance: -300n },
      { participantId: "Charlie", balance: -500n },
      { participantId: "David", balance: -200n },
    ];
    verifyConservation(balances);
  });

  it("handles multiple creditors / one debtor", () => {
    const balances: ParticipantBalance[] = [
      { participantId: "Alice", balance: 400n },
      { participantId: "Bob", balance: 600n },
      { participantId: "Charlie", balance: -1000n },
    ];
    verifyConservation(balances);
  });

  it("handles multiple creditors / multiple debtors", () => {
    const balances: ParticipantBalance[] = [
      { participantId: "Alice", balance: 400n },
      { participantId: "Bob", balance: 600n },
      { participantId: "Charlie", balance: -700n },
      { participantId: "David", balance: -300n },
    ];
    verifyConservation(balances);
  });

  it("handles zero balances / already settled group", () => {
    const balances: ParticipantBalance[] = [
      { participantId: "Alice", balance: 0n },
      { participantId: "Bob", balance: 0n },
    ];
    const result = calculateSettlement(balances);
    expect(result.transactions).toHaveLength(0);
    expect(result.totalVolume).toEqual(0n);
  });

  it("rejects invalid non-zero total balance", () => {
    const balances: ParticipantBalance[] = [
      { participantId: "Alice", balance: 500n },
      { participantId: "Bob", balance: -499n },
    ];
    expect(() => calculateSettlement(balances)).toThrow("Conservation failure");
    const val = validateBalances(balances);
    expect(val.isValid).toBe(false);
  });

  it("rejects duplicate participant IDs", () => {
    const balances: ParticipantBalance[] = [
      { participantId: "Alice", balance: 500n },
      { participantId: "Alice", balance: -500n },
    ];
    expect(() => calculateSettlement(balances)).toThrow(
      "Duplicate participant ID",
    );
  });

  it("rejects empty/invalid participant ID", () => {
    const balances: ParticipantBalance[] = [
      { participantId: " ", balance: 0n },
      { participantId: "Bob", balance: 0n },
    ];
    expect(() => calculateSettlement(balances)).toThrow("Empty participant ID");
  });
});
