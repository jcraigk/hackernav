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
      total += countDescendants(child).total;
    }
    return { direct, total };
  }

  // --- DOM manipulation ---

  function createToggle(node, collapsed) {
    const el = document.createElement("div");
    el.className = "hn-toggle" + (collapsed ? "" : " hn-expanded");
    el.title = "Click to expand/collapse replies";
    el.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleNode(node);
    });
    return el;
  }

  // Create the descendant count label
  function createDescCount(node) {
    const { direct, total } = countDescendants(node);
    if (total === 0) return null;

    const wrapper = document.createElement("span");
    wrapper.className = "hn-desc-count";

    var directPill = document.createElement("span");
    directPill.className = "hn-pill hn-pill-direct";
    directPill.textContent = direct;
    directPill.title = direct + " direct " + (direct === 1 ? "reply" : "replies");
    wrapper.appendChild(directPill);

    if (total !== direct) {
      var totalPill = document.createElement("span");
      totalPill.className = "hn-pill hn-pill-total";
      totalPill.textContent = total;
      totalPill.title = total + " total " + (total === 1 ? "reply" : "replies");
      wrapper.appendChild(totalPill);
    }

    return wrapper;
  }

  function isVoted(link) {
    return link && link.href && link.href.includes("how=un");
  }

  function syncVoteState(row, upStrip, downStrip) {
    const votelinks = row.querySelector("td.votelinks");
    const comhead = row.querySelector("span.comhead");
    const hasUnvote =
      comhead &&
      Array.from(comhead.querySelectorAll("a")).some(function (a) {
        return a.textContent.trim() === "unvote";
      });

    if (upStrip) {
      const up = votelinks && votelinks.querySelector("a[id^='up_']");
      upStrip.classList.toggle("hn-voted", isVoted(up) || (hasUnvote && !downStrip));
    }
    if (downStrip) {
      const down = votelinks && votelinks.querySelector("a[id^='down_']");
      downStrip.classList.toggle("hn-voted", isVoted(down));
      if (hasUnvote && !downStrip.classList.contains("hn-voted") && upStrip) {
        upStrip.classList.add("hn-voted");
      }
    }
  }

  function stripNavLinks(row) {
    const comhead = row.querySelector("span.comhead");
    if (!comhead) return;

    const navTexts = new Set(["root", "parent", "prev", "next", "unvote", "undown"]);

    comhead.querySelectorAll("a").forEach(function (link) {
      if (!navTexts.has(link.textContent.trim())) return;

      var node = link.previousSibling;
      while (node && node.nodeType === Node.TEXT_NODE && node.textContent.trim() === "|") {
        var prev = node.previousSibling;
        node.remove();
        node = prev;
      }
      link.remove();
    });
  }

  function injectControls(node) {
    const defaultTd = node.row.querySelector("td.default");
    if (!defaultTd) return;

    const sidebar = document.createElement("div");
    sidebar.className = "hn-sidebar";

    if (node.children.length > 0) {
      const toggle = createToggle(node, true);
      node._toggle = toggle;
      sidebar.appendChild(toggle);

      const comhead = node.row.querySelector("span.comhead");
      if (comhead) {
        const descCount = createDescCount(node);
        node._descCount = descCount;
        if (descCount) comhead.appendChild(descCount);
      }
    }

    const votelinks = node.row.querySelector("td.votelinks");
    if (votelinks) {
      const upLink = votelinks.querySelector("a[id^='up_']");
      const downLink = votelinks.querySelector("a[id^='down_']");

      if (upLink || downLink) {
        const voteCol = document.createElement("div");
        voteCol.className = "hn-vote-col";

        var upStrip = null;
        var downStrip = null;

        if (upLink) {
          upStrip = document.createElement("div");
          upStrip.className = "hn-vote-strip hn-upvote";
          upStrip.title = "upvote";
          upStrip.addEventListener("click", () => {
            upLink.click();
            upStrip.classList.toggle("hn-voted");
            if (downStrip) downStrip.classList.remove("hn-voted");
          });
          voteCol.appendChild(upStrip);
        }

        if (downLink) {
          downStrip = document.createElement("div");
          downStrip.className = "hn-vote-strip hn-downvote";
          downStrip.title = "downvote";
          downStrip.addEventListener("click", () => {
            downLink.click();
            downStrip.classList.toggle("hn-voted");
            if (upStrip) upStrip.classList.remove("hn-voted");
          });
          voteCol.appendChild(downStrip);
        }

        sidebar.appendChild(voteCol);

        syncVoteState(node.row, upStrip, downStrip);

        new MutationObserver(() => syncVoteState(node.row, upStrip, downStrip)).observe(votelinks, {
          subtree: true,
          attributes: true,
          childList: true,
        });

        const comhead = node.row.querySelector("span.comhead");
        if (comhead) {
          new MutationObserver(() => stripNavLinks(node.row)).observe(comhead, {
            childList: true,
            subtree: true,
          });
        }
      }
    }

    if (sidebar.children.length > 0) {
      defaultTd.insertBefore(sidebar, defaultTd.firstChild);
    }
  }

  // Set visibility of direct children rows (and recursively hide their descendants)
  function setChildrenVisible(node, visible) {
    for (const child of node.children) {
      if (visible) {
        child.row.classList.remove("hn-hidden");
        child._collapsed = true;
        if (child._toggle) {
          child._toggle.classList.remove("hn-expanded");
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
      node._collapsed = false;
      node._toggle.classList.add("hn-expanded");
      setChildrenVisible(node, true);
    } else {
      node._collapsed = true;
      node._toggle.classList.remove("hn-expanded");
      setChildrenVisible(node, false);
    }
  }

  // --- Keyboard navigation ---

  var rowToNode = new WeakMap();
  var selectedRow = null;

  function getVisibleRows() {
    return Array.from(document.querySelectorAll("tr.athing.comtr:not(.hn-hidden)"));
  }

  function selectComment(row) {
    if (selectedRow) {
      selectedRow.classList.remove("hn-selected");
    }
    selectedRow = row;
    if (row) {
      row.classList.add("hn-selected");
      var rect = row.getBoundingClientRect();
      window.scrollBy({ top: rect.top - 200, behavior: "smooth" });
    }
  }

  function navigate(direction) {
    var visible = getVisibleRows();
    if (visible.length === 0) return;

    if (!selectedRow || visible.indexOf(selectedRow) === -1) {
      selectComment(direction === 1 ? visible[0] : visible[visible.length - 1]);
      return;
    }

    var idx = visible.indexOf(selectedRow);
    idx =
      direction === 1 ? (idx + 1) % visible.length : (idx - 1 + visible.length) % visible.length;
    selectComment(visible[idx]);
  }

  function toggleSelected() {
    if (!selectedRow) return;
    var node = rowToNode.get(selectedRow);
    if (node && node._toggle) {
      toggleNode(node);
    }
  }

  function handleKeydown(e) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      navigate(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigate(-1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      toggleSelected();
    }
  }

  // --- Initialization ---

  function init() {
    const rows = getCommentRows();
    if (rows.length === 0) return;

    const topLevel = buildTree(rows);

    function walk(nodes, isTopLevel) {
      for (const node of nodes) {
        node._collapsed = true;
        rowToNode.set(node.row, node);
        stripNavLinks(node.row);
        injectControls(node);

        if (!isTopLevel) {
          node.row.classList.add("hn-hidden");
        }

        walk(node.children, false);
      }
    }

    walk(topLevel, true);
    document.addEventListener("keydown", handleKeydown);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
