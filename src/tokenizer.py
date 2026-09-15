import tiktoken


class Tokenizer:
    def __init__(self):
        self.encoding = tiktoken.get_encoding("cl100k_base")

    def encode(self, text: str):
        """Convert text into token IDs."""
        return self.encoding.encode(text)

    def decode(self, tokens):
        """Convert token IDs back into text."""
        return self.encoding.decode(tokens)

    def count(self, text: str) -> int:
        """Return the number of tokens in the text."""
        return len(self.encode(text))

    def truncate(self, text: str, max_tokens: int) -> str:
        """Keep only the first max_tokens tokens."""
        tokens = self.encode(text)

        if len(tokens) <= max_tokens:
            return text

        return self.decode(tokens[:max_tokens])