import type { TabState } from '../shared/types';

interface TabStateSource {
  getState(): Promise<TabState>;
  onStateChanged(callback: (state: TabState) => void): () => void;
}

// Listen before requesting the initial snapshot: the first tab can be created
// while that request is in flight. A later event must win over the old response.
export function subscribeToTabState(
  source: TabStateSource,
  onState: (state: TabState) => void,
  onError: (error: unknown) => void
): () => void {
  let disposed = false;
  let receivedUpdate = false;
  const unsubscribe = source.onStateChanged((state) => {
    if (disposed) return;
    receivedUpdate = true;
    onState(state);
  });

  source.getState().then((state) => {
    if (!disposed && !receivedUpdate) onState(state);
  }).catch((error) => {
    if (!disposed && !receivedUpdate) onError(error);
  });

  return () => {
    disposed = true;
    unsubscribe();
  };
}
