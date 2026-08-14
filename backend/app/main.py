from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.services.supabase_conn import supabase
from app.api_router.create_patient_doctor import router as create_patient_doctor_router
from app.api_router.consultation_stage import router as consultation_stage_router
from app.api_router.consultation_report import router as consultation_report_router


app = FastAPI(
    title="AI Clinical Assistant API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://laughing-eureka-q5jjx476qwgc4xjp-3000.app.github.dev",
        "http://localhost:3000",
    ],
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

app.include_router(create_patient_doctor_router)
app.include_router(consultation_stage_router)
app.include_router(consultation_report_router)