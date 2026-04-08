"""Test pipeline for tags generation - runs LLM tagging on sample inputs."""
import sys
import os

# Add parent directory to path so we can import src modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.llm import from_text_to_general_template_using_llm


def get_prompt():
    """Load and assemble the tags prompt from template files."""
    dir_path = os.path.dirname(os.path.realpath(__file__))
    prompt_dir = os.path.join(dir_path, '..', 'include', 'prompt_tags')

    with open(os.path.join(prompt_dir, 'prompt_start.in'), 'r') as f:
        prompt_start = f.read()

    prompt_examples = ""
    for i in [1]:
        with open(os.path.join(prompt_dir, 'examples', f'exp{i}.in'), 'r') as f:
            prompt_examples += f.read()

    with open(os.path.join(prompt_dir, 'prompt_end.in'), 'r') as f:
        prompt_end = f.read()

    return prompt_start + prompt_examples + prompt_end


def pipeline(n):
    """Run tagging pipeline on n test input files (test0.in through test{n-1}.in)."""
    results = []
    for i in range(n):
        with open(f'./test{i}.in', 'r', encoding='utf-8') as f:
            text = f.read()
        result = from_text_to_general_template_using_llm(text, get_prompt())
        results.append(result)
    return results


if __name__ == '__main__':
    results = pipeline(10)
    print(results)
