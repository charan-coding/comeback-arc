import { useEffect, useRef, useState } from 'react';

/** True for a brief moment right after `value` flips from false to true; false otherwise (including on first render). */
export function useBecameTrue(value: boolean, durationMs = 700): boolean {
  const previous = useRef(value);
  const [justBecameTrue, setJustBecameTrue] = useState(false);

  useEffect(() => {
    if (value && !previous.current) {
      setJustBecameTrue(true);
      const timeout = setTimeout(() => setJustBecameTrue(false), durationMs);
      previous.current = value;
      return () => clearTimeout(timeout);
    }
    previous.current = value;
  }, [value, durationMs]);

  return justBecameTrue;
}
