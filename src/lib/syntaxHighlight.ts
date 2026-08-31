/**
 * Single-Pass Tokenizer Syntax Highlighting Engine for TS/JS, SQL, and JSON
 * Guarantees zero regex artifacts or broken HTML attributes by processing tokens sequentially in one pass.
 */

export function highlightCode(code: string, lang: 'ts' | 'sql' | 'json' | 'bash' = 'ts'): string {
	if (!code) return '';
	if (lang === 'json') return highlightJson(code);

	const keywords = new Set([
		'import', 'from', 'export', 'const', 'let', 'var', 'await', 'async',
		'function', 'return', 'default', 'if', 'else', 'new', 'type', 'interface',
		'try', 'catch', 'throw', 'SELECT', 'FROM', 'WHERE', 'UPDATE', 'INSERT',
		'INTO', 'VALUES', 'SET', 'DELETE'
	]);

	// Single-pass token regex: [1] comments, [2] strings, [3] numbers/booleans, [4] identifiers, [5] rest
	const tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`)|(\b\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b|\bundefined\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)|([^\s\w]+|\s+)/g;

	let html = '';
	let match: RegExpExecArray | null;

	const escape = (text: string) =>
		text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	while ((match = tokenRegex.exec(code)) !== null) {
		const [raw, comment, str, numBool, ident] = match;

		if (comment) {
			html += `<span class="text-zinc-500 italic">${escape(comment)}</span>`;
		} else if (str) {
			html += `<span class="text-emerald-300 font-normal">${escape(str)}</span>`;
		} else if (numBool) {
			html += `<span class="text-amber-300 font-mono">${escape(numBool)}</span>`;
		} else if (ident) {
			if (keywords.has(ident)) {
				html += `<span class="text-pink-400 font-semibold">${escape(ident)}</span>`;
			} else {
				// Check if followed by '(' (function call)
				const remaining = code.slice(tokenRegex.lastIndex).trimStart();
				if (remaining.startsWith('(')) {
					html += `<span class="text-sky-300 font-medium">${escape(ident)}</span>`;
				} else {
					html += escape(ident);
				}
			}
		} else {
			html += escape(raw);
		}
	}

	return html;
}

export function highlightJson(json: string | object): string {
	const rawStr = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
	if (!rawStr) return '';

	// Single-pass JSON Tokenizer: [1] Key, [2] String value, [3] Number/Boolean/Null, [4] Symbols/whitespace
	const jsonRegex = /("(?:\\.|[^"\\])*")(\s*:)?|(\b\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)|([{}[\],:]|\s+)/g;

	let html = '';
	let match: RegExpExecArray | null;

	const escape = (text: string) =>
		text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	while ((match = jsonRegex.exec(rawStr)) !== null) {
		const [raw, strVal, isKey, numBool] = match;

		if (strVal) {
			if (isKey) {
				html += `<span class="text-purple-300 font-medium">${escape(strVal)}</span>${escape(isKey)}`;
			} else {
				html += `<span class="text-emerald-300">${escape(strVal)}</span>`;
			}
		} else if (numBool) {
			html += `<span class="text-amber-300 font-mono">${escape(numBool)}</span>`;
		} else {
			html += escape(raw);
		}
	}

	return html;
}
