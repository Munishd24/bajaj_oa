const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();


app.use(cors());
app.use(express.json());


const USER_ID = "yourname_ddmmyyyy";
const EMAIL_ID = "your@email.com";
const COLLEGE_ROLL = "yourrollnumber";

function isValidEntry(entry) {
  if (typeof entry !== "string") return false;
  const trimmed = entry.trim();
  const regex = /^[A-Z]->[A-Z]$/;
  return regex.test(trimmed);
}

function processData(data) {
  const invalid_entries = [];
  const duplicate_edges = [];
  const validEdges = [];
  const seenEdges = new Set();

  // Step 1: Validate and deduplicate
  for (let entry of data) {
    const trimmed = typeof entry === "string" ? entry.trim() : "";
    if (!isValidEntry(trimmed)) {
      invalid_entries.push(entry);
      continue;
    }
    if (seenEdges.has(trimmed)) {
      if (!duplicate_edges.includes(trimmed)) {
        duplicate_edges.push(trimmed);
      }
      continue;
    }
    seenEdges.add(trimmed);
    validEdges.push(trimmed);
  }

  // Step 2: Build adjacency
  const children = {};
  const parentCount = {};

  for (let edge of validEdges) {
    const [parent, child] = edge.split('->');

    if (parentCount[child] !== undefined) continue;
    parentCount[child] = parent;

    if (!children[parent]) children[parent] = [];
    children[parent].push(child);
  }

  // Step 3: Collect nodes
  const allNodes = new Set();
  for (let edge of validEdges) {
    const [p, c] = edge.split('->');
    allNodes.add(p);
    allNodes.add(c);
  }

  // Step 4: Find roots
  const childNodes = new Set(Object.keys(parentCount));
  const roots = [...allNodes].filter(n => !childNodes.has(n));

  // Step 5: BFS connected nodes
  function getConnectedNodes(startNode) {
    const visited = new Set();
    const queue = [startNode];
    visited.add(startNode);

    while (queue.length) {
      const node = queue.shift();
      for (let child of (children[node] || [])) {
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
        }
      }
    }
    return visited;
  }

  // Step 6: Cycle detection
  function hasCycle(node, visited, recStack) {
    visited.add(node);
    recStack.add(node);

    for (let child of (children[node] || [])) {
      if (!visited.has(child)) {
        if (hasCycle(child, visited, recStack)) return true;
      } else if (recStack.has(child)) {
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  // Step 7: Build tree
  function buildTree(node, visited = new Set()) {
    if (visited.has(node)) return {};
    visited.add(node);

    const obj = {};
    for (let child of (children[node] || [])) {
      obj[child] = buildTree(child, new Set(visited));
    }
    return obj;
  }

  // Step 8: Depth
  function getDepth(node, visited = new Set()) {
    if (visited.has(node)) return 0;
    visited.add(node);

    const kids = children[node] || [];
    if (kids.length === 0) return 1;

    return 1 + Math.max(...kids.map(c => getDepth(c, new Set(visited))));
  }

  // Step 9: Build hierarchies
  const hierarchies = [];
  const processedNodes = new Set();

  const sortedRoots = roots.sort();

  for (let root of sortedRoots) {
    const connected = getConnectedNodes(root);
    connected.forEach(n => processedNodes.add(n));

    const cycleCheck = hasCycle(root, new Set(), new Set());

    if (cycleCheck) {
      hierarchies.push({
        root,
        tree: {},
        has_cycle: true
      });
    } else {
      const tree = { [root]: buildTree(root) };
      const depth = getDepth(root);

      hierarchies.push({ root, tree, depth });
    }
  }

  // Step 10: Handle pure cycles
  const remaining = [...allNodes].filter(n => !processedNodes.has(n)).sort();
  const visitedRemaining = new Set();

  for (let node of remaining) {
    if (visitedRemaining.has(node)) continue;

    const group = new Set();
    const q = [node];

    while (q.length) {
      const curr = q.shift();
      if (group.has(curr)) continue;

      group.add(curr);
      for (let child of (children[curr] || [])) q.push(child);
    }

    group.forEach(n => visitedRemaining.add(n));

    const root = [...group].sort()[0];

    hierarchies.push({
      root,
      tree: {},
      has_cycle: true
    });
  }

  // Summary
  const nonCyclic = hierarchies.filter(h => !h.has_cycle);
  const cyclic = hierarchies.filter(h => h.has_cycle);

  let largest_tree_root = "";

  if (nonCyclic.length > 0) {
    const sorted = nonCyclic.sort((a, b) => {
      if (b.depth !== a.depth) return b.depth - a.depth;
      return a.root.localeCompare(b.root);
    });
    largest_tree_root = sorted[0].root;
  }

  const summary = {
    total_trees: nonCyclic.length,
    total_cycles: cyclic.length,
    largest_tree_root
  };

  return { invalid_entries, duplicate_edges, hierarchies, summary };
}

//Route (FIXED VALIDATION)
app.post('/bfhl', (req, res) => {
  if (!req.body || !Array.isArray(req.body.data)) {
    return res.status(400).json({ error: "data must be an array" });
  }

  const { data } = req.body;
  const result = rocessData(data);

  return res.status(200).json({
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: COLLEGE_ROLL,
    hierarchies: result.hierarchies,
    invalid_entries: result.invalid_entries,
    duplicate_edges: result.duplicate_edges,
    summary: result.summary
  });
});

// Static filesp
app.use(express.static(path.join(__dirname, 'public')));

// Server
app.listen(3000, () => console.log('Server running on port 3000'));