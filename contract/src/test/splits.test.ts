import { describe, it, expect } from "vitest";
import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
  persistentHash,
  CompactTypeBytes,
  CompactTypeVector,
  convertFieldToBytes,
  MAX_FIELD,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  ledger,
  type Ledger,
} from "../managed/splits/contract/index.js";

// Setup Mock Witnesses
export type SplitsPrivateState = {
  readonly secretKey: Uint8Array;
};

export const splitsWitnesses = {
  localSecretKey: ({
    privateState,
  }: {
    privateState: SplitsPrivateState;
  }): [SplitsPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
};

const PRIME = MAX_FIELD + 1n;

function toField(val: bigint): bigint {
  const mod = val % PRIME;
  return mod < 0n ? mod + PRIME : mod;
}

const bytes32Descriptor = new CompactTypeBytes(32);
const vector2Bytes32Descriptor = new CompactTypeVector(2, bytes32Descriptor);

// ZK Commitment Helper matching compact circuit
function computeCommitment(balance: bigint, salt: Uint8Array): Uint8Array {
  const fieldVal = toField(balance);
  const balanceBytes = convertFieldToBytes(32, fieldVal, "test-commitment");
  return persistentHash(vector2Bytes32Descriptor, [balanceBytes, salt]);
}

export class SplitsSimulator {
  readonly contract: Contract<SplitsPrivateState>;
  circuitContext: CircuitContext<SplitsPrivateState>;

  constructor(secretKey: Uint8Array, initialMembers: Uint8Array[]) {
    this.contract = new Contract<SplitsPrivateState>(splitsWitnesses);

    const membersVector = [
      initialMembers[0] || new Uint8Array(32),
      initialMembers[1] || new Uint8Array(32),
      initialMembers[2] || new Uint8Array(32),
      initialMembers[3] || new Uint8Array(32),
    ];

    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ secretKey }, "0".repeat(64)),
      membersVector,
    );

    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  public switchUser(secretKey: Uint8Array) {
    this.circuitContext.currentPrivateState = { secretKey };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): SplitsPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public publicKey(): Uint8Array {
    return this.contract.circuits.publicKey(
      this.circuitContext,
      this.getPrivateState().secretKey,
    ).result;
  }

  public postExpense(
    payerIdx: bigint,
    amount: bigint,
    shares: bigint[],
  ): Ledger {
    this.circuitContext = this.contract.impureCircuits.post_expense(
      this.circuitContext,
      payerIdx,
      amount,
      shares.map(toField),
    ).context;
    return this.getLedger();
  }

  public syncBalance(
    idx: bigint,
    oldBalance: bigint,
    oldSalt: Uint8Array,
    newSalt: Uint8Array,
  ): Ledger {
    this.circuitContext = this.contract.impureCircuits.sync_balance(
      this.circuitContext,
      idx,
      toField(oldBalance),
      oldSalt,
      newSalt,
    ).context;
    return this.getLedger();
  }

  public postPayment(
    debtorIdx: bigint,
    creditorIdx: bigint,
    amount: bigint,
    oldBalance: bigint,
    oldSalt: Uint8Array,
    newSalt: Uint8Array,
  ): Ledger {
    this.circuitContext = this.contract.impureCircuits.post_payment(
      this.circuitContext,
      debtorIdx,
      creditorIdx,
      toField(amount),
      toField(oldBalance),
      oldSalt,
      newSalt,
    ).context;
    return this.getLedger();
  }

  public claimPayment(
    oldBalance: bigint,
    oldSalt: Uint8Array,
    newSalt: Uint8Array,
  ): Ledger {
    this.circuitContext = this.contract.impureCircuits.claim_payment(
      this.circuitContext,
      toField(oldBalance),
      oldSalt,
      newSalt,
    ).context;
    return this.getLedger();
  }

  public joinGroup(idx: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.join_group(
      this.circuitContext,
      toField(idx),
    ).context;
    return this.getLedger();
  }
}

