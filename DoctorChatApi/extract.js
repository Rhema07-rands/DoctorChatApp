const fs = require('fs');

try {
    const inputFile = process.argv[2];
    const outputFile = process.argv[3];

    const text = fs.readFileSync(inputFile, 'utf8');
    const lines = text.split('\n');
    let inCode = false;
    let code = [];

    for (const line of lines) {
        if (line.trim() === '```csharp') {
            inCode = true;
            continue;
        }
        if (inCode && line.trim() === '```') {
            inCode = false;
            continue;
        }
        if (inCode) {
            code.push(line);
        }
    }

    fs.writeFileSync(outputFile, code.join('\n'));
    console.log(`Done extracting ${code.length} lines.`);
} catch (e) {
    console.error(e);
}
