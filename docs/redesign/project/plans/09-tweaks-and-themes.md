# Tweaks Panel + Themes

Exposed via the Tweaks toggle. Persisted via `__edit_mode_set_keys` for design preview; in real build, persists to `prefs`.

## Tweakable
- **Theme**: quiet · github · glass · phosphor · phosphor-amber · trade (swatch picker).
- **Light/Dark**: toggle (themes that support it).
- **Accent color**: 4 curated swatches.
- **Density**: spacious · comfortable · dense.
- **Card layout**: grid · list.
- **Show token usage**: on/off.
- **Animations**: on/off (overrides reduced-motion off-state).
- **Sidebar**: left · right.
- **Live preview**: show / hide on cards.
- **Scanlines** (phosphor only): on/off.

## Defaults
```json
{
  "theme": "quiet",
  "light": false,
  "accent": "indigo",
  "density": "comfortable",
  "cardLayout": "grid",
  "showTokens": true,
  "animations": true,
  "sidebar": "left",
  "showPreview": true,
  "scanlines": false
}
```

## LocalStorage compatibility
Keys preserved per spec §11.6: `amux_theme_name`, `amux_theme_light`, `amux_theme_scanlines`, `amux_theme_dense`.
The new tweaks panel reads/writes these as the source of truth.
