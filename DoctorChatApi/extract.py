import sys

def main():
    try:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        code = []
        in_code = False
        for line in lines:
            if line.strip() == '```csharp':
                in_code = True
                continue
            if in_code and line.strip() == '```':
                in_code = False
                continue
            if in_code:
                code.append(line)
                
        with open(sys.argv[2], 'w', encoding='utf-8') as f:
            f.writelines(code)
        print(f"Successfully extracted {len(code)} lines of C# code.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
