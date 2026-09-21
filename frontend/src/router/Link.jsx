/*
 * T039 — Link. Calls pushState instead of reloading the page.
 *
 * preventDefault on a plain left-click is what makes this a single-page navigation;
 * forgetting it is the most common hand-written-router bug (R-013), so modified clicks
 * and non-left buttons are deliberately left to the browser.
 */
import { useRouter } from './Router.jsx';

export function Link({ to, className, children, ...rest }) {
  const { pathname, navigate } = useRouter();
  const active = pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));

  const onClick = (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;                                   // not a left click
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; // new tab
    event.preventDefault();
    navigate(to);
  };

  const cls = [className, active ? 'nav__link--active' : ''].filter(Boolean).join(' ');
  return <a href={to} className={cls} onClick={onClick} {...rest}>{children}</a>;
}
