export async function parseOverview(page) {
  return page.evaluate(() => {
    const result = {};

    // 1. Extract inline company metadata JSON — the script tag whose entire content IS the JSON object
    const scripts = Array.from(document.querySelectorAll('script:not([src])'));
    for (const s of scripts) {
      const text = s.textContent.trim();
      if (text.includes('company_id') && text.startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          // Pull out useful top-level fields; skip large nested objects to keep result lean
          const { company, company_id, symbol, shortname, slug, ind_code, is_banking, mcap, pe } = parsed;
          Object.assign(result, { company, company_id, symbol, shortname, slug, ind_code, is_banking, mcap, pe });
          // Also include quick_look forensics summary if present
          if (parsed.quick_look) result.quick_look = parsed.quick_look;
        } catch { /* skip */ }
        break;
      }
    }

    // 2. Key financial ratios — use actual class names found on the page
    const ratios = {};
    document.querySelectorAll('.custom_ratio').forEach(el => {
      const label = el.querySelector('.custom_ratio__field_name')?.textContent?.trim();
      const value = el.querySelector('.custom_ratio__field_value')?.textContent?.trim()
        ?.replace(/\s+/g, ' ');
      if (label && value) {
        ratios[label] = value;
      }
    });
    if (Object.keys(ratios).length > 0) result.ratios = ratios;

    // 3. Forensics score
    const forensicsEl = document.querySelector('[class*="forensic"], [class*="score"]');
    if (forensicsEl) result.forensics_score = forensicsEl.textContent.trim().slice(0, 20);

    // 4. Page title as fallback company name
    if (!result.company) result.company = document.title.split('|')[0].trim();

    return result;
  });
}
