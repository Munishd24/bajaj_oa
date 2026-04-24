const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Your details
const USER_ID = "yourname_ddmmyyyy";
const EMAIL_ID = "your@email.com";
const COLLEGE_ROLL = "yourrollnumber";

// Validation
function isValidEntry(entry) {
  if (typeof entry !== "string") return false;
  const cleaned = entry.replace(/\s+/g, ''); // remove spaces
  return /^[A-Z]->[A-Z]$/.test(cleaned);
}

// Core logic
function processData(data) {
  const invalid_entries = [];
  const duplicate_edges = [];
  const validEdges = [];
  const seenEdges = new Set();

  for (let entry of data) {
    const cleaned = typeof entry === "string" ? entry.replace(/\s+/g, '') : "";

    if (!isValidEntry(cleaned)) {
      invalid_entries.push(entry);
      continue;
    }

    if (seenEdges.has(cleaned)) {
      if (!duplicate_edges.includes(cleaned)) {
        duplicate_edges.push(cleaned);
      }
      continue;
    }

    seenEdges.add(cleaned);
    validEdges.push(cleaned);
  }

  const children = {};
  const parentCount = {};

  for (let edge of validEdges) {
    const [parent, child] = edge.split('->');

    if (parentCount[child] !== undefined) continue;

    parentCount[child] = parent;

    if (!children[parent]) children[parent] = [];
    children[parent].push(child);
  }

  const allNodes = new Set();
  for (let edge of validEdges) {
    const [p, c] = edge.split('->');
    allNodes.add(p);
    allNodes.add(c);
  }

  const childNodes = new Set(Object.keys(parentCount));
  const roots = [...allNodes].filter(n => !childNodes.has(n));

  function hasCycle(node, visited, stack) {
    visited.add(node);
    stack.add(node);

    for (let child of (children[node] || [])) {
      if (!visited.has(child)) {
        if (hasCycle(child, visited, stack)) return true;
      } else if (stack.has(child)) {
        return true;
      }
    }

    stack.delete(node);
    return false;
  }

  function buildTree(node, visited = new Set()) {
    if (visited.has(node)) return {};
    visited.add(node);

    const obj = {};
    for (let child of (children[node] || [])) {
      obj[child] = buildTree(child, new Set(visited));
    }
    return obj;
  }

  function getDepth(node) {
    const kids = children[node] || [];
    if (kids.length === 0) return 1;
    return 1 + Math.max(...kids.map(getDepth));
  }

  const hierarchies = [];

  for (let root of roots.sort()) {
    if (hasCycle(root, new Set(), new Set())) {
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      const tree = { [root]: buildTree(root) };
      const depth = getDepth(root);
      hierarchies.push({ root, tree, depth });
    }
  }

  const nonCyclic = hierarchies.filter(h => !h.has_cycle);
  const cyclic = hierarchies.filter(h => h.has_cycle);

  let largest_tree_root = "";
  if (nonCyclic.length > 0) {
    const sorted = nonCyclic.sort((a, b) =>
      b.depth - a.depth || a.root.localeCompare(b.root)
    );
    largest_tree_root = sorted[0].root;
  }

  return {
    invalid_entries,
    duplicate_edges,
    hierarchies,
    summary: {
      total_trees: nonCyclic.length,
      total_cycles: cyclic.length,
      largest_tree_root
    }
  };
}

// API route
app.post('/bfhl', (req, res) => {
  console.log("BFHL API HIT");

  if (!req.body || !Array.isArray(req.body.data)) {
    return res.status(400).json({ error: "data must be an array" });
  }

  const { data } = req.body;
  const result = processData(data);

  res.json({
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: COLLEGE_ROLL,
    ...result
  });
});

// Optional GET routes (for browser clarity)
app.get('/', (req, res) => {
  res.send("BFHL Backend running. Use POST /bfhl");
});

app.get('/bfhl', (req, res) => {
  res.json({
    message: "Use POST method",
    endpoint: "/bfhl"
  });
});

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});