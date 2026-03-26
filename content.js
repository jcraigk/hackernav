(function () {
  "use strict";

  // --- Parsing ---

  // Get all comment rows from the flat table
  function getCommentRows() {
    return Array.from(document.querySelectorAll("tr.athing.comtr"));
  }

  // Get the indent depth of a comment row (0 = top-level)
  // HN uses <td class="ind"><img width="N"> where N = depth * 40
  function getDepth(row) {
    const img = row.querySelector("td.ind img");
    if (!img) return 0;
    const width = parseInt(img.getAttribute("width"), 10);
    return isNaN(width) ? 0 : width / 40;
  }

  // Build a tree structure from the flat list of comment rows.
  // Each node: { row, depth, children: [], parent: null }
  function buildTree(rows) {
    const nodes = rows.map((row) => ({
      row,
      depth: getDepth(row),
      children: [],
      parent: null,
    }));

    // Walk through sequentially; use a stack to track ancestry
    const stack = []; // stack of nodes representing current path from root

    for (const node of nodes) {
      // Pop stack until we find the parent (last node at depth < current)
      while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
        stack.pop();
      }

      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.children.push(node);
        node.parent = parent;
      }

      stack.push(node);
    }

    // Return only top-level nodes
    return nodes.filter((n) => n.parent === null);
  }

  // Count all descendants recursively
  function countDescendants(node) {
    let direct = node.children.length;
    let total = direct;
    for (const child of node.children) {
      total += countDescendants(child);
    }
    return { direct, total };
  }

  // --- DOM manipulation ---

  // Create the chevron toggle element
  function createToggle(node, collapsed) {
    const span = document.createElement("span");
    span.className = "hn-toggle";
    span.textContent = collapsed ? "\u25B6" : "\u25BC"; // right-pointing or down-pointing triangle
    span.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleNode(node);
    });
    return span;
  }

  // Create the descendant count label
  function createDescCount(node) {
    const { direct, total } = countDescendants(node);
    if (total === 0) return null;

    const span = document.createElement("span");
    span.className = "hn-desc-count";
    if (direct === total) {
      span.textContent = "(" + total + (total === 1 ? " reply" : " replies") + ")";
    } else {
      span.textContent =
        "(" + direct + " direct, " + total + " total)";
    }
    return span;
  }

  // Inject toggle and count into a comment row's header
  function injectControls(node, collapsed) {
    const comhead = node.row.querySelector("span.comhead");
    if (!comhead) return;

    // Only add controls if this comment has children
    if (node.children.length === 0) return;

    const toggle = createToggle(node, collapsed);
    node._toggle = toggle;

    const descCount = createDescCount(node);
    node._descCount = descCount;

    // Insert toggle at the start of comhead
    comhead.insertBefore(toggle, comhead.firstChild);

    // Insert descendant count after the comhead content
    if (descCount) {
      comhead.appendChild(descCount);
    }
  }

  // Set visibility of direct children rows (and recursively hide their descendants)
  function setChildrenVisible(node, visible) {
    for (const child of node.children) {
      if (visible) {
        child.row.classList.remove("hn-hidden");
        // When showing children, they should appear collapsed (their own children hidden)
        child._collapsed = true;
        if (child._toggle) {
          child._toggle.textContent = "\u25B6";
        }
        // Ensure grandchildren are hidden
        setChildrenVisible(child, false);
      } else {
        child.row.classList.add("hn-hidden");
        // Also hide all descendants recursively
        setChildrenVisible(child, false);
      }
    }
  }

  // Toggle expand/collapse for a node
  function toggleNode(node) {
    const collapsed = node._collapsed;

    if (collapsed) {
      // Expand: show direct children (each starts collapsed)
      node._collapsed = false;
      node._toggle.textContent = "\u25BC";
      setChildrenVisible(node, true);
    } else {
      // Collapse: hide all descendants
      node._collapsed = true;
      node._toggle.textContent = "\u25B6";
      setChildrenVisible(node, false);
    }
  }

  // --- Initialization ---

  function init() {
    const rows = getCommentRows();
    if (rows.length === 0) return;

    const topLevel = buildTree(rows);

    // Walk all nodes and set up controls
    function walk(nodes, isTopLevel) {
      for (const node of nodes) {
        const collapsed = !isTopLevel; // top-level starts expanded? No — top-level starts collapsed too
        // Actually: top-level comments are visible, but their children are hidden.
        // So top-level nodes are "collapsed" (children hidden).
        node._collapsed = true;
        injectControls(node, true);

        // Hide all non-top-level rows initially
        if (!isTopLevel) {
          node.row.classList.add("hn-hidden");
        }

        // Recurse into children
        walk(node.children, false);
      }
    }

    walk(topLevel, true);
  }

  // Run when DOM is ready (content script runs at document_idle, but just in case)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
