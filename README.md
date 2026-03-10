# Legal Adviser - Frontend Application

This is the frontend application for the **Legal Adviser** platform, built to empower legal professionals and their clients with state-of-the-art AI tooling and a dynamic administration interface.

## 🚀 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **Authentication**: Firebase Authentication
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **AI Integrations**:
  - [Vercel AI SDK](https://sdk.vercel.ai/docs) & Google Generative AI (Gemini)
  - [AssemblyAI](https://www.assemblyai.com/) (Speech-to-Text)
  - React Speech Recognition
- **Email Delivery**: Nodemailer & React Email

---

## ✨ Key Features

- **Role-Based dashboards**: Interactive dashboards heavily tailored towards different roles (e.g., `Admin` and `Legal`), featuring intelligent linear gradients and responsive layouts backed by a Shadcn customizable sidebar.
- **Voice Intelligence**: Leverage real-time speech processing and voice integrations for hands-free operations natively using Assembly AI.
- **AI-Powered Assistance**: Integrated Generative AI directly serving analytical insights to legal staff.
- **Secure Authentication**: Protected endpoints and sessions implemented seamlessly via Firebase Client & Firebase Admin SDK.
- **Dark & Light Mode Support**: Beautiful aesthetic mapping across both default color themes.

---

## 🛠️ Getting Started

### Prerequisites

You need Node.js and a package manager installed. The application is tested with `npm`.

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up your environment variables. Create a `.env.local` file at the root of the frontend folder mirroring `.env.example` (if present) ensuring you include your:
   - Firebase Client Configuration
   - Firebase Admin Credentials
   - Google AI / Gemini API Keys
   - AssemblyAI API Key

### Running Locally

Fire up the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The application will hot-reload as you make modifications to the codebase.

---

## 🎨 Modifying Design Elements

This project heavily relies on **Shadcn UI** for modular components situated under `components/ui` and dynamic coloring configured natively through CSS variables in `app/globals.css`.

When making visual modifications, lean towards the utility classes offered natively by Tailwind v4. Complex UI updates should leverage existing Framer Motion integrations to guarantee smooth micro-interactions across user sessions.

---

## 📦 Building for Production

Compile an optimized production version by running:

```bash
npm run build
```

You can preview the compiled production environment locally with:

```bash
npm run start
```

---

## ⚠️ Notes for Developers

- **State Management**: This app utilizes strict, segregated global stores via Zustand (`useAuthStore`, `usePopStore`, etc.). Please stick to these standard patterns instead of dropping state deep into isolated components to avoid prop drilling.
- **Linting**: Run `npm run lint` occasionally to catch unused imports, especially around React Hooks dependency injections and TypeScript type warnings.
