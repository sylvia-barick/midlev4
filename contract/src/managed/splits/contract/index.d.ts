import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  post_expense(context: __compactRuntime.CircuitContext<PS>,
               payer_idx_0: bigint,
               amount_0: bigint,
               shares_0: bigint[]): __compactRuntime.CircuitResults<PS, []>;
  sync_balance(context: __compactRuntime.CircuitContext<PS>,
               idx_0: bigint,
               old_balance_0: bigint,
               old_salt_0: Uint8Array,
               new_salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  post_payment(context: __compactRuntime.CircuitContext<PS>,
               debtor_idx_0: bigint,
               creditor_idx_0: bigint,
               amount_0: bigint,
               old_balance_0: bigint,
               old_salt_0: Uint8Array,
               new_salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claim_payment(context: __compactRuntime.CircuitContext<PS>,
                old_balance_0: bigint,
                old_salt_0: Uint8Array,
                new_salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  join_group(context: __compactRuntime.CircuitContext<PS>, idx_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  post_expense(context: __compactRuntime.CircuitContext<PS>,
               payer_idx_0: bigint,
               amount_0: bigint,
               shares_0: bigint[]): __compactRuntime.CircuitResults<PS, []>;
  sync_balance(context: __compactRuntime.CircuitContext<PS>,
               idx_0: bigint,
               old_balance_0: bigint,
               old_salt_0: Uint8Array,
               new_salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  post_payment(context: __compactRuntime.CircuitContext<PS>,
               debtor_idx_0: bigint,
               creditor_idx_0: bigint,
               amount_0: bigint,
               old_balance_0: bigint,
               old_salt_0: Uint8Array,
               new_salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claim_payment(context: __compactRuntime.CircuitContext<PS>,
                old_balance_0: bigint,
                old_salt_0: Uint8Array,
                new_salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  join_group(context: __compactRuntime.CircuitContext<PS>, idx_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  publicKey(sk_0: Uint8Array): Uint8Array;
  commit(balance_0: bigint, salt_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  publicKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  commit(context: __compactRuntime.CircuitContext<PS>,
         balance_0: bigint,
         salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  post_expense(context: __compactRuntime.CircuitContext<PS>,
               payer_idx_0: bigint,
               amount_0: bigint,
               shares_0: bigint[]): __compactRuntime.CircuitResults<PS, []>;
  sync_balance(context: __compactRuntime.CircuitContext<PS>,
               idx_0: bigint,
               old_balance_0: bigint,
               old_salt_0: Uint8Array,
               new_salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  post_payment(context: __compactRuntime.CircuitContext<PS>,
               debtor_idx_0: bigint,
               creditor_idx_0: bigint,
               amount_0: bigint,
               old_balance_0: bigint,
               old_salt_0: Uint8Array,
               new_salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claim_payment(context: __compactRuntime.CircuitContext<PS>,
                old_balance_0: bigint,
                old_salt_0: Uint8Array,
                new_salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  join_group(context: __compactRuntime.CircuitContext<PS>, idx_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly members: Uint8Array[];
  readonly balance_commitments: Uint8Array[];
  readonly pending_expense_amount: bigint;
  readonly pending_expense_payer_idx: bigint;
  readonly pending_expense_shares: bigint[];
  readonly synced_mask: boolean[];
  readonly pending_payment_from: bigint;
  readonly pending_payment_to: bigint;
  readonly pending_payment_amount: bigint;
  readonly pending_payment_status: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               initial_members_0: Uint8Array[]): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
