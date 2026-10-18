// Simple client-side include loader.
// Finds elements with data-include and replaces them with fetched HTML.
// Use absolute paths in data-include (e.g. /el/components/footer.html) so the placeholder is identical across pages.

document.addEventListener('DOMContentLoaded', () => {
  const includes = Array.from(document.querySelectorAll('[data-include]'));
  if (!includes.length) return;

  includes.forEach(async el => {
    try {
      const url = el.getAttribute('data-include');
      if (!url) return;
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      el.innerHTML = html;
      // Execute inline scripts in the included fragment, if any
      el.querySelectorAll('script').forEach(oldScript => {
        const s = document.createElement('script');
        if (oldScript.src) s.src = oldScript.src;
        else s.textContent = oldScript.textContent;
        // Copy async/defer attributes if present
        if (oldScript.defer) s.defer = true;
        if (oldScript.async) s.async = true;
        document.head.appendChild(s);
        if (s.src) s.addEventListener('load', () => s.remove());
      });
    } catch (err) {
      console.error('Include failed for', el.getAttribute('data-include'), err);
    }
  });
});