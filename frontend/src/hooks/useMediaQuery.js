/* Tracks a CSS media query so a screen can swap layouts instead of squeezing one. */
import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const read = () => (typeof window !== 'undefined' && window.matchMedia(query).matches);
  const [matches, setMatches] = useState(read);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
