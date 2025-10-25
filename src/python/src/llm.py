import openai # TODO: Replace with Llama3
import os

def from_text_to_general_template_using_llm(text, prompt, input_length=16385, answer_length=4096):
        dir_path = os.path.dirname(os.path.realpath(__file__))
        openai.api_key = open(f'{dir_path}/../include/openai_key.in', 'r').read()
        # 给 text 做截断处理
        # text = text[:input_length] # This model's maximum context length is 16385 tokens.
        
        response1 = openai.ChatCompletion.create(
            model="o1-preview",
            messages=[
                    # {"role": "system", "content": prompt},
                    {"role": "user", "content": prompt + text},
                ],
            # max_tokens=answer_length,  # 控制生成的回复长度(最大为4096)
            # temperature=0.1,  # 控制生成文本的创造性（0-1之间，越高越随机）
        )
        def remove_comments(text):
            """
            从文本中移除以 // 开头的注释行（包括前面的空格）。
            """
            return '\n'.join(
                line for line in text.splitlines() if not line.strip().startswith("//")
            )
        # 获取内容并移除注释行
        content = response1.choices[0].message.content
        cleaned_content = remove_comments(content)
        return cleaned_content


if __name__ == '__main__':
    text = ""
    print(from_text_to_general_template_using_llm(text))