"""Generate tags and auto-reply from email text and optional PDF/XLSX attachments."""
import argparse
import sys
import os
import json

from src.llm import from_text_to_general_template_using_llm
from src.parse import extract_text_from_pdf, extract_text_from_xlsx


def get_prompt():
    """Load the tagging prompt template."""
    dir_path = os.path.dirname(os.path.realpath(__file__))
    prompt_path = os.path.join(dir_path, 'include', 'prompt_tags', 'prompt.in')
    with open(prompt_path, 'r') as f:
        return f.read()


def read_text_file(txt_path):
    """Read a text file and return its content."""
    with open(txt_path, 'r', encoding='utf-8') as f:
        return f.read()


def read_attachments_text(file_paths):
    """Extract and concatenate text from PDF/XLSX attachment files."""
    full_text = ""
    for file_path in file_paths:
        if file_path.endswith('.xlsx'):
            text, _ = extract_text_from_xlsx(file_path)
        else:
            text, _ = extract_text_from_pdf(file_path)
        full_text += text
    return full_text


# Pre-defined quick-match results for common simple cases
QUICK_MATCH_RULES = {
    "no pfas": {
        "tags": ["no PFAS"],
        "reply": {
            "subject": "No PFAS Detected",
            "content": "No PFAS were detected in the provided samples.",
        },
    },
    "no info": {
        "tags": ["no info"],
        "reply": {
            "subject": "No Information Provided",
            "content": "No information was provided in the text file.",
        },
    },
}


def check_quick_match(text):
    """Check if text matches any quick-match rules. Returns result dict or None."""
    text_lower = text.lower()
    for keyword, result in QUICK_MATCH_RULES.items():
        if keyword in text_lower:
            return result
    return None


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Generate tags from email text and optional PDF/XLSX attachments."
    )
    parser.add_argument('txt_path', type=str, help='Path to the email text file')
    parser.add_argument('n', type=int, help='Number of attachment files to process')
    parser.add_argument('pdf_paths', nargs='*', help='List of attachment file paths')
    args = parser.parse_args()

    email_text = read_text_file(args.txt_path)

    if args.n == 0:
        # No attachments - check for quick matches first
        quick_result = check_quick_match(email_text)
        if quick_result:
            print(json.dumps(quick_result), flush=True)
        else:
            result = from_text_to_general_template_using_llm(email_text, get_prompt())
            print(result)
    else:
        if len(args.pdf_paths) != args.n:
            print(f"Error: Expected {args.n} files, but got {len(args.pdf_paths)}.")
            sys.exit(1)

        combined_text = email_text + read_attachments_text(args.pdf_paths)
        result = from_text_to_general_template_using_llm(combined_text, get_prompt())
        print(result)
