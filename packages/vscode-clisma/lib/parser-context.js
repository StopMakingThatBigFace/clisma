const {
  stripLineComments,
  stripStrings,
  countChar,
} = require('./text');

function currentBlock(stack) {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].kind === 'block') {
      return stack[i].name;
    }
  }
  return undefined;
}

function currentBlockContext(stack) {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].kind === 'block') {
      return stack[i];
    }
  }
  return undefined;
}

function getScopeStackAtPosition(document, position) {
  const stack = [];

  for (let i = 0; i <= position.line; i += 1) {
    const raw = document.lineAt(i).text;
    const relevant = i === position.line ? raw.slice(0, position.character) : raw;
    const line = stripStrings(stripLineComments(relevant));

    const blockMatch = line.match(/^\s*(env|variable|migrations|table|tls)(?:\s+"[^"]*")?\s*\{\s*$/);
    const mapMatch = line.match(/^\s*([a-zA-Z_][\w-]*)\s*=\s*\{\s*$/);

    if (blockMatch) {
      stack.push({ kind: 'block', name: blockMatch[1] });
    } else if (mapMatch) {
      stack.push({
        kind: 'map',
        mapName: mapMatch[1],
        parentBlock: currentBlock(stack),
      });
    }

    let closeCount = countChar(line, '}');
    while (closeCount > 0 && stack.length > 0) {
      stack.pop();
      closeCount -= 1;
    }
  }

  return stack;
}

module.exports = {
  currentBlock,
  currentBlockContext,
  getScopeStackAtPosition,
};
