# Frontend image assets

## `taskflow-workspace.jpg` — REQUIRED, not present

The login page's left panel is designed to sit over a workspace photograph — laptop,
coffee cup, plant, desk — with a dark navy overlay above it, per the approved reference
design.

**No such image ships with this repository.** Adding one would mean committing a binary
of unclear licence or fetching it from an external service at runtime, and no external
runtime dependency is permitted (Constitution II).

While the file is absent the panel renders as a solid navy surface. That is a fallback,
**not** the intended design.

## To add it

1. Save a suitable photograph here, named exactly:

   ```
   frontend/src/assets/taskflow-workspace.jpg
   ```

   Suggested: landscape or portrait, at least 1200×1400, under ~500 KB, showing a desk
   with a laptop and coffee cup. `.jpeg`, `.png` and `.webp` also work.
   Use an image you have the right to use — a permissively licensed stock photo is fine.

2. Rebuild:

   ```bash
   npm run build
   ```

That is the whole procedure. **No code or CSS change is needed.** `Login.jsx` picks the
file up automatically through `import.meta.glob` (a Vite built-in, not a dependency),
applies it as the panel background with `background-size: cover` and
`background-position: center`, and drops the `--no-image` fallback class so the navy
overlay lightens to let the photograph show through.
