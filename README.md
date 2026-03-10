# ðŸ“š Smart Library Management System (SaaS Edition)

This is a production-level, fully featured modern Smart Library system combining a FastAPI backend, Firestore (Firebase) database, Firebase Authentication, OpenAI semantic assistance, and a stunning React + Tailwind + Framer Motion frontend.

## ðŸš€ Step 1: Backend Setup (FastAPI + Firestore)

### 1. Configure the Environment
Copy `backend/.env.example` to `backend/.env` and fill values:
```env
FIREBASE_CREDENTIALS=path/to/firebase-adminsdk.json
OPENAI_API_KEY=sk-your-openai-key
```
*(If you do not set Firebase credentials locally, the system will start but Firestore-backed routes will return 503).*

### 2. Install Dependencies
```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Run the Backend API
```bash
uvicorn main:app --reload
```
The FastAPI instance will boot at `http://localhost:8000`. 
Check `http://localhost:8000/docs` to see your completely auto-generated Swagger API documentation.

---

## ðŸ’» Step 2: Frontend Setup (React + Firebase Auth)

### 1. Configure Firebase Credentials
Copy `frontend/.env.example` to `frontend/.env` and fill values (Vite reads `VITE_` variables).
1. Go to [Firebase Console](https://console.firebase.google.com).
2. Create a new project and add a "Web App."
3. Enable "Email/Password" and "Google" under the **Authentication** tab.
4. Copy the config into `frontend/.env` (see existing `VITE_FIREBASE_*` keys).
5. Set `VITE_API_BASE_URL` to your backend URL (example: `https://your-service.onrender.com`).

### 2. Start the Development Server
```bash
cd frontend
npm install
npm run dev
```

Your breathtaking Glassmorphism Dashboard UI is now available on `http://localhost:5174/` or `5173/`.
Because it uses Firebase Authentication out of the box, it will immediately redirect you to the Login Screen until you register.

---

## ðŸŒ Step 3: Deployment (Render + Vercel)

This repo includes `render.yaml` and `frontend/vercel.json` so deployments are repeatable.

### A. Deploy Backend to Render
1. Push this repository to GitHub.
2. In Render, create a new **Blueprint** (recommended) or a **Web Service**.
3. If using Web Service, set the Root Directory to `backend`.
4. Render will use the start command in `render.yaml`: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
5. Add environment variables in Render:
   - `FIREBASE_CREDENTIALS` (paste the full service account JSON)
   - `OPENAI_API_KEY`
   - Optional: `OPENAI_BASE_URL`, `OPENAI_MODEL`
6. Public access is enabled by default via `PUBLIC_API=true` for unauthenticated requests.
   - If a Firebase token is present, the role is read from Firestore.
   - Set `PUBLIC_API=false` to require Firebase auth for all requests.
   - Set `PUBLIC_API_ROLE=librarian` to make admin endpoints public too.

### B. Deploy Frontend to Vercel
1. In Vercel, create a new Project from the repo.
2. Set the Root Directory to `frontend`.
3. Add `VITE_API_BASE_URL` pointing to your Render backend URL (example: `https://your-service.onrender.com`).
4. Deploy. The SPA rewrite is handled by `frontend/vercel.json`.

### C. Database (Firestore)
1. Go to [Firebase Console](https://console.firebase.google.com) and open your project.
2. Enable **Firestore Database** (production mode or test mode).
3. Generate a Service Account key (Project Settings -> Service accounts -> Generate new private key).
4. Paste the JSON into the Render environment variable `FIREBASE_CREDENTIALS`.
