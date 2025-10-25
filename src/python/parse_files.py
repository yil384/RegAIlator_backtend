import argparse
import tqdm
import sys
# Import the functions from the other files
from src.llm import from_text_to_general_template_using_llm
from src.adaptor import from_general_template_to_xlsx
from src.parse import extract_text_from_pdf
from src.test import test_accuracy
import os

def get_prompt():
    # 获取当前的路径
    dir_path = os.path.dirname(os.path.realpath(__file__))
    # 从 prompt_start.in, prompt_end.in 等文件中读取并拼接成 prompt
    prompt_start = open(f'{dir_path}/./include/prompt/prompt_start.in', 'r').read()
    prompt_examples = ""
    # 读取 prompt/examples 文件夹下 exp1.in, exp22.in
    for i in [1, 22]:
        prompt_examples += open(f'{dir_path}/./include/prompt/examples/exp{i}.in', 'r').read()
    prompt_end = open(f'{dir_path}/./include/prompt/prompt_end.in', 'r').read()
    return prompt_start + prompt_examples + prompt_end

# def pipeline(test_data):
#     # Define the pipeline function
#     def from_pdf_to_xlsx(input_path, output_path):
#         text, _ = extract_text_from_pdf(input_path)
#         if args.debug:
#             open(input_path+'.txt', 'w').write(text)
#         # 如果 from_general_template_to_xlsx 报错，就在一定次数内重试
#         max_tries = 5
#         try_count = max_tries
#         while try_count > 0:
#             try:
#                 input_length = 16385 - (max_tries-try_count)*1000 # from 16385 to 12385
#                 answer_length = 2048 + (max_tries-try_count)*500 # from 2048 to 4048
#                 general_template = from_text_to_general_template_using_llm(text, get_prompt(), input_length, answer_length)
#                 if args.debug:
#                     print("-----------------------------------")
#                     print(general_template)
#                     print("-----------------------------------")
#                 from_general_template_to_xlsx(general_template, output_path)
#                 if args.debug:
#                     print(f"Successfully converted {input_path} to {output_path}.")
#                     print("-----------------------------------")
#                 break
#             except Exception as e:
#                 print(f"Error: {e}")
#                 print("Retrying...")
#                 try_count -= 1
#                 if try_count == 0:
#                     return e
#         return None
        
#     # Iterate over the test data
#     accuracy_list = []
#     for pdf_path in tqdm.tqdm(test_data):
#         input_path, output_path, answer_path = pdf_path
#         error = from_pdf_to_xlsx(input_path, output_path)
#         if error is not None:
#             print(f'Failed to convert {input_path} to {output_path}.')
#             continue
#         accuracy = test_accuracy(output_path, answer_path, args.debug)
#         if args.debug:
#             # 百分数格式化
#             print(f'Accuracy: {accuracy:.2%}')
#             print("-----------------------------------")
#         accuracy_list.append({output_path: accuracy})
#     # Print the accuracy list as a table
#     for accuracy_dict in accuracy_list:
#         print("--------------------------------------")
#         for key, value in accuracy_dict.items():
#             print('|', f'{key}: {value:.2%}', '|')
#             print("--------------------------------------")
#     return


if __name__ == '__main__':
    # # Add a debug mode to the script
    # parser = argparse.ArgumentParser(description="A script with a debug mode.")
    # parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    # args = parser.parse_args()
    # # Pack the Input and Answer paths into a tuple, and then put them into the tests list
    # tests = []
    # for i in [2, 3, 4, 5]:
    #     tests += [(f'./tests/input/Input_{i}.pdf', f'./tests/output/Output_{i}.xlsx', f'./tests/answer/Answer_{i}.xlsx')]
    # # Run the pipeline
    # pipeline(test_data=tests)

    # 将第一个参数作为输入文件路径
    input_path = sys.argv[1]
    text, _ = extract_text_from_pdf(input_path)
    general_template = from_text_to_general_template_using_llm(text, get_prompt())
    print(general_template)
