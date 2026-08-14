from sentence_transformers import SentenceTransformer
from supabase_conn import match_medical_references


class DocumentSearch:
    """Generates query embeddings and searches medical references."""
    def __init__(self, embedding_model_id: str = "BAAI/bge-small-en-v1.5"):
        self.embedding_model = SentenceTransformer(embedding_model_id)

    def _generate_query_embedding(self, query: str) -> list[float]:
        """Generate a normalized embedding for the search query."""
        embedding = self.embedding_model.encode(
            query,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False
        )

        return embedding.tolist()

    def search(
        self,
        query: str,
        match_threshold: float = 0.5,
        match_count: int = 5
    ) -> list[dict]:
        """Search medical references using semantic similarity."""
        query_embedding = self._generate_query_embedding(query)

        return match_medical_references(
            query_embedding=query_embedding,
            match_threshold=match_threshold,
            match_count=match_count
        )

# ==========================================
# Example Usage
# ==========================================
if __name__ == "__main__":
    searcher = DocumentSearch()

    query = "Antibiotics effectiveness for pharyngitis common cold?"

    results = searcher.search(
        query=query,
        match_threshold=0.5,
        match_count=5
    )

    print(f"\nQuery: {query}")
    print(f"Found {len(results)} results\n")

    for i, result in enumerate(results, 1):
        print("=" * 80)
        print(f"Result {i}")
        print(f"Similarity: {result['similarity']:.4f}")
        print(f"Source: {result['source_file']}")
        print(f"Pages: {result['page_numbers']}")
        print(f"Headings: {result['headings']}")
        print(f"\n{result['text']}")