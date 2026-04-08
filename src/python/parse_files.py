"""Parse PDF files and extract structured compliance data using LLM."""
import sys
import os

from src.llm import from_text_to_general_template_using_llm
from src.parse import extract_text_from_pdf


def get_prompt():
    """Load and assemble the prompt from template files."""
    dir_path = os.path.dirname(os.path.realpath(__file__))
    prompt_dir = os.path.join(dir_path, 'include', 'prompt')

    with open(os.path.join(prompt_dir, 'prompt_start.in'), 'r') as f:
        prompt_start = f.read()

    prompt_examples = ""
    for i in [1, 22]:
        with open(os.path.join(prompt_dir, 'examples', f'exp{i}.in'), 'r') as f:
            prompt_examples += f.read()

    with open(os.path.join(prompt_dir, 'prompt_end.in'), 'r') as f:
        prompt_end = f.read()

    return prompt_start + prompt_examples + prompt_end


if __name__ == '__main__':
    input_path = sys.argv[1]
    text, _ = extract_text_from_pdf(input_path)
    general_template = from_text_to_general_template_using_llm(text, get_prompt())
    print(general_template)
