import re
import os
import json
import torch
import asyncio
import hashlib
from pathlib import Path
from docling.document_converter import DocumentConverter
from docling.chunking import HybridChunker
from transformers import AutoTokenizer
from sentence_transformers import SentenceTransformer
from supabase_conn import insert_medical_references

class DocumentProcessor:
    """
    An asynchronous callable class that processes a directory of documents, chunks them,
    filters out reference/bibliography sections, adds chunk overlap, generates semantic
    embeddings, and writes all chunk data to JSONL.
    """
    def __init__(
        self, 
        banned_headings: set = None, 
        max_concurrency: int = 5, 
        overlap_words: int = 50,
        embedding_model_id: str = "BAAI/bge-small-en-v1.5",
        target_max_tokens: int = 400
    ):

        # 1. Environment variable override
        os.environ["DOCLING_INFERENCE_COMPILE_TORCH_MODELS"] = "false"

        # 2. PyTorch dynamo disable
        torch._dynamo.config.suppress_errors = True
        torch._dynamo.config.disable = True

        # 3. Docling configuration setting
        from docling.datamodel.settings import settings
        settings.inference.compile_torch_models = False

        # 4. Embedding tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(embedding_model_id)

        # 5. Semantic embedding model
        self.embedding_model = SentenceTransformer(embedding_model_id)

        self.converter = DocumentConverter()
        self.chunker = HybridChunker(
            tokenizer=self.tokenizer,
            max_tokens=target_max_tokens
        )
        self.overlap_words = overlap_words
        
        self.banned_headings = banned_headings or {
            "references", 
            "the authors", 
            "author information", 
            "bibliography", 
            "works cited"
        }

        # Async Primitives
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self.file_lock = asyncio.Lock()

    def _clean_text(self, text: str) -> str:
        """Removes PDF font artifact symbols and normalizes spacing."""
        text = text.replace("", "")
        text = re.sub(r'[\uf000-\uf8ff]', '', text)
        text = re.sub(r'[ \t]+', ' ', text)
        return text.strip()

    def _is_reference_chunk(self, chunk) -> bool:
        """Internal helper to determine if a chunk is a reference section."""
        headings = getattr(chunk.meta, "headings", []) or []

        if any(h.lower().strip() in self.banned_headings for h in headings):
            return True

        text = chunk.text

        citation_starts = len(re.findall(r'^\s*\d+[\.\)]\s+[A-Z]', text, re.MULTILINE))
        urls_and_dois = len(re.findall(r'https?://|doi\.org|\b\d{4};\s*\d+', text))

        if citation_starts >= 3 or (citation_starts >= 1 and urls_and_dois >= 2):
            return True

        return False

    def _get_page_numbers(self, chunk) -> list[int]:
        """Extracts all source page numbers associated with a chunk."""
        return sorted({
            prov.page_no
            for item in getattr(chunk.meta, "doc_items", []) or []
            for prov in getattr(item, "prov", []) or []
            if getattr(prov, "page_no", None) is not None
        })

    def _get_overlap_prefix(self, previous_text: str) -> str:
        """Extracts the trailing N words from the previous chunk."""
        if not previous_text or self.overlap_words <= 0:
            return ""
        
        words = previous_text.split()

        if len(words) <= self.overlap_words:
            return previous_text
        
        return " ".join(words[-self.overlap_words:])

    def _generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generates normalized semantic embeddings for a list of texts."""
        if not texts:
            return []

        embeddings = self.embedding_model.encode(
            texts,
            batch_size=32,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False
        )

        return embeddings.tolist()

    def generate_chunk_hash(self, source_file: str, text: str, page_numbers: list[int], headings: list[str]) -> str:
        """Generate a deterministic hash used to identify duplicate document chunks."""
        payload = {
            "source_file": source_file,
            "text": text,
            "page_numbers": page_numbers,
            "headings": headings
        }

        normalized = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    async def _process_single_file(self, file_path: Path):
        """Core asynchronous worker for a single document."""
        async with self.semaphore:
            print(f"Starting document: {file_path.name}")
            
            # Convert and chunk via thread pool
            result = await asyncio.to_thread(self.converter.convert, str(file_path))
            chunk_iter = await asyncio.to_thread(self.chunker.chunk, result.document)

            # Filter out reference chunks
            valid_chunks = [
                chunk
                for chunk in chunk_iter
                if not self._is_reference_chunk(chunk)
            ]

            #  Build chunks with overlap
            chunk_records = []

            prev_heading = ""
            prev_cleaned_text = ""
            overlap_prefix = ""

            for chunk_index, chunk in enumerate(valid_chunks):
                cleaned_text = self._clean_text(chunk.text)
                headings = getattr(chunk.meta, "headings", []) or []
                page_numbers = self._get_page_numbers(chunk)

                # Extract trailing words from previous chunk
                # only when both chunks belong to the same heading
                if prev_heading == headings:
                    overlap_prefix = self._get_overlap_prefix(prev_cleaned_text)
                else:
                    overlap_prefix = ""

                if overlap_prefix:
                    full_chunk_text = f"... {overlap_prefix} {cleaned_text}"
                else:
                    full_chunk_text = cleaned_text

                # Generate chunk hash
                chunk_hash = self.generate_chunk_hash(
                    file_path.name,
                    full_chunk_text,
                    page_numbers,
                    headings
                )

                chunk_records.append({
                    "chunk_index": chunk_index,
                    "source_file": file_path.name,
                    "headings": headings,
                    "page_numbers": page_numbers,
                    "text": full_chunk_text,
                    "chunk_hash": chunk_hash
                })

                # Store current chunk text for next iteration
                prev_heading = headings
                prev_cleaned_text = cleaned_text

            # Step 3: Generate embeddings for all chunks
            if chunk_records:
                embedding_texts = [record["text"] for record in chunk_records]

                embeddings = await asyncio.to_thread(self._generate_embeddings, embedding_texts)

                for record, embedding in zip(chunk_records, embeddings):
                    record["embedding"] = embedding

            # Step 4: Insert chunks into Supabase
            if chunk_records:
                inserted_records = await asyncio.to_thread(insert_medical_references, chunk_records)
                print(f"Inserted {len(inserted_records)} new chunks from {file_path.name}")

    async def __call__(self, input_dir: str | Path):
        data_dir = Path(input_dir)

        files = [f for f in data_dir.glob("*") if f.is_file()]

        if not files:
            print("No files found to process.")
            return

        print(f"Found {len(files)} files. Starting async processing with embeddings...")

        tasks = [self._process_single_file(f) for f in files]

        await asyncio.gather(*tasks)

        print("All documents processed successfully.")


# ==========================================
# Example Usage
# ==========================================
if __name__ == "__main__":
    # Configure with max 3 concurrent files and
    # 50 words of overlap between chunks
    process_medical_docs = DocumentProcessor(
        max_concurrency=3,
        overlap_words=50
    )
    
    asyncio.run(
        process_medical_docs(
            input_dir="data/medical_references",
        )
    )