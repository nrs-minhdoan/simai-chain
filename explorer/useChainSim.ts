import { useCallback, useMemo, useRef, useState } from 'react';
import { ChainSim, type SimState, type UserLabel } from './sim';
import type { ByzantineMode } from '@chain-sim/core';

export interface Actions {
  addTransfer: (from: UserLabel, to: UserLabel, amount: string) => void;
  deployToken: () => void;
  mintToken: (to: UserLabel, amount: string) => void;
  transferToken: (from: UserLabel, to: UserLabel, amount: string) => void;
  setByzantine: (name: string, mode: ByzantineMode) => void;
  clearMempool: () => void;
  mine: () => void;
  reset: () => void;
}

export function useChainSim(): { state: SimState; actions: Actions } {
  const simRef = useRef<ChainSim | null>(null);
  if (simRef.current === null) simRef.current = new ChainSim();
  const sim = simRef.current;
  const [state, setState] = useState<SimState>(() => sim.snapshot());
  const refresh = useCallback(() => setState(sim.snapshot()), [sim]);

  const actions = useMemo<Actions>(() => ({
    addTransfer: (f, t, a) => { sim.addTransfer(f, t, a); refresh(); },
    deployToken: () => { sim.deployToken(); refresh(); },
    mintToken: (t, a) => { sim.mintToken(t, a); refresh(); },
    transferToken: (f, t, a) => { sim.transferToken(f, t, a); refresh(); },
    setByzantine: (n, m) => { sim.setByzantine(n, m); refresh(); },
    clearMempool: () => { sim.clearMempool(); refresh(); },
    mine: () => { sim.mineBlock(); refresh(); },
    reset: () => { sim.reset(); refresh(); },
  }), [sim, refresh]);

  return { state, actions };
}
