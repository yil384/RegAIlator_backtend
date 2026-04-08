import pandas as pd
from .adaptor import COLUMNS


def _fuzzy_match(a, b):
    """Check if either string contains the other (case-insensitive)."""
    a_lower = str(a).strip().lower()
    b_lower = str(b).strip().lower()
    return a_lower in b_lower or b_lower in a_lower


def test_accuracy(output_path, answer_path, debug=False):
    """Compare output spreadsheet against answer key and return accuracy score.

    Uses exact matching first, then falls back to fuzzy (substring) matching.
    """
    answer = pd.read_json(
        pd.read_excel(answer_path, engine='openpyxl', sheet_name="Sheet1").to_json(orient='records')
    )
    output = pd.read_json(
        pd.read_excel(output_path, engine='openpyxl', sheet_name="Sheet1").to_json(orient='records')
    )

    if debug:
        print("answer:", answer)
        print("-------------------")
        print("output:", output)
        print("-------------------")

    correct = 0
    total = len(answer) * len(COLUMNS)

    for i in range(min(len(answer), len(output))):
        for key in COLUMNS:
            answer_val = str(answer.iloc[i][key]).strip().lower()
            output_val = str(output.iloc[i][key]).strip().lower()

            if answer_val == output_val:
                correct += 1
            elif _fuzzy_match(answer.iloc[i][key], output.iloc[i][key]):
                correct += 1
            elif debug:
                print(f"key: {key}")
                print(f"  {answer.iloc[i][key]} != {output.iloc[i][key]}")
                print("-------------------")

    return correct / total


if __name__ == '__main__':
    accuracy = test_accuracy('output.xlsx', 'answer.xlsx')
    print(f'Accuracy: {accuracy}')
