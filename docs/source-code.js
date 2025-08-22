(function () {
  "use strict";

  // HighGuard.cloud inline injector
  // Purpose: Load the sibling index.html by reference and render it inside the current page (e.g., GHL custom code block)
  // Notes:
  // - Loads required fonts, Tailwind CDN, and style blocks from the source document
  // - Injects the body HTML into a dedicated container
  // - Replays inline <script> blocks from the source document so interactions work (menus, FAQ)
  // - Skips SEO/meta tags (not useful inside builders)

  var DEFAULT_INDEX_URL = "https://www.highguard.cloud/index.html"; // Fallback when currentScript has no src

  function computeIndexUrl() {
    try {
      var current = document.currentScript;
      if (current && current.src) {
        return new URL("index.html", current.src).href;
      }
    } catch (e) {}
    return DEFAULT_INDEX_URL;
  }

  function ensureHeadLink(attr) {
    var selector = Object.keys(attr)
      .map(function (k) { return k + '\\x3d"' + attr[k] + '"'; })
      .map(function (s) { return "[" + s + "]"; })
      .join("");
    if (!document.head.querySelector("link" + selector)) {
      var link = document.createElement("link");
      Object.keys(attr).forEach(function (k) { link.setAttribute(k, attr[k]); });
      document.head.appendChild(link);
    }
  }

  function ensureScriptSrc(src, id) {
    if (id && document.getElementById(id)) return;
    if (!id && document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement("script");
    s.src = src;
    if (id) s.id = id;
    s.defer = true;
    document.head.appendChild(s);
  }

  function appendStyle(cssText, key) {
    var id = key ? ("highguard-style-" + key) : null;
    if (id && document.getElementById(id)) return;
    var style = document.createElement("style");
    if (id) style.id = id;
    style.textContent = cssText;
    document.head.appendChild(style);
  }

  function importHeadAssets(srcDoc) {
    // Fonts
    srcDoc.head.querySelectorAll('link[rel="preconnect"], link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').forEach(function (lnk) {
      var attrs = {};
      for (var i = 0; i < lnk.attributes.length; i++) {
        var a = lnk.attributes[i];
        attrs[a.name] = a.value;
      }
      ensureHeadLink(attrs);
    });

    // Tailwind (single include)
    var tailwindScript = srcDoc.head.querySelector('script[src*="tailwindcss.com"]');
    if (tailwindScript) {
      ensureScriptSrc(tailwindScript.getAttribute("src"), "highguard-tailwind");
    }

    // Inline <style> blocks (palette, utilities)
    var styleIndex = 0;
    srcDoc.head.querySelectorAll("style").forEach(function (st) {
      appendStyle(st.textContent || "", String(styleIndex++));
    });
  }

  function injectBody(htmlDoc) {
    // Create a unique root to avoid collisions
    var container = document.createElement("div");
    container.id = "highguard-root";
    container.setAttribute("data-highguard", "1");
    container.style.all = "initial"; // help reduce CSS bleed; Tailwind will still style via class names
    container.style.display = "block";

    // A wrapper that restores normal inheritance for our content
    var wrapper = document.createElement("div");
    wrapper.style.all = "revert";
    wrapper.innerHTML = htmlDoc.body.innerHTML;

    container.appendChild(wrapper);

    // Insert just before the current <script> if available, otherwise append to body
    var cs = document.currentScript;
    if (cs && cs.parentNode) {
      cs.parentNode.insertBefore(container, cs);
    } else {
      document.body.appendChild(container);
    }

    return container;
  }

  function replayInlineScripts(srcDoc) {
    var scripts = srcDoc.querySelectorAll("script");
    scripts.forEach(function (s) {
      var src = s.getAttribute("src");
      if (src && /tailwindcss\.com/.test(src)) {
        // already ensured
        return;
      }
      if (src) {
        // External script from source doc (none expected besides Tailwind)
        ensureScriptSrc(new URL(src, computeIndexUrl()).href);
        return;
      }
      // Inline script: re-execute in current document context
      var inline = document.createElement("script");
      inline.type = s.type || "text/javascript";
      inline.textContent = s.textContent || "";
      document.body.appendChild(inline);
    });
  }

  function main() {
    var indexUrl = computeIndexUrl();
    fetch(indexUrl, { credentials: "omit" })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, "text/html");

        importHeadAssets(doc);
        injectBody(doc);
        replayInlineScripts(doc);
      })
      .catch(function (err) {
        console.error("HighGuard injector failed to load index.html:", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
