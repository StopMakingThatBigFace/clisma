const vscode = require('vscode');
const { provideContextCompletions } = require('./lib/completion');
const { validateDocument } = require('./lib/diagnostics');

function activate(context) {
  const diagnosticsCollection = vscode.languages.createDiagnosticCollection('clisma');

  const provider = vscode.languages.registerCompletionItemProvider(
    [
      { language: 'clisma' },
      { scheme: 'file', pattern: '**/clisma.hcl' },
      { scheme: 'file', pattern: '**/*.clisma' },
    ],
    {
      provideCompletionItems(document, position) {
        return provideContextCompletions(document, position);
      },
    },
    '=',
    ' ',
    '{',
    '"',
  );

  context.subscriptions.push(provider, diagnosticsCollection);

  const validate = (document) => validateDocument(document, diagnosticsCollection);

  vscode.workspace.textDocuments.forEach(validate);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(validate),
    vscode.workspace.onDidChangeTextDocument((event) => validate(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnosticsCollection.delete(document.uri)),
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
