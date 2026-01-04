/* global window, document, fetch, DOMParser */
(function () {
  function getPageFromQuery() {
    var search = window.location.search || "";
    var m = search.match(/(?:\?|&)page=(\d+)/i);
    var page = m ? parseInt(m[1], 10) : 1;
    return isFinite(page) && page > 0 ? page : 1;
  }

  function setPageInQuery(page) {
    var newPage = String(page);
    var base = window.location.href.split("#")[0];
    base = base.split("?")[0];
    window.location.href = base + "?page=" + encodeURIComponent(newPage);
  }

  function parseSortKey(filename) {
    var base = String(filename || "").replace(/\.html$/i, "");
    var m = base.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return { major: -1, minor: -1, raw: base };
    return { major: parseInt(m[1], 10), minor: m[2] ? parseInt(m[2], 10) : 0, raw: base };
  }

  function compareByIdDesc(a, b) {
    var ka = parseSortKey(a);
    var kb = parseSortKey(b);
    if (ka.major !== kb.major) return kb.major - ka.major;
    if (ka.minor !== kb.minor) return kb.minor - ka.minor;
    return kb.raw.localeCompare(ka.raw);
  }

  function createEl(tag, attrs, text) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] === null || attrs[k] === undefined) return;
        el.setAttribute(k, String(attrs[k]));
      });
    }
    if (text !== null && text !== undefined) el.textContent = String(text);
    return el;
  }

  function renderPager(pager, page, pageCount, onGo) {
    if (!pager) return;
    pager.innerHTML = "";
    if (pageCount <= 1) return;

    function addLink(label, targetPage, className) {
      var a = createEl("a", { href: "javascript:;", class: className || "" }, label);
      a.onclick = function () {
        onGo(targetPage);
      };
      pager.appendChild(a);
    }

    addLink("<< 上一页", Math.max(1, page - 1), "page-item page-link");

    var maxButtons = 7;
    var start = Math.max(1, page - Math.floor(maxButtons / 2));
    var end = Math.min(pageCount, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    if (start > 1) {
      addLink("1", 1, "page-num");
      if (start > 2) pager.appendChild(createEl("span", null, "…"));
    }

    for (var p = start; p <= end; p++) {
      addLink(String(p), p, p === page ? "page-num page-num-current" : "page-num");
    }

    if (end < pageCount) {
      if (end < pageCount - 1) pager.appendChild(createEl("span", null, "…"));
      addLink(String(pageCount), pageCount, "page-num");
    }

    addLink("下一页 >>", Math.min(pageCount, page + 1), "page-item page-link");
  }

  function loadText(url, onOk, onErr) {
    try {
      if (window.jQuery && window.jQuery.ajax) {
        window.jQuery
          .ajax({ url: url, dataType: "text", cache: false })
          .done(function (txt) {
            onOk(txt);
          })
          .fail(function () {
            onErr();
          });
        return;
      }
    } catch (e) {}

    try {
      if (window.fetch) {
        fetch(url, { cache: "no-cache" })
          .then(function (r) {
            if (!r.ok) throw new Error("Failed");
            return r.text();
          })
          .then(function (txt) {
            onOk(txt);
          })
          .catch(function () {
            onErr();
          });
        return;
      }
    } catch (e) {}

    onErr();
  }

  window.renderSitemapList = function renderSitemapList(options) {
    var sitemapUrl = options.sitemapUrl;
    var container = document.getElementById(options.containerId);
    var pager = options.pagerId ? document.getElementById(options.pagerId) : null;
    var pathPrefix = options.pathPrefix;
    var labelPrefix = options.labelPrefix || "";
    var perPage = options.perPage || 15;
    var titleMap = options.titleMap || {};
    var dateMap = options.dateMap || {};

    if (!sitemapUrl || !container || !pathPrefix) return;

    var currentPage = getPageFromQuery();

    loadText(
      sitemapUrl,
      function (xmlText) {
        var doc = new DOMParser().parseFromString(xmlText, "text/xml");
        var locNodes = doc.getElementsByTagName("loc");

        var files = [];
        var re = new RegExp("/" + pathPrefix + "/([^/]+)$", "i");
        for (var i = 0; i < locNodes.length; i++) {
          var loc = (locNodes[i].textContent || "").trim();
          var m = loc.match(re);
          if (!m) continue;
          var filename = m[1];
          if (!filename || filename === "") continue;
          if (!/\.html$/i.test(filename)) continue;
          files.push(filename);
        }

        var unique = {};
        var deduped = [];
        for (var j = 0; j < files.length; j++) {
          var f = files[j];
          if (unique[f]) continue;
          unique[f] = true;
          deduped.push(f);
        }
        files = deduped.sort(compareByIdDesc);

        var pageCount = Math.max(1, Math.ceil(files.length / perPage));
        if (currentPage > pageCount) currentPage = pageCount;

        var start = (currentPage - 1) * perPage;
        var pageFiles = files.slice(start, start + perPage);

        container.innerHTML = "";
        pageFiles.forEach(function (filename) {
          var title = titleMap[filename] || (labelPrefix + filename.replace(/\.html$/i, ""));
          var date = dateMap[filename] || "";

          var li = document.createElement("li");
          var span = createEl("span", null, date);
          var icon = createEl("i", { class: "icon-angle-right" });
          var a = createEl("a", { href: filename, title: title }, title);
          li.appendChild(span);
          li.appendChild(icon);
          li.appendChild(a);
          container.appendChild(li);
        });

        renderPager(pager, currentPage, pageCount, function (p) {
          setPageInQuery(p);
        });
      },
      function () {
        if (container) container.innerHTML = '<li><i class="icon-angle-right"></i> 暂无数据</li>';
      }
    );
  };
})();
