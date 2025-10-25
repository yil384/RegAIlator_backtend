import argparse
import tqdm
import sys
import os

# Insert the parent directory of 'test' (i.e., 'my_project') to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.llm import from_text_to_general_template_using_llm
from src.parse import extract_text_from_pdf

def get_prompt():
    # 获取当前的路径
    dir_path = os.path.dirname(os.path.realpath(__file__))
    # 从 prompt_start.in, prompt_end.in 等文件中读取并拼接成 prompt
    prompt_start = open(f'{dir_path}/../include/prompt_tags/prompt_start.in', 'r').read()
    prompt_examples = ""
    # 读取 prompt/examples 文件夹下 exp1.in
    for i in [1]:
        prompt_examples += open(f'{dir_path}/../include/prompt_tags/examples/exp{i}.in', 'r').read()
    prompt_end = open(f'{dir_path}/../include/prompt_tags/prompt_end.in', 'r').read()
    return prompt_start + prompt_examples + prompt_end

def read_text_file(txt_path):
    """Reads the provided text file."""
    with open(txt_path, 'r', encoding='utf-8') as file:
        return file.read()

def read_pdfs_and_concatenate(n, input_paths):
    """Reads n PDFs and concatenates their text."""
    full_text = ""
    for i in range(n):
        input_path = input_paths[i]
        text, _ = extract_text_from_pdf(input_path)
        full_text += text  # Concatenate the text from each PDF
    return full_text

def pipeline(n):
    results = []
    for i in range(n):
        text = read_text_file(f'./test{i}.in')
        result = from_text_to_general_template_using_llm(text, get_prompt())
        results.append(result)
    return results

if __name__ == '__main__':
    results = pipeline(10)
    print(results)

        