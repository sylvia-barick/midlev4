# Minimum-Cash-Flow Settlement Algorithm

This document explains the mathematical and computational design of the debt simplification engine in **Confidential Splits**.

---

## 1. Core Mechanics

### Net Balance Calculation
For each participant $i$, their net balance $B_i$ is computed as the sum of all expenses they paid minus their shared splits:
$$B_i = \sum \text{Paid}_i - \sum \text{Share}_i$$

* A positive balance ($B_i > 0$) indicates they are a **creditor** (owed money).
* A negative balance ($B_i < 0$) indicates they are a **debtor** (owe money).
* A zero balance ($B_i = 0$) means they are fully settled.

### Creditor / Debtor Classification
The algorithm separates participants into two disjoint sorted sets:
1. **Debtors ($D$)**: Sorted descending by absolute amount owed ($|B_i|$).
2. **Creditors ($C$)**: Sorted descending by amount credited ($B_i$).

---

## 2. Greedy Simplification Algorithm
The engine processes the lists iteratively to generate the minimal number of settlement transactions:

1. Retrieve the largest debtor $d \in D$ (owes $X$) and the largest creditor $c \in C$ (is owed $Y$).
2. Compute the transaction amount: $P = \min(X, Y)$.
3. Record a settlement transaction: $d \xrightarrow{P} c$.
4. Update their balances:
   * $X \leftarrow X - P$
   * $Y \leftarrow Y - P$
5. Remove any participant whose balance has reached 0 from their respective set.
6. Repeat until both sets are empty.

---

## 3. Correctness & Mathematical Properties
* **Conservation**: Sum of all net balances must equal 0 ($\sum B_i = 0$). No value is created or destroyed.
* **Debtor Payments**: Every debtor pays exactly their total debt amount.
* **Creditor Receipts**: Every creditor receives exactly their total credit amount.
* **Minimization**: The transaction count is guaranteed to be at most $N-1$, where $N$ is the number of participants.

---

## 4. Complexity & Limitations
* **Time Complexity**: $O(N \log N)$ due to initial sorting of debtors and creditors.
* **Limitations**: The greedy algorithm minimizes the total number of transactions but may not find the global absolute minimum volume of cash transferred if split cycles exist. However, it is deterministic and highly efficient for group settlement apps.
