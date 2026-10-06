'use strict';
Object.defineProperty(exports, '__esModule', { value: true });

const crypto_1 = require('crypto');
let baileysGenId;
try {
    baileysGenId = require('@whiskeysockets/baileys').generateMessageID;
} catch (_) {}

const Defaults_1 = {
    BOT_RENDERING_CONFIG_METADATA: {
        bloksVersioningId: '0903aa5f7f47de66789d5f4c86d3bd6e05e4bc3ff85e454a9f907d5ed7fef97c',
        pixelDensity: 2.75
    }
};

const generateMessageIDV2 = () => {
    if (typeof baileysGenId === 'function') {
        return baileysGenId();
    }
    return '3EB0' + crypto_1.randomBytes(9).toString('hex').toUpperCase();
};
const generics_1 = { generateMessageIDV2 };
exports.generateRichMessageContent = exports.generateUnifiedResponseContent = exports.captureUnifiedResponse = exports.generateLatexInlineImageContent = exports.generateLatexImageContent = exports.generateLatexContent = exports.generateLinkContentV2 = exports.generateLinkContent = exports.generateCodeBlockContentV2 = exports.generateCodeBlockContent = exports.generateListContent = exports.generateTableContentV2 = exports.generateTableContent = exports.tokenizeCodeV2 = exports.tokenizeCode = exports.RichSubMessageType = exports.CodeHighlightType = exports.LANGUAGE_KEYWORDS = exports.BASH_KEYWORDS = exports.LUA_KEYWORDS = exports.GO_KEYWORDS = exports.PYTHON_KEYWORDS = exports.JS_KEYWORDS = void 0;

// ========== KEYWORDS ==========
exports.JS_KEYWORDS = new Set([
    "import", "export", "from", "default", "as", "const", "let", "var",
    "function", "class", "extends", "new", "return", "if", "else", "for",
    "while", "do", "switch", "case", "break", "continue", "try", "catch",
    "finally", "throw", "async", "await", "yield", "typeof", "instanceof",
    "in", "of", "delete", "void", "true", "false", "null", "undefined",
    "NaN", "Infinity", "this", "super", "static", "get", "set", "debugger", "with"
]);

exports.PYTHON_KEYWORDS = new Set([
    "import", "from", "as", "def", "class", "return", "if", "elif", "else",
    "for", "while", "break", "continue", "try", "except", "finally", "raise",
    "with", "yield", "lambda", "pass", "del", "global", "nonlocal", "assert",
    "True", "False", "None", "and", "or", "not", "in", "is", "async", "await",
    "self", "print"
]);

exports.GO_KEYWORDS = new Set([
    "func", "package", "import", "return", "if", "else", "for", "switch",
    "case", "break", "continue", "type", "struct", "interface", "map",
    "chan", "go", "defer", "const", "var", "range", "true", "false", "nil",
    "select", "default", "fallthrough"
]);

exports.LUA_KEYWORDS = new Set([
    "function", "end", "if", "then", "else", "elseif", "for", "while", "do",
    "local", "return", "true", "false", "nil", "repeat", "until", "in",
    "not", "and", "or"
]);

exports.BASH_KEYWORDS = new Set([
    "if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case",
    "esac", "echo", "export", "return", "in", "function", "local", "read",
    "set", "unset", "true", "false", "exit", "source", "alias", "declare", "typeset"
]);

exports.LANGUAGE_KEYWORDS = {
    javascript: exports.JS_KEYWORDS,
    typescript: exports.JS_KEYWORDS,
    js: exports.JS_KEYWORDS,
    ts: exports.JS_KEYWORDS,
    python: exports.PYTHON_KEYWORDS,
    py: exports.PYTHON_KEYWORDS,
    go: exports.GO_KEYWORDS,
    golang: exports.GO_KEYWORDS,
    lua: exports.LUA_KEYWORDS,
    bash: exports.BASH_KEYWORDS,
    sh: exports.BASH_KEYWORDS,
    shell: exports.BASH_KEYWORDS,
};

