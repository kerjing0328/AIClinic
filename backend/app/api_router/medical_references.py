from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse


router = APIRouter(
    prefix="/medical_references",
    tags=["Medical References"],
)


DATA_DIR = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "medical_references"
    / "already_added"
)


@router.get("")
def list_medical_references():
    """
    List all PDF files in data/medical_references/already_added/.
    Returns file metadata for the frontend references page.
    """
    if not DATA_DIR.exists():
        return {
            "success": True,
            "documents": [],
        }

    documents = []

    for f in sorted(DATA_DIR.iterdir()):
        if f.is_file() and f.suffix.lower() == ".pdf":
            stat = f.stat()

            documents.append({
                "name": f.name,
                "size_bytes": stat.st_size,
                "modified_at": stat.st_mtime,
            })

    return {
        "success": True,
        "documents": documents,
    }


@router.get("/{filename}")
def serve_medical_reference(filename: str):
    """
    Serve a single PDF file for browser viewing.
    """
    filename = Path(filename).name
    file_path = DATA_DIR / filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",
        },
    )