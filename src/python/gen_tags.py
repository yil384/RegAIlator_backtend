import argparse
import tqdm
import sys
from src.llm import from_text_to_general_template_using_llm
from src.adaptor import from_general_template_to_xlsx
from src.parse import extract_text_from_pdf, extract_text_from_xlsx
from src.test import test_accuracy
import os
import json

def get_prompt_without_attachment():
    # 获取当前的路径
    dir_path = os.path.dirname(os.path.realpath(__file__))
    prompt = open(f'{dir_path}/./include/prompt_tags/prompt.in', 'r').read()
    return prompt

def get_prompt():
    # # 获取当前的路径
    # dir_path = os.path.dirname(os.path.realpath(__file__))
    # # 从 prompt_start.in, prompt_end.in 等文件中读取并拼接成 prompt
    # prompt_start = open(f'{dir_path}/./include/prompt_tags/prompt_start.in', 'r').read()
    # prompt_examples = ""
    # # 读取 prompt/examples 文件夹下 exp1.in
    # for i in [1, 2]:
    #     prompt_examples += open(f'{dir_path}/./include/prompt_tags/examples/exp{i}.in', 'r').read()
    # prompt_end = open(f'{dir_path}/./include/prompt_tags/prompt_end.in', 'r').read()
    # return prompt_start + prompt_examples + prompt_end
    # 获取当前的路径
    dir_path = os.path.dirname(os.path.realpath(__file__))
    prompt = open(f'{dir_path}/./include/prompt_tags/prompt.in', 'r').read()
    return prompt

def read_text_file(txt_path):
    """Reads the provided text file."""
    with open(txt_path, 'r', encoding='utf-8') as file:
        return file.read()

def read_pdfs_and_concatenate(n, input_paths):
    """Reads n PDFs and concatenates their text."""
    full_text = ""
    for i in range(n):
        input_path = input_paths[i]
        # 判断是 pdf 文件还是 xlsx 文件
        if input_path.endswith('.xlsx'):
            text, _ = extract_text_from_xlsx(input_path)
        else:
            text, _ = extract_text_from_pdf(input_path)
        full_text += text  # Concatenate the text from each PDF
    return full_text

if __name__ == '__main__':
    # Parse the command-line arguments
    parser = argparse.ArgumentParser(description="Read a text file and multiple PDF files, then process them.")
    parser.add_argument('txt_path', type=str, help='Path to the text file')
    parser.add_argument('n', type=int, help='Number of PDF files to process')
    parser.add_argument('pdf_paths', nargs='*', help='List of PDF file paths')
    args = parser.parse_args()

    # Read the provided text file
    text_from_txt = read_text_file(args.txt_path)

    if args.n == 0:
        if "no pfas" in text_from_txt.lower(): # [FIXME] no PFAS
            result = {
                "tags": ["no PFAS"],
                "reply": {
                    "subject": "No PFAS Detected",
                    "content": "No PFAS were detected in the provided samples."
                    }
                }
            print(json.dumps(result), flush=True)
        elif "no info" in text_from_txt.lower(): # [FIXME] no info
            result = {
                "tags": ["no info"],
                "reply": {
                    "subject": "No Information Provided",
                    "content": "No information was provided in the text file."
                    }
                }
            print(json.dumps(result), flush=True)
        else:
            result = from_text_to_general_template_using_llm(text_from_txt, get_prompt_without_attachment())
            print(result)
    else:
        # Validate the number of PDF paths
        if len(args.pdf_paths) != args.n:
            print(f"Error: Expected {args.n} PDF files, but got {len(args.pdf_paths)}.")
            sys.exit(1)
        # Concatenate the text from the given PDF files
        concatenated_text = text_from_txt + read_pdfs_and_concatenate(args.n, args.pdf_paths)
        # Process the concatenated text with the LLM
        result = from_text_to_general_template_using_llm(concatenated_text, get_prompt())
        print(result)
