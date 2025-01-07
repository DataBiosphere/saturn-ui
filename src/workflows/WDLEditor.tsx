import Editor from '@monaco-editor/react';
import React from 'react';

/* The syntax highlighting is not exactly what is used to be with the addition
 * of the new editor. This ticket is a follow-up to update the syntax highlighting
 * to better resemble what we had using PrismJs: https://broadworkbench.atlassian.net/browse/WX-1838
 */
const wdlLanguage = {
  keywords: [
    'version',
    'call',
    'runtime',
    'task',
    'workflow',
    'if',
    'then',
    'else',
    'import',
    'as',
    'input',
    'output',
    'meta',
    'parameter_meta',
    'scatter',
    'struct',
    'object',
    'command',
    'true',
    'false',
  ],

  typeKeywords: ['Array', 'Boolean', 'File', 'Float', 'Int', 'Map', 'Object', 'String', 'Pair'],

  operators: ['=', '!', '*', '<', '>', '+', '-', '/', '%', '&&'],

  symbols: /[=><!~?:&|+\-*/^%]+/,

  // C# style strings
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  // The main tokenizer for our languages
  tokenizer: {
    root: [
      [/#.*/, 'comments'],
      [/(?:Array[\S]*|Boolean|File|Float|Int|Map|Object|String|Pair)\??\s+\w+/, 'declaration'],

      // identifiers and keywords
      [
        /[a-z_$][\w$]*/,
        {
          cases: {
            '@typeKeywords': 'keyword.type',
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        },
      ],
      [/[A-Z][\w$]*/, 'type.identifier'], // to show class names nicely

      // whitespace
      { include: '@whitespace' },

      // delimiters and operators
      [/[{}()[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
      [
        /@symbols/,
        {
          cases: {
            '@operators': 'operator',
            '@default': '',
          },
        },
      ],

      // @ annotations.
      // As an example, we emit a debugging log message on these tokens.
      // Note: message are supressed during the first load -- change some lines to see them.
      [/@\s*[a-zA-Z_$][\w$]*/, { token: 'annotation', log: 'annotation token: $0' }],

      // numbers
      [/^[+-]?(\d*\.\d+|\d+\.|\d+)$/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],

      // delimiter: after number because of .\d floats
      [/[;,.]/, 'delimiter'],

      // strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-teminated string
      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

      // characters
      [/'[^\\']'/, 'string'],
      [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
      [/'/, 'string.invalid'],

      [/\b(?:true|false)\b/, '@keyword.boolean'],
    ],

    comment: [[/#.*/, 'comment']],

    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/\/\*/, 'comment', '@comment'],
      // [/\/\/.*$/, 'comment'],
    ],
  },
};

const handleEditorWillMount = (monaco) => {
  // here is the monaco instance
  // do something before editor is mounted
  monaco.languages.register({
    id: 'wdl',
  });
  monaco.languages.setMonarchTokensProvider('wdl', wdlLanguage);
  monaco.editor.defineTheme('prismjs-likeTheme', {
    base: 'vs',
    inherit: false,
    rules: [
      {
        token: 'keyword',
        foreground: '#328fb9',
      },
      {
        token: 'keyword.type',
        foreground: '#63911f',
      },
      {
        token: 'identifier',
        foreground: '#d95c76',
      },
      {
        token: 'operator',
        foreground: '#c3a889',
      },
      {
        token: 'comments',
        foreground: '#90a4a9',
      },
      {
        token: 'number.float',
        foreground: '#9f115c',
      },
      {
        token: 'declaration',
        foreground: '#63911f',
      },
    ],
    colors: {},
  });
};

// A list of passable props can be found here: https://www.npmjs.com/package/@monaco-editor/react?activeTab=readme#props
export const WDLEditor = ({ wdl, ...props }) => {
  return (
    <div>
      <Editor
        height='300px'
        width='100%'
        language='wdl'
        value={wdl}
        theme='prismjs-likeTheme'
        beforeMount={handleEditorWillMount}
        className='wdl-editor'
        {...props}
      />
    </div>
  );
};
