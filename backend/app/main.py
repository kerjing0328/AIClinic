from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.services.supabaseconn import supabase

app = FastAPI(
    title="AI Clinical Assistant API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "AI Clinical Assistant API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }

@app.get("/test-supabase")
def test_supabase():
    try:
        response = supabase.table("patients").select("*").limit(1).execute()

        return {
            "status": "success",
            "message": "FastAPI connected to Supabase",
            "data": response.data
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }