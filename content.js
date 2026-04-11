(function () {
  "use strict";

  // --- Parsing ---

  var isNewcomments = /\/newcomments/.test(window.location.pathname);
  var ROW_SELECTOR = isNewcomments ? "tr.athing[id]" : "tr.athing.comtr";

  function getCommentRows() {
    return Array.from(document.querySelectorAll(ROW_SELECTOR));
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

  function styleQuotes(row) {
    var commtext = row.querySelector(".commtext");
    if (!commtext) return;

    var nodes = Array.from(commtext.childNodes);
    for (var i = 0; i < nodes.length; i++) {
      var child = nodes[i];

      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent.trimStart().startsWith(">")) {
          var quote = document.createElement("div");
          quote.className = "hn-quote";
          child.textContent = child.textContent.replace(/^\s*>\s?/, "");
          commtext.replaceChild(quote, child);
          quote.appendChild(child);
        }
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "P") {
        if (child.textContent.trimStart().startsWith(">")) {
          child.classList.add("hn-quote");
          var first = child.firstChild;
          while (first && first.nodeType !== Node.TEXT_NODE) {
            first = first.firstChild || first.nextSibling;
          }
          if (first && first.nodeType === Node.TEXT_NODE) {
            first.textContent = first.textContent.replace(/^>\s?/, "");
          }
        }
      }
    }
  }

  function injectControls(node) {
    const defaultTd = node.row.querySelector("td.default");
    if (!defaultTd) return;

    const comhead = node.row.querySelector("span.comhead");

    if (node.children.length > 0) {
      const sidebar = document.createElement("div");
      sidebar.className = "hn-sidebar";

      const toggle = createToggle(node, true);
      node._toggle = toggle;
      sidebar.appendChild(toggle);
      defaultTd.insertBefore(sidebar, defaultTd.firstChild);

      if (comhead) {
        const descCount = createDescCount(node);
        node._descCount = descCount;
        if (descCount) comhead.appendChild(descCount);
      }
    }

    if (!comhead) return;

    const votelinks = node.row.querySelector("td.votelinks");
    if (!votelinks) return;

    const upLink = votelinks.querySelector("a[id^='up_']");
    const downLink = votelinks.querySelector("a[id^='down_']");
    var upBtn = null;
    var downBtn = null;

    var voteGroup = document.createElement("span");
    voteGroup.className = "hn-vote-group";

    if (upLink) {
      upBtn = document.createElement("span");
      upBtn.className = "hn-vote-btn hn-upvote";
      upBtn.textContent = "\u25B2";
      upBtn.title = "upvote";
      upBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        upLink.click();
        upBtn.classList.toggle("hn-voted");
        if (downBtn) downBtn.classList.remove("hn-voted");
      });
      voteGroup.appendChild(upBtn);
    }

    if (downLink) {
      downBtn = document.createElement("span");
      downBtn.className = "hn-vote-btn hn-downvote";
      downBtn.textContent = "\u25BC";
      downBtn.title = "downvote";
      downBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        downLink.click();
        downBtn.classList.toggle("hn-voted");
        if (upBtn) upBtn.classList.remove("hn-voted");
      });
      voteGroup.appendChild(downBtn);
    }

    comhead.appendChild(voteGroup);

    if (upBtn || downBtn) {
      syncVoteState(node.row, upBtn, downBtn);

      new MutationObserver(() => syncVoteState(node.row, upBtn, downBtn)).observe(votelinks, {
        subtree: true,
        attributes: true,
        childList: true,
      });

      new MutationObserver(() => stripNavLinks(node.row)).observe(comhead, {
        childList: true,
        subtree: true,
      });
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
  var listingMode = false;
  var storyData = new WeakMap();

  function getVisibleRows() {
    if (listingMode) {
      return Array.from(document.querySelectorAll("tr.hn-story"));
    }
    return Array.from(document.querySelectorAll(ROW_SELECTOR + ":not(.hn-hidden)"));
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

  function walkUpAndCollapse(node) {
    var current = node;
    while (current) {
      if (!current.parent) {
        var visible = getVisibleRows();
        var idx = visible.indexOf(current.row);
        if (idx >= 0 && idx < visible.length - 1) {
          selectComment(visible[idx + 1]);
        } else {
          selectComment(visible[0]);
        }
        return;
      }

      var siblings = current.parent.children;
      var sibIdx = siblings.indexOf(current);
      if (sibIdx < siblings.length - 1) {
        selectComment(siblings[sibIdx + 1].row);
        return;
      }

      if (!current.parent._collapsed) {
        toggleNode(current.parent);
      }
      current = current.parent;
    }
  }

  function spaceNavigate() {
    if (!selectedRow || getVisibleRows().indexOf(selectedRow) === -1) {
      var visible = getVisibleRows();
      if (visible.length > 0) selectComment(visible[0]);
      return;
    }

    var node = rowToNode.get(selectedRow);
    if (!node) {
      navigate(1);
      return;
    }

    if (node.children.length > 0) {
      if (node._collapsed) toggleNode(node);
      selectComment(node.children[0].row);
      return;
    }

    walkUpAndCollapse(node);
  }

  function openStoryLink() {
    if (!selectedRow) return;
    var data = storyData.get(selectedRow);
    if (data && data.navUrl) {
      window.location.href = data.navUrl;
    } else if (data && data.storyUrl) {
      window.open(data.storyUrl, "_blank");
    }
  }

  function openCommentsLink() {
    if (!selectedRow) return;
    var data = storyData.get(selectedRow);
    if (data && data.navUrl) {
      window.location.href = data.navUrl;
    } else if (data && data.commentsUrl) {
      window.location.href = data.commentsUrl;
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
    } else if (listingMode) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        openStoryLink();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        openCommentsLink();
      } else if (e.key === " ") {
        e.preventDefault();
        navigate(1);
      }
    } else {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        toggleSelected();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        window.history.back();
      } else if (e.key === " ") {
        e.preventDefault();
        spaceNavigate();
      }
    }
  }

  // --- Listing page ---

  function initListing() {
    var storyRows = document.querySelectorAll("tr.athing");
    if (storyRows.length === 0) return;

    // Center story table with margins and add spacing between cards
    var storyTable = storyRows[0].closest("table");
    if (storyTable) {
      storyTable.style.width = "80%";
      storyTable.style.margin = "0 auto";
      storyTable.style.borderCollapse = "separate";
      storyTable.style.borderSpacing = "0 4px";
    }

    storyRows.forEach(function (row) {
      var subtextRow = row.nextElementSibling;

      // Hide subtext and spacer rows for all stories (even ones we skip)
      if (subtextRow) {
        subtextRow.style.display = "none";
        var spacerAfterSubtext = subtextRow.nextElementSibling;
        if (spacerAfterSubtext && spacerAfterSubtext.classList.contains("spacer")) {
          spacerAfterSubtext.style.display = "none";
        }
      }

      if (!subtextRow) return;
      var subtextTd = subtextRow.querySelector("td.subtext");
      if (!subtextTd) return;

      var titleline = row.querySelector("span.titleline");
      if (!titleline) return;
      var titleCell = titleline.closest("td");

      // Extract rank text and hide all non-title columns (rank, votelinks, etc.)
      var rankSpan = row.querySelector(".rank");
      var rankText = "";
      if (rankSpan) {
        rankText = rankSpan.textContent.replace(".", "").trim();
      }
      Array.from(row.cells).forEach(function (td) {
        if (td !== titleCell) td.style.display = "none";
      });

      // Remove domain text
      var sitebit = row.querySelector(".sitebit");
      if (sitebit) sitebit.remove();

      // Move subtext content into title cell
      var metaDiv = document.createElement("div");
      metaDiv.className = "hn-story-meta";
      while (subtextTd.firstChild) {
        metaDiv.appendChild(subtextTd.firstChild);
      }
      titleCell.appendChild(metaDiv);

      // Extract elements from subline before rebuilding
      var subline = metaDiv.querySelector(".subline");
      var score = metaDiv.querySelector(".score");
      var scoreText = "";
      if (score) {
        scoreText = score.textContent.replace(/\s*points?/, "");
      }

      var hnuser = subline && subline.querySelector(".hnuser");
      var age = subline && subline.querySelector(".age");

      // Collect special links before clearing
      var flagLink = null;
      var commentsLink = null;
      var commentsCount = "";

      if (subline) {
        subline.querySelectorAll("a").forEach(function (link) {
          var text = link.textContent.replace(/\u00a0/g, " ").trim();
          if (text === "flag" || text === "unflag") {
            flagLink = link;
          } else {
            var commentMatch = text.match(/^(\d+)\s+comments?$/);
            if (commentMatch) {
              commentsCount = commentMatch[1];
              commentsLink = link;
            } else if (text === "discuss") {
              commentsCount = "";
              commentsLink = link;
            }
          }
        });
      }

      // Build pills: [#1] [123] [45]
      var pills = document.createElement("span");
      pills.className = "hn-story-pills";
      if (rankText) {
        var rankPill = document.createElement("a");
        rankPill.className = "hn-pill hn-pill-rank";
        rankPill.textContent = "#" + rankText;
        rankPill.title = "rank " + rankText;
        if (commentsLink) rankPill.href = commentsLink.href;
        pills.appendChild(rankPill);
      }
      if (scoreText) {
        var scorePill = document.createElement("a");
        scorePill.className = "hn-pill hn-pill-direct";
        scorePill.textContent = scoreText;
        scorePill.title = scoreText + " points";
        if (commentsLink) scorePill.href = commentsLink.href;
        pills.appendChild(scorePill);
      }
      if (commentsLink) {
        var commentPill = document.createElement("a");
        commentPill.className = "hn-pill hn-pill-comments";
        commentPill.textContent = commentsCount || "0";
        commentPill.title = commentsCount ? commentsCount + " comments" : "discuss";
        commentPill.href = commentsLink.href;
        pills.appendChild(commentPill);
      }

      // Build action button group: [⚑ | ▲]
      var actionGroup = document.createElement("span");
      actionGroup.className = "hn-vote-group";

      if (flagLink) {
        var isFlagUndo = flagLink.textContent.trim() === "unflag";
        flagLink.textContent = "\u2691";
        flagLink.title = isFlagUndo ? "unflag" : "flag";
        flagLink.className = "hn-vote-btn hn-flag-btn";
        if (!isFlagUndo) {
          flagLink.addEventListener("click", function (e) {
            if (!confirm("Flag this story?")) {
              e.preventDefault();
            }
          });
        }
        actionGroup.appendChild(flagLink);
      }

      var votelinks = row.querySelector("td.votelinks");
      if (votelinks) {
        var upLink = votelinks.querySelector("a[id^='up_']");
        if (upLink) {
          var upBtn = document.createElement("span");
          upBtn.className = "hn-vote-btn hn-upvote";
          upBtn.textContent = "\u25B2";
          upBtn.title = "upvote";
          upBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var url = upLink.href;
            if (!url) return;
            fetch(url, { credentials: "include" })
              .then(function (res) {
                return res.text();
              })
              .then(function (html) {
                var doc = new DOMParser().parseFromString(html, "text/html");
                var updated = doc.getElementById(upLink.id);
                if (updated) upLink.href = updated.href;
              })
              .catch(function () {});
            upBtn.classList.toggle("hn-voted");
          });
          if (isVoted(upLink)) {
            upBtn.classList.add("hn-voted");
          }
          actionGroup.appendChild(upBtn);
        }
      }

      // Rebuild subline: username timestamp [pills] [⚑ | ▲]
      if (subline) {
        while (subline.firstChild) subline.removeChild(subline.firstChild);

        if (hnuser) {
          subline.appendChild(hnuser);
          subline.appendChild(document.createTextNode(" "));
        }
        if (age) {
          subline.appendChild(age);
        }
        if (pills.childElementCount > 0) {
          subline.appendChild(document.createTextNode(" "));
          subline.appendChild(pills);
        }
        if (actionGroup.childElementCount > 0) {
          subline.appendChild(document.createTextNode(" "));
          subline.appendChild(actionGroup);
        }
      }

      // Store story URLs for keyboard navigation
      var storyLink = titleline.querySelector("a");
      storyData.set(row, {
        storyUrl: storyLink ? storyLink.href : null,
        commentsUrl: commentsLink ? commentsLink.href : null,
      });

      row.classList.add("hn-story");
      titleCell.classList.add("hn-story-card");
      if (storyLink) {
        titleCell.style.cursor = "pointer";
        titleCell.addEventListener("click", function (e) {
          if (e.target.closest("a, .hn-vote-btn, .hn-vote-group, .hn-pill")) return;
          window.open(storyLink.href, "_blank");
        });
      }
    });

    // --- Pagination nav cards ---
    var currentPage = parseInt(new URLSearchParams(window.location.search).get("p"), 10) || 1;
    var moreLink = document.querySelector("a.morelink");
    var itemlist = moreLink && moreLink.closest("table");
    var tbody = itemlist && (itemlist.querySelector("tbody") || itemlist);

    function createNavRow(label, url) {
      var tr = document.createElement("tr");
      tr.className = "hn-story";
      var td = document.createElement("td");
      td.className = "hn-story-card hn-nav-card";
      td.colSpan = 3;
      td.textContent = label;
      td.style.cursor = "pointer";
      td.addEventListener("click", function () {
        window.location.href = url;
      });
      tr.appendChild(td);
      storyData.set(tr, { navUrl: url });
      return tr;
    }

    // "Next page" card — replaces the More link
    if (moreLink) {
      var nextUrl = moreLink.href;
      var nextRow = createNavRow("Page " + (currentPage + 1) + " \u2192", nextUrl);
      var moreTr = moreLink.closest("tr");
      moreTr.parentNode.insertBefore(nextRow, moreTr);
      moreTr.style.display = "none";
    }

    // "Previous page" card on pages > 1
    if (currentPage > 1) {
      var prevPage = currentPage - 1;
      var prevParams = new URLSearchParams(window.location.search);
      if (prevPage <= 1) {
        prevParams.delete("p");
      } else {
        prevParams.set("p", prevPage);
      }
      var prevQuery = prevParams.toString();
      var prevUrl = window.location.pathname + (prevQuery ? "?" + prevQuery : "");
      var prevRow = createNavRow("\u2190 Page " + prevPage, prevUrl);
      var firstStory = tbody && tbody.querySelector("tr.hn-story");
      if (firstStory) {
        var spacer = document.createElement("tr");
        spacer.className = "hn-nav-spacer";
        tbody.insertBefore(spacer, firstStory);
        tbody.insertBefore(prevRow, spacer);
      }
    }

    listingMode = true;
    document.addEventListener("keydown", handleKeydown);
  }

  // --- Initialization ---

  function initFlat(rows) {
    for (var i = 0; i < rows.length; i++) {
      var node = { row: rows[i], depth: 0, children: [], parent: null, _collapsed: true };
      rowToNode.set(rows[i], node);
      stripNavLinks(rows[i]);
      styleQuotes(rows[i]);
      injectControls(node);
    }
  }

  function initTree(rows) {
    const topLevel = buildTree(rows);

    function walk(nodes, isTopLevel) {
      for (const node of nodes) {
        node._collapsed = true;
        rowToNode.set(node.row, node);
        stripNavLinks(node.row);
        styleQuotes(node.row);
        injectControls(node);

        if (!isTopLevel) {
          node.row.classList.add("hn-hidden");
        }

        walk(node.children, false);
      }
    }

    walk(topLevel, true);
  }

  function initHeader() {
    var headerCell = document.querySelector('#hnmain td[bgcolor="#ff6600"]');
    if (!headerCell) return;

    headerCell.removeAttribute("bgcolor");
    headerCell.style.background = "transparent";
    headerCell.style.paddingTop = "4px";

    var headerTable = headerCell.querySelector("table");
    if (headerTable) {
      headerTable.style.width = "80%";
      headerTable.style.margin = "0 auto";
      headerTable.style.background = "#ff6600";
      headerTable.style.borderRadius = "6px";
    }

    var pagetopSpans = headerCell.querySelectorAll("span.pagetop");
    pagetopSpans.forEach(function (span) {
      span.style.whiteSpace = "nowrap";
      span.querySelectorAll("a").forEach(function (link) {
        var text = link.textContent.trim();
        if (text === "logout") {
          link.textContent = "\u23FB";
          link.title = "logout";
          link.classList.add("hn-header-logout");
          link.classList.add("hn-header-pill");
          return;
        }
        if (link.closest(".hnname")) return;
        if (link.id === "me") return;
        link.classList.add("hn-header-pill");
      });
    });

    var headerTextNodes = [];
    var walker = document.createTreeWalker(
      headerCell,
      NodeFilter.SHOW_TEXT,
      null,
    );
    var tn;
    while ((tn = walker.nextNode())) headerTextNodes.push(tn);

    headerTextNodes.forEach(function (n) {
      if (!n.textContent.includes("|")) return;
      n.textContent = n.textContent.replace(/\s*\|\s*/g, " ");
      if (n.textContent.trim() === "") n.remove();
    });

    var karmaSpan = headerCell.querySelector("span#karma");
    if (karmaSpan) {
      karmaSpan.classList.add("hn-karma-pill");
      karmaSpan.title = karmaSpan.textContent.trim() + " karma";
      var prev = karmaSpan.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE) {
        prev.textContent = prev.textContent.replace(/\s*\(\s*$/, " ");
      }
      var next = karmaSpan.nextSibling;
      if (next && next.nodeType === Node.TEXT_NODE) {
        next.textContent = next.textContent.replace(/^\s*\)\s*/, " ");
      }
    }
  }

  function init() {
    initHeader();
    const rows = getCommentRows();
    if (rows.length > 0) {
      var commentTable = rows[0].closest("table");
      if (commentTable) {
        commentTable.style.width = "80%";
        commentTable.style.margin = "0 auto";
      }
      var fatitem = document.querySelector("table.fatitem");
      if (fatitem) {
        fatitem.style.width = "80%";
        fatitem.style.margin = "0 auto";
      }
      if (isNewcomments) {
        initFlat(rows);
      } else {
        initTree(rows);
      }
      document.addEventListener("keydown", handleKeydown);
      return;
    }

    initListing();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
