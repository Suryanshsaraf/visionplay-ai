# VisionPlay AI ⚽🤖

VisionPlay AI is a state-of-the-art **AI-Powered Sports Intelligence Platform** designed to analyze sports videos (starting with Football/Soccer) using Computer Vision, Object Tracking, Speech Processing, and a Retrieval-Augmented Generation (RAG) conversational pipeline. 

Instead of manually clipping match segments, users can upload match footage and query the platform using natural language to perform in-depth tactical analysis, gather player telemetry, and generate event timelines.

---

## 🚀 Key Features
*   **Computer Vision Pipeline:** Pre-trained YOLOv11 + ByteTrack object tracking to follow players, referees, and the ball across frames.
*   **Sports Telemetry & Analytics:** Automatic extraction of possession metrics, heatmaps, distances covered, and velocity/sprints.
*   **Tactical Event Timeline:** Automated extraction of timeline milestones like passes, shots, goals, and fouls.
*   **Evidence-Grounded RAG Engine:** Embedded timeline records stored in ChromaDB and integrated with LLMs (Gemini/GPT) to answer conversational tactical queries with clickable video timestamp citations.
*   **Commentary Audio Processing:** Audio speech-to-text indexing powered by OpenAI Whisper.

---

## 🛠️ Tech Stack
*   **Frontend:** React, TypeScript, TailwindCSS
*   **Backend:** FastAPI, Python
*   **Database:** PostgreSQL (structured telemetry), ChromaDB (unstructured vector embeddings)
*   **AI Models:** YOLOv11, ByteTrack, Whisper, Gemini / OpenAI GPT
*   **Containerization:** Docker & Docker Compose
