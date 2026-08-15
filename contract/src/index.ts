// This file is part of midnightntwrk/example-bboard.
// Copyright (C) Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/bboard/contract/index.js";
export * from "./witnesses.js";
export * from "./settlement.js";

import * as CompiledBBoardContract from "./managed/bboard/contract/index.js";
import * as CompiledSplitsContract from "./managed/splits/contract/index.js";
import * as Witnesses from "./witnesses.js";

export const CompiledBBoardContractContract = CompiledContract.make<
  CompiledBBoardContract.Contract<Witnesses.BBoardPrivateState>
>("BBoard", CompiledBBoardContract.Contract<Witnesses.BBoardPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/bboard"),
);

export type SplitsPrivateState = {
  readonly secretKey: Uint8Array;
  readonly balances: { [idx: number]: bigint };
  readonly salts: { [idx: number]: Uint8Array };
  readonly activeIdx: number;
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

export const CompiledSplitsContractContract = CompiledContract.make<
  CompiledSplitsContract.Contract<SplitsPrivateState>
>("Splits", CompiledSplitsContract.Contract<SplitsPrivateState>).pipe(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CompiledContract.withWitnesses(splitsWitnesses as any),
  CompiledContract.withCompiledFileAssets("./managed/splits"),
);
