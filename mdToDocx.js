const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');

const mdPath = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\eb79c196-b86d-4f5c-b073-033cf7f44143\\webrtc_signalr_architecture.md';
const docxPath = 'C:\\Users\\HP\\Downloads\\DoctorChatApp\\DoctorChat_WebRTC_Architecture.docx';

const content = fs.readFileSync(mdPath, 'utf-8');
const lines = content.split(/\r?\n/);

const children = [];
let inCodeBlock = false;
let codeString = '';

function parseText(text) {
    const runs = [];
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            runs.push(new TextRun({ text: text.substring(lastIndex, match.index), size: 22, font: 'Calibri' }));
        }
        runs.push(new TextRun({ text: match[1], bold: true, size: 22, font: 'Calibri' }));
        lastIndex = boldRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        runs.push(new TextRun({ text: text.substring(lastIndex), size: 22, font: 'Calibri' }));
    }
    return runs.length > 0 ? runs : [new TextRun({ text: text, size: 22, font: 'Calibri' })];
}

for (const line of lines) {
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
            inCodeBlock = false;
            children.push(new Paragraph({
                children: [new TextRun({ text: codeString, font: 'Consolas', size: 18, color: '1A202C' })],
                spacing: { before: 200, after: 200 },
                shading: { type: 'solid', color: 'F1F5F9', fill: 'F1F5F9' },
                indent: { left: 400 }
            }));
            codeString = '';
        } else {
            inCodeBlock = true;
        }
        continue;
    }

    if (inCodeBlock) {
        codeString += line + '\n';
        continue;
    }

    // Headers
    if (trimmed.startsWith('# ')) {
        children.push(new Paragraph({
            text: trimmed.replace('# ', ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
        }));
        continue;
    }
    if (trimmed.startsWith('## ')) {
        children.push(new Paragraph({
            text: trimmed.replace('## ', ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
        }));
        continue;
    }
    if (trimmed.startsWith('### ')) {
        children.push(new Paragraph({
            text: trimmed.replace('### ', ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
        }));
        continue;
    }
    if (trimmed.startsWith('---')) {
        children.push(new Paragraph({
            text: '--------------------------------------------------',
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 }
        }));
        continue;
    }

    // Empty lines
    if (trimmed === '') {
        children.push(new Paragraph({ text: '', spacing: { before: 60, after: 60 } }));
        continue;
    }

    // Lists
    if (trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
        children.push(new Paragraph({
            children: parseText(trimmed),
            spacing: { before: 80, after: 80 },
            indent: { left: 400 },
        }));
        continue;
    }

    // Regular paragraphs (Inline code `` formatting unsupported, but bold is)
    children.push(new Paragraph({
        children: parseText(line),
        spacing: { before: 120, after: 120 },
    }));
}

const doc = new Document({
    title: 'DoctorChatApp Real-Time Architecture',
    description: 'WebRTC and SignalR Implementation',
    styles: {
        default: { document: { run: { size: 22, font: 'Calibri' } } },
    },
    sections: [{
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: children,
    }],
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(docxPath, buffer);
    console.log('DOCX file created successfully at:', docxPath);
}).catch(err => {
    console.error('Error:', err);
});
