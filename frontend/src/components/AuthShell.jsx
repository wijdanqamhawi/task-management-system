/*
 * Shared shell for the authentication screens (Login, Forgot password).
 *
 * Renders the split-screen container: the photographic left panel with TaskFlow
 * branding, and the white right panel whose contents each page supplies as children.
 * Extracted so both screens share one definition of the visual identity — the markup
 * and classes are exactly those the Login page already used, so its appearance is
 * unchanged.
 *
 * No UI framework, no icon library, no new dependency (Constitution II).
 */
import '../styles/login.css';

/*
 * Background photograph for the left panel, resolved at build time.
 *
 * import.meta.glob is a Vite built-in (no dependency). If the asset is removed the
 * build still succeeds and the panel falls back to its navy finish via
 * .login__visual--no-image.
 */
const workspaceModules = import.meta.glob(
  '../assets/taskflow-workspace.{jpg,jpeg,png,webp}',
  { eager: true, query: '?url', import: 'default' },
);
const workspaceImage = Object.values(workspaceModules)[0] ?? null;

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const Brand = () => (
  <>
    <span className="login__logo"><CheckIcon /></span>
    <span className="login__brand-name">TaskFlow</span>
  </>
);

export default function AuthShell({ children }) {
  return (
    <main className="login">
      <div className="login__shell">

        {/* ---------- left: photographic panel ---------- */}
        <aside
          className={`login__visual${workspaceImage ? '' : ' login__visual--no-image'}`}
          style={workspaceImage ? { backgroundImage: `url(${workspaceImage})` } : undefined}
        >
          <div className="login__visual-inner">
            <div className="login__brand"><Brand /></div>

            <div>
              <h1 className="login__headline">Turn Ideas into<br />Progress</h1>
              <p className="login__headline-sub">
                Organize your projects, manage tasks,<br />and achieve more together.
              </p>
            </div>

            <p className="login__quote">&ldquo;Small steps make big progress.&rdquo;</p>
          </div>
        </aside>

        {/* ---------- right: content panel ---------- */}
        <section className="login__panel">
          <div className="login__form-wrap">
            {/* Shown only below 1024px, where the visual panel is hidden. */}
            <div className="login__panel-brand"><Brand /></div>
            {children}
          </div>
        </section>

      </div>
    </main>
  );
}
