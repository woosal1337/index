import ts from "typescript";

export function commentRanges(file, source) {
  const ranges = new Map();
  if (/\.(?:[cm]?js|tsx?)$/.test(file)) {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      for (const pos of [node.pos, node.end]) {
        const comments = [
          ...(ts.getLeadingCommentRanges(source, pos) ?? []),
          ...(ts.getTrailingCommentRanges(source, pos) ?? []),
        ];
        for (const range of comments) ranges.set(range.pos, range.end);
      }
      for (const child of node.getChildren(tree)) visit(child);
    }
    visit(tree);
  } else if (file.endsWith(".css")) {
    for (const match of source.matchAll(/\/\*[\s\S]*?\*\//g)) {
      ranges.set(match.index, match.index + match[0].length);
    }
  } else if (/\.(?:sh|yml|yaml|conf)$/.test(file) || /(?:^|\/)Dockerfile$/.test(file)) {
    for (const match of source.matchAll(/^[ \t]*#(?!\!).*/gm)) {
      ranges.set(match.index, match.index + match[0].length);
    }
  }
  return [...ranges].sort(([a], [b]) => a - b).map(([pos, end]) => ({ pos, end }));
}
