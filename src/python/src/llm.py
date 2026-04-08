import openai
import os

# Cache API key at module level to avoid reading file on every call
_api_key = None

def _get_api_key():
    global _api_key
    if _api_key is None:
        key_path = os.path.join(os.path.dirname(__file__), '..', 'include', 'openai_key.in')
        with open(key_path, 'r') as f:
            _api_key = f.read().strip()
    return _api_key


def _remove_comment_lines(text):
    """Remove lines starting with // (commonly found in LLM JSON output)."""
    return '\n'.join(
        line for line in text.splitlines() if not line.strip().startswith("//")
    )


def from_text_to_general_template_using_llm(text, prompt, input_length=16385, answer_length=4096):
    """Send prompt + text to OpenAI LLM and return cleaned response."""
    openai.api_key = _get_api_key()

    response = openai.ChatCompletion.create(
        model="o1-preview",
        messages=[
            {"role": "user", "content": prompt + text},
        ],
    )

    content = response.choices[0].message.content
    return _remove_comment_lines(content)


if __name__ == '__main__':
    print(from_text_to_general_template_using_llm("", ""))
