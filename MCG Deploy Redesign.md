# MCG Deploy — Console Redesign

A redesign of the Tenant Deployment console for **MCG Deploy** (Meridian Commerce Group). Direction chosen: **Soft Enterprise** — a light-first SaaS aesthetic with a full dark mode.

## Files

| File | What it is |
|------|------------|
| `MCG Deploy Redesign.dc.html` | The editable source (Design Component). Open or edit this. |
| `MCG Deploy Redesign.standalone.html` | Self-contained, offline single file. Works without the project — share or host anywhere. |

## What changed

- **Layout** — kept the two-pane structure, expanded to three readable columns: step rail · form · console.
- **Step navigation** — numbered steps with a live "Step 1 of 9" progress bar; active step sits on an elevated card; Deploy is set apart as the terminal action.
- **Form clarity** — fields grouped into titled cards (Tenant, Authentication) with labels above inputs, helper text, and a filled primary "Test Connection" button.
- **Console** — tabbed header (Output / Logs / Diff), a status pill, action chips (Clear / Copy / Download), and a friendly empty state.
- **Hierarchy & contrast** — calmer surfaces, consistent type scale (IBM Plex Sans + Plex Mono), emerald accent retained from the original.

## Theming

- **Light / Dark toggle** lives in the top-right of the header — swaps the whole UI live.
- Theme is driven by CSS variables; both palettes are defined in the component.

## Tweaks (props)

| Prop | Editor | Default | Effect |
|------|--------|---------|--------|
| `theme` | enum (`light` / `dark`) | `light` | Starting theme |
| `accent` | color | `#10b981` | Accent / primary color |

> Built as a reusable system — the chrome, step rail, form cards, and console patterns carry over to the other 8 wizard steps.