describe("Splits Smart Contract Simulator", () => {
  const user0Key = new Uint8Array(32).map((_, i) => i);
  const user1Key = new Uint8Array(32).map((_, i) => i + 10);
  const user2Key = new Uint8Array(32).map((_, i) => i + 20);
  const user3Key = new Uint8Array(32).map((_, i) => i + 30);

  const initSimulator = () => {
    // Generate public keys
    const sim0 = new SplitsSimulator(user0Key, []);
    const pub0 = sim0.publicKey();

    const sim1 = new SplitsSimulator(user1Key, []);
    const pub1 = sim1.publicKey();

    const sim2 = new SplitsSimulator(user2Key, []);
    const pub2 = sim2.publicKey();

    const sim3 = new SplitsSimulator(user3Key, []);
    const pub3 = sim3.publicKey();

    // Instantiate main simulator with the 4 participants
    const mainSim = new SplitsSimulator(user0Key, [pub0, pub1, pub2, pub3]);
    return { mainSim, pub0, pub1, pub2, pub3 };
  };

  it("correctly initializes the group members and zero commitments", () => {
    const { mainSim, pub0 } = initSimulator();
    const l = mainSim.getLedger();

    expect(l.members[0]).toEqual(pub0);
    expect(l.pending_expense_amount).toEqual(0n);
    expect(l.pending_payment_status).toEqual(0n);
    expect(l.synced_mask[0]).toBe(true);
  });

  it("supports dynamic joining and membership assertions", () => {
    const sim0 = new SplitsSimulator(user0Key, []);
    const pub0 = sim0.publicKey();

    const sim1 = new SplitsSimulator(user1Key, []);
    const pub1 = sim1.publicKey();

    const sim2 = new SplitsSimulator(user2Key, []);
    const pub2 = sim2.publicKey();

    const sim3 = new SplitsSimulator(user3Key, []);
    const pub3 = sim3.publicKey();

    const mainSim = new SplitsSimulator(user0Key, [pub0, new Uint8Array(32), new Uint8Array(32), new Uint8Array(32)]);
    const lInit = mainSim.getLedger();
    expect(lInit.members[0]).toEqual(pub0);
    expect(lInit.members[1]).toEqual(new Uint8Array(32));
    expect(lInit.members[2]).toEqual(new Uint8Array(32));
    expect(lInit.members[3]).toEqual(new Uint8Array(32));

    // User 1 joins slot 1
    mainSim.switchUser(user1Key);
    mainSim.joinGroup(1n);
    const l1 = mainSim.getLedger();
    expect(l1.members[1]).toEqual(pub1);

    // Try to join index 0 (overwrite creator) -> should throw
    expect(() => mainSim.joinGroup(0n)).toThrow("failed assert: Cannot overwrite creator");

    // Try to join invalid slot index -> should throw
    expect(() => mainSim.joinGroup(4n)).toThrow("failed assert: Invalid slot index");

    // Try to join when already a member -> should throw
    expect(() => mainSim.joinGroup(2n)).toThrow("failed assert: Already a member");

    // User 2 joins slot 2
    mainSim.switchUser(user2Key);
    mainSim.joinGroup(2n);
    const l2 = mainSim.getLedger();
    expect(l2.members[2]).toEqual(pub2);

    // User 3 joins slot 3
    mainSim.switchUser(user3Key);
    mainSim.joinGroup(3n);
    const l3 = mainSim.getLedger();
    expect(l3.members[3]).toEqual(pub3);

    // Try to join occupied slot 1 -> should throw
    const user4Key = new Uint8Array(32).map((_, i) => i + 40);
    mainSim.switchUser(user4Key);
    expect(() => mainSim.joinGroup(1n)).toThrow("failed assert: Slot 1 already occupied");
  });

  it("allows posting an expense with a valid zero-sum split mapping", () => {
    const { mainSim } = initSimulator();

    // User 0 posts expense of 1200 split equally among the 4 users (300n each)
    mainSim.postExpense(0n, 1200n, [300n, 300n, 300n, 300n]);

    const l = mainSim.getLedger();
    expect(l.pending_expense_amount).toEqual(1200n);
    expect(l.pending_expense_payer_idx).toEqual(0n);
    expect(l.synced_mask[0]).toBe(false);
    expect(l.synced_mask[1]).toBe(false);
  });

  it("rejects post_expense if split sum does not match total amount", () => {
    const { mainSim } = initSimulator();
    expect(() =>
      mainSim.postExpense(0n, 1200n, [300n, 300n, 300n, 299n]),
    ).toThrow("failed assert: Split shares must sum to total amount");
  });

  it("rejects post_expense if payer does not match local secret key witness", () => {
    const { mainSim } = initSimulator();
    // Claiming payer index 1 when secret key is user0Key
    expect(() =>
      mainSim.postExpense(1n, 1200n, [300n, 300n, 300n, 300n]),
    ).toThrow("failed assert: Caller is not the payer");
  });

  it("supports private balance syncing by participants", () => {
    const { mainSim } = initSimulator();

    // Post expense: User 0 pays 1200, shares = [300, 300, 300, 300]
    // Net changes: User 0 gets +900, Users 1-3 get -300
    mainSim.postExpense(0n, 1200n, [300n, 300n, 300n, 300n]);

    const initialSalt = new Uint8Array(32); // Pad(32, "")
    const newSalt0 = new Uint8Array(32).map((_, i) => i + 1);

    // User 0 syncs: old balance = 0, new balance = +900
    mainSim.syncBalance(0n, 0n, initialSalt, newSalt0);

    const l = mainSim.getLedger();
    expect(l.synced_mask[0]).toBe(true);
    expect(l.balance_commitments[0]).toEqual(computeCommitment(900n, newSalt0));

    // User 1 syncs: switch user key to user1Key, old balance = 0, new balance = -300
    mainSim.switchUser(user1Key);
    const newSalt1 = new Uint8Array(32).map((_, i) => i + 2);
    mainSim.syncBalance(1n, 0n, initialSalt, newSalt1);

    const l1 = mainSim.getLedger();
    expect(l1.synced_mask[1]).toBe(true);
    expect(l1.balance_commitments[1]).toEqual(
      computeCommitment(-300n, newSalt1),
    );
  });

  it("rejects sync_balance if the old balance commitment is tampered", () => {
    const { mainSim } = initSimulator();
    mainSim.postExpense(0n, 1200n, [300n, 300n, 300n, 300n]);

    const initialSalt = new Uint8Array(32);
    const newSalt = new Uint8Array(32);

    // Attempting to sync claiming old balance was 100 instead of 0
    expect(() => mainSim.syncBalance(0n, 100n, initialSalt, newSalt)).toThrow(
      "failed assert: Invalid old balance commitment",
    );
  });

  it("supports asynchronous settlement payment posting and claiming", () => {
    const { mainSim } = initSimulator();

    // Setup balance commitments first by posting and syncing
    mainSim.postExpense(0n, 1200n, [300n, 300n, 300n, 300n]);

    const initialSalt = new Uint8Array(32);
    const salt0 = new Uint8Array(32).map(() => 1);
    mainSim.syncBalance(0n, 0n, initialSalt, salt0); // Balance = +900

    mainSim.switchUser(user1Key);
    const salt1 = new Uint8Array(32).map(() => 2);
    mainSim.syncBalance(1n, 0n, initialSalt, salt1); // Balance = -300

    // Debtor (User 1, balance -300) pays creditor (User 0, balance +900) 100n.
    // New debtor balance should be -300 + 100 = -200
    const nextSalt1 = new Uint8Array(32).map(() => 3);
    mainSim.postPayment(1n, 0n, 100n, -300n, salt1, nextSalt1);

    const l = mainSim.getLedger();
    expect(l.pending_payment_status).toEqual(1n);
    expect(l.pending_payment_from).toEqual(1n);
    expect(l.pending_payment_to).toEqual(0n);
    expect(l.pending_payment_amount).toEqual(100n);
    expect(l.balance_commitments[1]).toEqual(
      computeCommitment(-200n, nextSalt1),
    );

    // Creditor (User 0, balance +900) claims the payment.
    // New creditor balance should be +900 - 100 = +800
    mainSim.switchUser(user0Key);
    const nextSalt0 = new Uint8Array(32).map(() => 4);
    mainSim.claimPayment(900n, salt0, nextSalt0);

    const lFinal = mainSim.getLedger();
    expect(lFinal.pending_payment_status).toEqual(0n);
    expect(lFinal.balance_commitments[0]).toEqual(
      computeCommitment(800n, nextSalt0),
    );
  });
});