var CodeHighlightType;
(function (CodeHighlightType) {
    CodeHighlightType[CodeHighlightType["DEFAULT"] = 0] = "DEFAULT";
    CodeHighlightType[CodeHighlightType["KEYWORD"] = 1] = "KEYWORD";
    CodeHighlightType[CodeHighlightType["METHOD"] = 2] = "METHOD";
    CodeHighlightType[CodeHighlightType["STRING"] = 3] = "STRING";
    CodeHighlightType[CodeHighlightType["NUMBER"] = 4] = "NUMBER";
    CodeHighlightType[CodeHighlightType["COMMENT"] = 5] = "COMMENT";
})(CodeHighlightType || (exports.CodeHighlightType = CodeHighlightType = {}));

var RichSubMessageType;
(function (RichSubMessageType) {
    RichSubMessageType[RichSubMessageType["UNKNOWN"] = 0] = "UNKNOWN";
    RichSubMessageType[RichSubMessageType["GRID_IMAGE"] = 1] = "GRID_IMAGE";
    RichSubMessageType[RichSubMessageType["TEXT"] = 2] = "TEXT";
    RichSubMessageType[RichSubMessageType["INLINE_IMAGE"] = 3] = "INLINE_IMAGE";
    RichSubMessageType[RichSubMessageType["TABLE"] = 4] = "TABLE";
    RichSubMessageType[RichSubMessageType["CODE"] = 5] = "CODE";
    RichSubMessageType[RichSubMessageType["DYNAMIC"] = 6] = "DYNAMIC";
    RichSubMessageType[RichSubMessageType["MAP"] = 7] = "MAP";
    RichSubMessageType[RichSubMessageType["LATEX"] = 8] = "LATEX";
    RichSubMessageType[RichSubMessageType["CONTENT_ITEMS"] = 9] = "CONTENT_ITEMS";
})(RichSubMessageType || (exports.RichSubMessageType = RichSubMessageType = {}));

// ========== TOKENIZE CODE ==========
const tokenizeCode = (codeStr, language = "javascript") => {
    const keywords = exports.LANGUAGE_KEYWORDS[language] || exports.JS_KEYWORDS;
    const blocks = [];
    const lines = codeStr.split("\n");

    for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        const isLast = li === lines.length - 1;
        const nl = isLast ? "" : "\n";

        if (!line.trim()) {
            blocks.push({ highlightType: CodeHighlightType.DEFAULT, codeContent: line + nl });
            continue;
        }

        if (line.trim().startsWith("//") || line.trim().startsWith("#")) {
            blocks.push({ highlightType: CodeHighlightType.COMMENT, codeContent: line + nl });
            continue;
        }

        const regex = /(\/\/.*$|#.*$)|(["'`](?:[^"'`\\]|\\.)*["'`])|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][\w$]*\b)|([^\s\w$"'`]+)|(\s+)/g;
        let match;
        const tokens = [];

        while ((match = regex.exec(line)) !== null) {
            const val = match[0];
            if (match[1]) {
                tokens.push({ highlightType: CodeHighlightType.COMMENT, codeContent: val });
            } else if (match[2]) {
                tokens.push({ highlightType: CodeHighlightType.STRING, codeContent: val });
            } else if (match[3]) {
                tokens.push({ highlightType: CodeHighlightType.NUMBER, codeContent: val });
            } else if (match[4]) {
                if (keywords.has(val)) {
                    tokens.push({ highlightType: CodeHighlightType.KEYWORD, codeContent: val });
                } else {
                    const after = line.slice(regex.lastIndex).trimStart();
                    if (after.startsWith("(")) {
                        tokens.push({ highlightType: CodeHighlightType.METHOD, codeContent: val });
                    } else {
                        tokens.push({ highlightType: CodeHighlightType.DEFAULT, codeContent: val });
                    }
                }
            } else {
                tokens.push({ highlightType: CodeHighlightType.DEFAULT, codeContent: val });
            }
        }

        if (tokens.length === 0) {
            blocks.push({ highlightType: CodeHighlightType.DEFAULT, codeContent: line + nl });
            continue;
        }

        const merged = [];
        for (const t of tokens) {
            const prev = merged.length > 0 ? merged[merged.length - 1] : undefined;
            if (prev && prev.highlightType === t.highlightType) {
                prev.codeContent += t.codeContent;
            } else {
                merged.push({ ...t });
            }
        }

        if (merged.length > 0) {
            merged[merged.length - 1].codeContent += nl;
        }
        blocks.push(...merged);
    }

    return blocks;
};
exports.tokenizeCode = tokenizeCode;

