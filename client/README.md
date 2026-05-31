# AL RAWA — Client

React 19 + TypeScript 6 + Vite + Tailwind CSS v4 frontend for the school management system.

## Key Libraries

- **Zustand** — State management
- **React Router DOM** — Client-side routing
- **jsPDF** + **jspdf-autotable** — PDF generation
- **xlsx (SheetJS)** — Excel export
- **lucide-react** — Icons
- **framer-motion** — Animations (dashboard, transitions)
- **axios** — API calls

## Scripts

- `npm run dev` — Vite dev server (port 5173)
- `npm run build` — Production build
- `npm run preview` — Preview production build
- `npm run typecheck` — `tsc --noEmit`

## Project Structure

```
src/
├── components/       # Shared UI components
│   ├── CameraModal.tsx
│   ├── ClassManagerModal.tsx
│   ├── ClassSelect.tsx
│   ├── DeleteConfirmModal.tsx
│   ├── ErrorBoundary.tsx
│   ├── Layout.tsx
│   ├── PhotoUpload.tsx
│   ├── Skeleton.tsx
│   └── Toast.tsx
├── lib/              # Utilities
│   ├── config.ts     # Fiscal year, app config
│   ├── contacts.tsx  # Phone/WhatsApp link helpers
│   ├── financeReportPdf.ts
│   ├── grading.tsx   # Grade/GPA calculation
│   ├── logo.ts       # School logo base64
│   ├── reportPdf.ts  # Report card PDF
│   └── store.ts      # Zustand stores
├── pages/            # Route pages
│   ├── results/      # 5 sub-tabs
│   ├── students/
│   ├── teachers/
│   ├── staff/
│   ├── Dashboard.tsx
│   ├── FinanceSection.tsx
│   ├── FinanceReports.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   └── ...
├── App.tsx
├── main.tsx          # Entry + SW registration
└── index.css         # Tailwind + custom styles
```
