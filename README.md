# VisionPlay AI ⚽🤖

VisionPlay AI is a state-of-the-art **AI-Powered Sports Intelligence Platform** designed to analyze sports videos (specifically Football/Soccer) using Computer Vision, Object Tracking, Positional Analytics, and a Retrieval-Augmented Generation (RAG) conversational pipeline. 

Instead of manually clipping match segments, users can upload match footage and query the platform using natural language to perform in-depth tactical analysis, inspect player occupancy heatmaps, and interact with the video via clickable RAG-generated citations.

---

## 🚀 Key Features

*   **Apple Silicon M4 Hardware Acceleration:** Auto-detects and leverages macOS Metal Performance Shaders (`device="mps"`) to process deep learning inference directly on the MacBook Air GPU cores.
*   **Computer Vision Tracking (YOLOv11 + ByteTrack):** Employs YOLOv11 and ByteTrack to track players, ball, and referee locations across sampled video frames.
*   **Telemetry Analytics Engine:** Automatically calculates team possession percentages, individual player velocities, sprint metrics, and cumulative distances covered.
*   **Tactical Event Timeline:** Rule-based heuristics dynamically parse possession logs to output key events (Passes, Interceptions, Shots, and Goals).
*   **2D Pitch Occupancy Heatmaps:** Automatically plots Seaborn Kernel Density Estimation (KDE) pitch heatmaps utilizing the non-interactive Matplotlib `Agg` backend.
*   **Conversational RAG Chat Engine (ChromaDB + Gemini):** Indexes events into a persistent ChromaDB vector store. Queries route to **Gemini 2.5** (via the `google-genai` SDK) to answer natural language questions with interactive, clickable video timestamp citations.
*   **Offline Fallback Mode:** Includes a local hash-based embedding client and rule-based responder that operates 100% offline if no internet or Gemini API key is configured.

---

## 🛠️ Tech Stack

*   **Frontend:** React (Vite), TypeScript, Tailwind CSS
*   **Backend:** FastAPI (Python 3.13)
*   **Database:** SQLite (local persistent relational storage) & ChromaDB (local persistent vector storage)
*   **AI/CV Libraries:** PyTorch (MPS GPU accelerated), OpenCV, Ultralytics YOLOv11, ByteTrack
*   **Visualizations:** Seaborn, Matplotlib

---

## ⚙️ Local Startup Guide (Mac OS)

Follow these steps to run the complete VisionPlay AI stack locally on your M4 MacBook Air:

### 1. Configure Environment Variables
Inside the `backend/` directory, create a `.env` file to add your Gemini API key (optional but recommended for live LLM reasoning):
```bash
# backend/.env
GEMINI_API_KEY="your-google-gemini-api-key-here"
```

### 2. Start the FastAPI Backend Server
The backend environment is already fully set up with all dependencies installed.
```bash
# Navigate to backend directory
cd backend

# Activate virtual environment
source env/bin/activate

# Run Uvicorn dev server on port 8000
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Once started, the backend is active at `http://localhost:8000` (API documentation is available at `http://localhost:8000/docs`).

### 3. Start the React Frontend Client
Open a new terminal window to start the Vite development server:
```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies (if running for the first time)
npm install

# Start Vite dev server
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser to launch the dashboard!

---

## 🧪 Development & Verification Testing

To verify the endpoints, tracking pipelines, and vector search systems without launching the GUI:
```bash
# Execute end-to-end happy path upload, CV, and RAG search test
cd backend
PYTHONPATH=. env/bin/python ../brain/3c628056-fc10-4555-abd7-d6c708416784/scratch/test_happy_path.py

# Execute API endpoints and citation parser tests
PYTHONPATH=. env/bin/python ../brain/3c628056-fc10-4555-abd7-d6c708416784/scratch/test_endpoints.py
```