// ========== BUILD CONTEXT INFO ==========
const buildRichContextInfo = (quoted) => {
    const ctxInfo = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" },
        forwardOrigin: 4,
    };

    if (quoted && quoted.key) {
        ctxInfo.stanzaId = quoted.key.id;
        ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid;
        ctxInfo.quotedMessage = quoted.message;
    }

    return ctxInfo;
};

const botMetadataSignature = () => {
    const signature = new Uint8Array(64);
    (0, crypto_1.getRandomValues)(signature);
    return signature;
};

const botMetadataCertificate = (length = 700) => {
    const certificate = new Uint8Array(length);
    certificate[0] = 48;
    certificate[1] = 130;
    (0, crypto_1.getRandomValues)(certificate.subarray(2));
    return certificate;
};

const buildBotForwardedMessage = (submessages, contextInfo, unifiedResponse) => {
    const richResponse = {
        messageType: 1,
        submessages,
        contextInfo,
    };

    if (unifiedResponse) {
        richResponse.unifiedResponse = unifiedResponse;
    }

    return {
        messageContextInfo: {
            botMetadata: {
                pluginMetadata: {},
                verificationMetadata: {
                    proofs: [
                        {
                            certificateChain: [
                                botMetadataCertificate(684),
                                botMetadataCertificate(892),
                            ],
                            version: 1,
                            useCase: 1,
                            signature: botMetadataSignature(),
                        },
                    ],
                },
                botRenderingConfigMetadata: Defaults_1.BOT_RENDERING_CONFIG_METADATA,
            },
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: richResponse,
            },
        },
    };
};

