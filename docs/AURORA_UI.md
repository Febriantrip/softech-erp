# Aurora UI System

The Aurora UI layer is the visual system used across the SOFTECH ERP frontend. It preserves the ERP transaction engine while applying a consistent back-office design language.

## Visual direction

- Light blue and violet ambient canvas treatments
- Floating rounded glass sidebar
- Floating glass topbar
- Compact back-office typography and spacing
- Violet-to-blue active states and primary actions
- Glass KPI cards and operational panels
- Light data tables, forms, filters, modals, and workbenches
- Consistent status badges, tabs, master cards, finance cards, and approval surfaces
- Purchase and warehouse command-center cards
- Document-detail surfaces and audit timelines
- Responsive tablet and mobile behavior

## Implementation notes

The UI system is implemented with the project's existing React components and modular CSS. It does not require an additional frontend dependency.

Relevant style files include:

- `src/styles.css`
- `src/theme-aurora-dark.css`
- `src/theme-aurora-noir-shell.css`
- `src/enterprise.css`
- `src/governance.css`
- version-scoped styles under `src/v*.css`

## Development

Run the frontend with:

~~~bash
npm run dev
~~~

Or use API mode:

~~~bash
npm run dev:api
~~~

The current repository reflects the evolved Aurora-based interface used by the V12 public portfolio snapshot.
