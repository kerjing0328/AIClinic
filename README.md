<img width="1920" height="1080" alt="AI Clinical Assistant" src="https://github.com/user-attachments/assets/dce980aa-b441-4ad6-8315-b79ec575a020" />

# 🏥 AIClinic

An AI-powered clinical application featuring a robust Python backend and a responsive Next.js frontend. This project leverages AI agents and Large Language Models to assist with consultation documentation processing using RAG to provide LLM with relevant medical knowledge to assist with the consultation.

## 🚀 Tech Stack

**Frontend:**
*   Framework: Next.js (React.js)
*   Language: TypeScript

**Backend:**
*   API: FastAPI
*   Language: Python

---

Backend Setup

```bash
cd backend

# IMPORTANT: Use your own local virtual environment for this project.

# Create a virtual environment (if not already created)
python -m venv .venv

# Activate the virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install required Python packages
pip install -r requirements.txt

# Run the backend FastAPI server
uvicorn app.main:app --reload
```
---

Frontend Setup

```bash
cd frontend

# Install Node modules
npm install

# Start the Next.js development server
npm run dev

# Access the app
http://localhost:3000
```
