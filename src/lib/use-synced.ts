import * as React from "react";

// ============================================================
// Deriving state from props WITHOUT an effect.
//
// `useEffect(() => setX(prop), [prop])` renders once with the stale value, then
// again with the new one — an extra render, a visible flash, and the pattern
// react-hooks/set-state-in-effect flags. React's documented alternative is to
// adjust state *during* render when a tracked value changed; React discards the
// in-progress output and immediately re-renders with the new state, before the
// browser paints.
// See: https://react.dev/reference/react/useState#storing-information-from-previous-renders
// ============================================================

/** Mirror a prop into local state, re-syncing whenever the prop changes. */
export function useSynced<T>(value: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [v, setV] = React.useState(value);
  const [prev, setPrev] = React.useState(value);
  if (!Object.is(prev, value)) {
    setPrev(value);
    setV(value);
  }
  return [v, setV];
}

/**
 * Re-initialise state from `factory` each time `trigger` changes. Built for
 * dialogs: pass the open flag (plus the entity id if it can change while open)
 * so the form refills on open instead of in an effect.
 */
export function useResetOn<T>(
  trigger: unknown,
  factory: () => T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = React.useState<T>(factory);
  const [prev, setPrev] = React.useState(trigger);
  if (!Object.is(prev, trigger)) {
    setPrev(trigger);
    setValue(factory());
  }
  return [value, setValue];
}