// ========== GENERATE TABLE ==========
const generateTableContent = (title, headers, rows, quoted, options = {}) => {
    const { footer, headerText } = options;
    const tableRows = [
        { items: headers, isHeading: true },
        ...rows.map((row) => ({ items: row.map(String) })),
    ];

    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    submessages.push({
        messageType: 4,
        tableMetadata: { title, rows: tableRows },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }

    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateTableContent = generateTableContent;

// ========== GENERATE LIST ==========
const generateListContent = (title, items, quoted, options = {}) => {
    const { footer, headerText } = options;
    const tableRows = items.map((item) => ({
        items: Array.isArray(item) ? item.map(String) : [String(item)],
    }));

    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    submessages.push({
        messageType: 4,
        tableMetadata: { title, rows: tableRows },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }

    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateListContent = generateListContent;

// ========== GENERATE CODE BLOCK ==========
const generateCodeBlockContent = (code, quoted, options = {}) => {
    const { title, footer, language = "javascript" } = options;
    const codeObj = typeof code === 'string' ? { code } : code;
    const codeStr = codeObj.code || code;
    const lang = codeObj.language || language;

    const submessages = [];
    if (title) {
        submessages.push({ messageType: 2, messageText: title });
    }
    submessages.push({
        messageType: 5,
        codeMetadata: {
            codeLanguage: lang,
            codeBlocks: (0, exports.tokenizeCode)(codeStr, lang),
        },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }

    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateCodeBlockContent = generateCodeBlockContent;

// ========== GENERATE LATEX ==========
const generateLatexContent = (quoted, options) => {
    const { text, expressions, headerText, footer } = options;

    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }

    const latexExpressions = expressions.map((expr) => {
        const entry = {
            latexExpression: expr.latexExpression,
            url: expr.url,
            width: expr.width,
            height: expr.height,
        };
        if (expr.fontHeight !== undefined) entry.fontHeight = expr.fontHeight;
        if (expr.imageTopPadding !== undefined) entry.imageTopPadding = expr.imageTopPadding;
        if (expr.imageLeadingPadding !== undefined) entry.imageLeadingPadding = expr.imageLeadingPadding;
        if (expr.imageBottomPadding !== undefined) entry.imageBottomPadding = expr.imageBottomPadding;
        if (expr.imageTrailingPadding !== undefined) entry.imageTrailingPadding = expr.imageTrailingPadding;
        return entry;
    });

    submessages.push({
        messageType: 8,
        latexMetadata: {
            text: text || "",
            expressions: latexExpressions,
        },
    });

    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }

    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateLatexContent = generateLatexContent;

// ========== GENERATE LATEX IMAGE ==========
const generateLatexImageContent = async (quoted, options, uploadFn, renderLatexToPng) => {
    const { text, expressions, headerText, footer } = options;

    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }

    const latexExpressions = await Promise.all(
        expressions.map(async (expr) => {
            const { buffer, width, height } = await renderLatexToPng(expr.latexExpression);
            const uploadResult = await uploadFn(buffer, "image");
            const imageUrl = uploadResult.url || uploadResult.directPath;
            return {
                latexExpression: expr.latexExpression,
                url: imageUrl,
                width,
                height,
            };
        })
    );

    submessages.push({
        messageType: 8,
        latexMetadata: {
            text: text || "",
            expressions: latexExpressions,
        },
    });

    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }

    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateLatexImageContent = generateLatexImageContent;

// ========== GENERATE LATEX INLINE IMAGE ==========
const generateLatexInlineImageContent = async (quoted, options, uploadFn, renderLatexToPng) => {
    const { text, expressions, headerText, footer } = options;

    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    if (text) {
        submessages.push({ messageType: 2, messageText: text });
    }

    for (const expr of expressions) {
        const { buffer, width, height } = await renderLatexToPng(expr.latexExpression);
        const uploadResult = await uploadFn(buffer, "image");
        const imageUrl = uploadResult.url || uploadResult.directPath;
        submessages.push({
            messageType: 3,
            imageMetadata: {
                imageUrl: {
                    imagePreviewUrl: imageUrl,
                    imageHighResUrl: imageUrl,
                },
                imageText: expr.latexExpression,
                alignment: 2,
            },
        });
    }

    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }

    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateLatexInlineImageContent = generateLatexInlineImageContent;

// ========== CAPTURE UNIFIED RESPONSE ==========
const captureUnifiedResponse = (msg) => {
    const botFwd = msg && msg.botForwardedMessage && msg.botForwardedMessage.message;
    if (!botFwd) return null;
    const rich = botFwd.richResponseMessage;
    if (!rich || !rich.unifiedResponse || !rich.unifiedResponse.data) return null;
    return {
        unifiedResponse: { data: rich.unifiedResponse.data },
        submessages: rich.submessages || [],
        contextInfo: rich.contextInfo || {},
    };
};
exports.captureUnifiedResponse = captureUnifiedResponse;

// ========== GENERATE UNIFIED RESPONSE ==========
const generateUnifiedResponseContent = (quoted, captured) => {
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(
            captured.submessages,
            ctxInfo,
            captured.unifiedResponse
        ),
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateUnifiedResponseContent = generateUnifiedResponseContent;

// ========== GENERATE RICH MESSAGE ==========
const generateRichMessageContent = (submessages, quoted) => {
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateRichMessageContent = generateRichMessageContent;

// ========== TOKENIZE CODE V2 ==========
const HIGHLIGHT_TYPE_MAP = {
    0: "DEFAULT",
    1: "KEYWORD",
    2: "METHOD",
    3: "STR",
    4: "NUMBER",
    5: "COMMENT",
};

const tokenizeCodeV2 = (code, language = "javascript") => {
    const keywords = exports.LANGUAGE_KEYWORDS[language] || exports.JS_KEYWORDS;
    const tokens = [];
    let i = 0;
    const n = code.length;

    const push = (codeContent, highlightType) => {
        if (!codeContent) return;
        const last = tokens[tokens.length - 1];
        if (last && last.highlightType === highlightType) {
            last.codeContent += codeContent;
        } else {
            tokens.push({ codeContent, highlightType });
        }
    };

    const isWordStart = (c) => /[a-zA-Z_$]/.test(c);
    const isWord = (c) => /[a-zA-Z0-9_$]/.test(c);
    const isNum = (c) => /[0-9]/.test(c);

    while (i < n) {
        const c = code[i];

        if (c === "\n" || c === "\t" || c === " " || /\s/.test(c)) {
            let s = i;
            while (i < n && /\s/.test(code[i])) i++;
            push(code.slice(s, i), 0);
            continue;
        }

        if (c === "/" && code[i + 1] === "/") {
            let s = i;
            i += 2;
            while (i < n && code[i] !== "\n") i++;
            push(code.slice(s, i), 5);
            continue;
        }

        if (c === "/" && code[i + 1] === "*") {
            let s = i;
            i += 2;
            while (i < n - 1 && !(code[i] === "*" && code[i + 1] === "/")) i++;
            i += 2;
            push(code.slice(s, i), 5);
            continue;
        }

        if (c === "#" && (language === "python" || language === "py" || language === "bash" ||
            language === "sh" || language === "shell" || language === "lua")) {
            let s = i;
            i++;
            while (i < n && code[i] !== "\n") i++;
            push(code.slice(s, i), 5);
            continue;
        }

        if (c === '"' || c === "'" || c === "`") {
            let s = i;
            const q = c;
            i++;
            while (i < n) {
                if (code[i] === "\\" && i + 1 < n) {
                    i += 2;
                } else if (code[i] === q) {
                    i++;
                    break;
                } else i++;
            }
            push(code.slice(s, i), 3);
            continue;
        }

        if (isNum(c)) {
            let s = i;
            while (i < n && /[0-9.xXa-fA-FeEbBoO_]/.test(code[i])) i++;
            push(code.slice(s, i), 4);
            continue;
        }

        if (isWordStart(c)) {
            let s = i;
            while (i < n && isWord(code[i])) i++;
            const word = code.slice(s, i);
            let type = 0;
            if (keywords.has(word)) {
                type = 1;
            } else {
                let j = i;
                while (j < n && /\s/.test(code[j])) j++;
                if (code[j] === "(") type = 2;
            }
            push(word, type);
            continue;
        }

        push(c, 0);
        i++;
    }

    return {
        codeBlock: tokens,
        unified_codeBlock: tokens.map((t) => ({
            content: t.codeContent,
            type: HIGHLIGHT_TYPE_MAP[t.highlightType] || "DEFAULT",
        })),
    };
};
exports.tokenizeCodeV2 = tokenizeCodeV2;

// ========== TABLE METADATA V2 ==========
// Supports 3 input shapes:
//   1. Object format (recommended): { title, headers: string[], rows: string[][], footer }
//   2. Nested array format: [ [headerCell, ...], [rowCell, ...], ... ] (first row = header)
//   3. Legacy delimited-string format: [ title, 'H1|H2', 'r1a|r1b', 'r2a|r2b' ]
const toTableMetadataV2 = (input) => {
    let title;
    let footer;
    let header;
    let parsedRows;
    if (input && typeof input === "object" && !Array.isArray(input)) {
        // ---- Object format: { title, headers, rows, footer } ----
        if (!Array.isArray(input.headers) || input.headers.length === 0) {
            throw new Error("Table object must include a non-empty 'headers' array");
        }
        if (!Array.isArray(input.rows)) {
            throw new Error("Table object must include a 'rows' array");
        }
        title = input.title;
        footer = input.footer;
        header = input.headers.map((h) => String(h !== null && h !== void 0 ? h : ""));
        parsedRows = input.rows.map((row) => (Array.isArray(row) ? row : [row]).map((c) => String(c !== null && c !== void 0 ? c : "")));
    }
    else {
        if (!Array.isArray(input) || input.length === 0) {
            throw new Error("Input must be a non-empty array");
        }
        if (Array.isArray(input[0])) {
            // ---- Nested array format: [header[], row1[], row2[], ...] ----
            const [headerRow, ...rest] = input;
            header = headerRow.map((c) => String(c !== null && c !== void 0 ? c : ""));
            parsedRows = rest.map((row) => row.map((c) => String(c !== null && c !== void 0 ? c : "")));
        }
        else {
            // ---- Legacy delimited-string format: [title, headerStr, ...rowStrings] ----
            const [legacyTitle, headerStr, ...rest] = input;
            title = legacyTitle;
            const splitCols = (str) => {
                if (typeof str !== "string")
                    return [];
                return str.includes("|")
                    ? str.split("|").map((s) => s.trim())
                    : str.split(",").map((s) => s.trim());
            };
            const splitRows = (str) => {
                if (typeof str !== "string")
                    return [];
                return str.split(";;").map((row) => splitCols(row));
            };
            header = splitCols(headerStr);
            parsedRows = rest.flatMap(splitRows);
        }
    }
    const maxLen = Math.max(header.length, ...parsedRows.map((r) => r.length), 1);
    const unified_rows = [
        {
            is_header: true,
            cells: [...header, ...Array(maxLen - header.length).fill("")],
        },
        ...parsedRows.map((cells) => ({
            is_header: false,
            cells: [...cells, ...Array(maxLen - cells.length).fill("")],
        })),
    ];
    const rows = unified_rows.map((r) => ({
        items: r.cells,
        ...(r.is_header ? { isHeading: true } : {}),
    }));
    return { title, footer, rows, unified_rows };
};

// ========== GENERATE TABLE V2 ==========
const generateTableContentV2 = (table, quoted, options = {}) => {
    const { unified_rows, title: tableTitle, footer: tableFooter } = toTableMetadataV2(table);
    const title = options.title ?? tableTitle;
    const footer = options.footer ?? tableFooter;
    const { headerText, text } = options;

    const sections = [];

    if (headerText || title) {
        const headingText = headerText || title;
        sections.push({
            view_model: {
                primitive: {
                    text: headingText,
                    __typename: "GenAIMarkdownTextUXPrimitive",
                },
                __typename: "GenAISingleLayoutViewModel",
            },
        });
    }

    if (text) {
        sections.push({
            view_model: {
                primitive: {
                    text,
                    __typename: "GenAIMarkdownTextUXPrimitive",
                },
                __typename: "GenAISingleLayoutViewModel",
            },
        });
    }

    sections.push({
        view_model: {
            primitive: {
                rows: unified_rows,
                __typename: "GenATableUXPrimitive",
            },
            __typename: "GenAISingleLayoutViewModel",
        },
    });

    if (footer) {
        sections.push({
            view_model: {
                primitive: {
                    text: footer,
                    __typename: "GenAIMarkdownTextUXPrimitive",
                },
                __typename: "GenAISingleLayoutViewModel",
            },
        });
    }

    const responseId = (0, crypto_1.randomUUID)();
    const unifiedData = {
        response_id: responseId,
        sections,
    };
    const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString("base64");

    const submessages = [];
    if (headerText || title) {
        submessages.push({ messageType: 2, messageText: headerText || title });
    }
    if (text) {
        submessages.push({ messageType: 2, messageText: text });
    }
    submessages.push({
        messageType: 4,
        tableMetadata: { title, rows: unified_rows },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }

    const ctxInfo = buildRichContextInfo(quoted);

    return {
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: base64Data }),
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateTableContentV2 = generateTableContentV2;

// ========== GENERATE CODE BLOCK V2 ==========
const generateCodeBlockContentV2 = (code, quoted, options = {}) => {
    const { title, footer, language = "javascript", text } = options;
    const codeObj = typeof code === 'string' ? { code } : code;
    const codeStr = codeObj.code || code;
    const lang = codeObj.language || language;

    const { unified_codeBlock } = (0, exports.tokenizeCodeV2)(codeStr, lang);

    const sections = [];

    if (text) {
        sections.push({
            view_model: {
                primitive: {
                    text,
                    __typename: "GenAIMarkdownTextUXPrimitive",
                },
                __typename: "GenAISingleLayoutViewModel",
            },
        });
    }

    sections.push({
        view_model: {
            primitive: {
                language: lang,
                code_blocks: unified_codeBlock,
                __typename: "GenAICodeUXPrimitive",
            },
            __typename: "GenAISingleLayoutViewModel",
        },
    });

    if (footer) {
        sections.push({
            view_model: {
                primitive: {
                    text: footer,
                    __typename: "GenAIMarkdownTextUXPrimitive",
                },
                __typename: "GenAISingleLayoutViewModel",
            },
        });
    }

    const responseId = (0, crypto_1.randomUUID)();
    const unifiedData = {
        response_id: responseId,
        sections,
    };
    const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString("base64");

    const submessages = [];
    if (text) {
        submessages.push({ messageType: 2, messageText: text });
    }
    submessages.push({
        messageType: 5,
        codeMetadata: {
            codeLanguage: lang,
            codeBlocks: (0, exports.tokenizeCode)(codeStr, lang),
        },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }

    const ctxInfo = buildRichContextInfo(quoted);

    return {
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: base64Data }),
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateCodeBlockContentV2 = generateCodeBlockContentV2;

// ========== GENERATE LINK ==========
const generateLinkContent = (text, links, quoted, options = {}) => {
    const {
        footer,
        botJid = "867051314767696@bot",
        forwardingScore = 3,
        citations = [],
        proofs = [],
    } = options;

    const submessages = [];
    const fullText = footer ? `${text}${footer}` : text;
    submessages.push({ messageType: 2, messageText: fullText });

    const sections = [];
    const inlineEntities = links.map((link, i) => {
        const url = typeof link === "string" ? link : link.url;
        const displayName = typeof link === "object" && link.displayName
            ? link.displayName
            : (citations[i] && citations[i].sourceTitle) || `Link ${i + 1}`;
        return {
            key: `IE_${i}`,
            metadata: {
                display_name: displayName,
                is_trusted: false,
                url,
                __typename: "GenAIInlineLinkItem",
            },
        };
    });

    sections.push({
        view_model: {
            primitive: {
                text,
                inline_entities: inlineEntities,
                __typename: "GenAIMarkdownTextUXPrimitive",
            },
            __typename: "GenAISingleLayoutViewModel",
        },
    });

    if (footer) {
        sections.push({
            view_model: {
                primitive: {
                    text: footer,
                    __typename: "GenAIMarkdownTextUXPrimitive",
                },
                __typename: "GenAISingleLayoutViewModel",
            },
        });
    }

    const responseId = (0, crypto_1.randomUUID)();
    const unifiedData = {
        response_id: responseId,
        sections,
    };
    const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString("base64");

    const ctxInfo = {
        forwardingScore,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid },
        forwardOrigin: 4,
        botMessageSharingInfo: {
            forwardScore: forwardingScore,
        },
    };

    if (quoted && quoted.key) {
        ctxInfo.stanzaId = quoted.key.id;
        ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid;
        ctxInfo.quotedMessage = quoted.message;
    }

    const messageContextInfo = {
        messageSecret: (0, crypto_1.randomBytes)(32),
        botMetadata: {
            pluginMetadata: {},
            verificationMetadata: {
                proofs: proofs.length > 0
                    ? proofs.map((p) => ({
                        version: p.version || 1,
                        useCase: p.useCase || 1,
                        signature: p.signature || botMetadataSignature(),
                        certificateChain: p.certificateChain || [botMetadataCertificate(684), botMetadataCertificate(892)],
                    }))
                    : [
                        {
                            certificateChain: [botMetadataCertificate(684), botMetadataCertificate(892)],
                            version: 1,
                            useCase: 1,
                            signature: botMetadataSignature(),
                        },
                    ],
            },
            botRenderingConfigMetadata: Defaults_1.BOT_RENDERING_CONFIG_METADATA,
        },
    };

    if (citations.length > 0) {
        messageContextInfo.botMetadata.richResponseSourcesMetadata = {
            sources: citations.map((c, i) => ({
                provider: 1,
                thumbnailCdnUrl: "",
                sourceProviderUrl: typeof links[i] === "string" ? links[i] : (links[i] && links[i].url) || "",
                sourceQuery: c.sourceQuery || "",
                faviconCdnUrl: c.faviconCdnUrl || "",
                citationNumber: c.citationNumber !== undefined ? c.citationNumber : i + 1,
                sourceTitle: c.sourceTitle || "",
            })),
        };
    }

    const content = {
        messageContextInfo,
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages,
                    unifiedResponse: { data: base64Data },
                    contextInfo: ctxInfo,
                },
            },
        },
    };

    return {
        message: content,
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateLinkContent = generateLinkContent;

// ========== GENERATE LINK V2 ==========
const generateLinkContentV2 = (text, links, quoted, options = {}) => {
    const { footer, searchEngine = "MAME" } = options;

    const submessages = [];
    const fullText = footer ? `${text}${footer}` : text;
    submessages.push({ messageType: 2, messageText: fullText });

    const sections = [];
    const inlineEntities = links.map((link, i) => {
        const url = typeof link === "string" ? link : link.url;
        const displayName = typeof link === "object" && link.displayName
            ? link.displayName
            : `Link ${i + 1}`;
        const sourceDisplayName = typeof link === "object" && link.sourceDisplayName
            ? link.sourceDisplayName
            : `Source ${i + 1}`;
        const sourceSubtitle = typeof link === "object" && link.sourceSubtitle
            ? link.sourceSubtitle
            : "";

        return {
            key: `IE_${i}`,
            metadata: {
                reference_id: i + 1,
                reference_url: url,
                reference_title: displayName,
                reference_display_name: displayName,
                sources: [
                    {
                        source_type: "THIRD_PARTY",
                        source_display_name: sourceDisplayName,
                        source_subtitle: sourceSubtitle,
                        source_url: url,
                    },
                ],
                __typename: "GenAISearchCitationItem",
            },
        };
    });

    sections.push({
        view_model: {
            primitive: {
                text,
                inline_entities: inlineEntities,
                __typename: "GenAIMarkdownTextUXPrimitive",
            },
            __typename: "GenAISingleLayoutViewModel",
        },
    });

    const searchSources = links.map((link, i) => {
        const url = typeof link === "string" ? link : link.url;
        const sourceDisplayName = typeof link === "object" && link.sourceDisplayName
            ? link.sourceDisplayName
            : `Source ${i + 1}`;
        const sourceSubtitle = typeof link === "object" && link.sourceSubtitle
            ? link.sourceSubtitle
            : "";

        return {
            source_type: "THIRD_PARTY",
            source_display_name: sourceDisplayName,
            source_subtitle: sourceSubtitle,
            source_url: url,
        };
    });

    sections.push({
        view_model: {
            primitive: {
                sources: searchSources,
                search_engine: searchEngine,
                __typename: "GenAISearchResultPrimitive",
            },
            __typename: "GenAISingleLayoutViewModel",
        },
    });

    if (footer) {
        sections.push({
            view_model: {
                primitive: {
                    text: footer,
                    __typename: "GenAIMarkdownTextUXPrimitive",
                },
                __typename: "GenAISingleLayoutViewModel",
            },
        });
    }

    const responseId = (0, crypto_1.randomUUID)();
    const unifiedData = {
        response_id: responseId,
        sections,
    };
    const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString("base64");

    const ctxInfo = buildRichContextInfo(quoted);

    return {
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: base64Data }),
        messageId: (0, generics_1.generateMessageIDV2)(),
    };
};
exports.generateLinkContentV2 = generateLinkContentV2;



// Legacy compatibility wrappers
exports.BOT_RENDERING_CONFIG_METADATA = Defaults_1.BOT_RENDERING_CONFIG_METADATA;
exports.generateRandomID = generateMessageIDV2;
exports.wrapToBotForwardedMessage = (richResponseMessage) => ({
    messageContextInfo: {
        botMetadata: {
            pluginMetadata: {},
            verificationMetadata: {
                proofs: [
                    {
                        certificateChain: [
                            botMetadataCertificate(684),
                            botMetadataCertificate(892)
                        ],
                        version: 1,
                        useCase: 1,
                        signature: botMetadataSignature()
                    }
                ]
            },
            botRenderingConfigMetadata: Defaults_1.BOT_RENDERING_CONFIG_METADATA
        }
    },
    botForwardedMessage: {
        message: { richResponseMessage }
    }
});
exports.prepareRichResponseMessage = (options = {}) => {
    if (options.table) {
        return exports.generateTableContentV2(options.table, null, options).message;
    }
    if (options.code) {
        return exports.generateCodeBlockContentV2(options.code, null, options).message;
    }
    return exports.generateRichMessageContent([], null, options).message;
};
