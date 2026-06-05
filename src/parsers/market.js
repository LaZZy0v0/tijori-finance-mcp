/**
 * Generic section-table extractor.
 * Falls back to the generic approach for pages without Tijori's specific structure.
 */
async function extractSectionTable(page, sectionId) {
  return page.evaluate((sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) return { rows: [], headers: [], error: `No section #${sectionId}` };

    // --- Period headers from the thead ---
    const headTable = section.querySelector('.dt-scroll-head table, .dataTables_scrollHead table, thead');
    const allHeadCells = headTable
      ? Array.from(headTable.querySelectorAll('thead th, thead td'))
      : [];
    const periodHeaders = allHeadCells.map(th => th.textContent.trim()).filter(h => h.length > 0);

    // --- Body rows ---
    const bodyTable = section.querySelector('.dt-scroll-body table, .dataTables_scrollBody table') ??
      section.querySelector('table');
    if (!bodyTable) return { rows: [], headers: periodHeaders };

    const rows = Array.from(bodyTable.querySelectorAll('tbody tr')).flatMap(tr => {
      // --- Metric label ---
      // Prefer the dedicated nameofmetriccol div (Tijori macro/market pages)
      const labelDiv = tr.querySelector('.nameofmetriccol');
      const label = labelDiv
        ? labelDiv.textContent.trim()
        : tr.querySelector('.firstcol, td:first-child')?.textContent.trim();

      if (!label) return [];

      // --- Unit (from data-unit attribute on the label div) ---
      const unit = labelDiv?.dataset?.unit ?? null;

      // --- Hierarchy depth from parent attribute ---
      // parent="0" = top-level category header, parent="1"+ = actual metric rows
      const parentAttr = tr.getAttribute('parent');
      const depth = parentAttr !== null ? parseInt(parentAttr, 10) : null;

      // --- Data values: all numericvalue cells (including emptycol for alignment), skip yoy_graph ---
      // emptycol cells are empty-month placeholders — include them so indices align with period headers
      const dataCells = tr.querySelectorAll('td.numericvalue, td.knowledge.numericvalue');

      // If Tijori-specific cells found, use them; otherwise fall back to all td text
      let values;
      if (dataCells.length > 0) {
        values = Array.from(dataCells).map(td => {
          const raw = td.textContent.trim().replace(/\s+/g, ' ');
          // Convert em-dash placeholders to null for cleaner output
          return raw === '—' || raw === '-' || raw === '' ? null : raw;
        });
      } else {
        // Generic fallback for non-macro pages (raw materials, markets)
        const allCells = Array.from(tr.querySelectorAll('td, th')).map(td => td.textContent.trim().replace(/\s+/g, ' '));
        values = allCells.slice(1); // skip label column
      }

      const row = { metric: label };
      if (unit) row.unit = unit;
      if (depth !== null) row.depth = depth;

      values.forEach((val, i) => {
        const header = periodHeaders[i];
        if (header) row[header] = val;
      });

      return [row];
    });

    return { headers: ['metric', ...periodHeaders], rows };
  }, sectionId);
}

export async function parseRawMaterials(page, tab) {
  return extractSectionTable(page, tab);
}

export async function parseMacroIndicators(page, tab) {
  return extractSectionTable(page, tab);
}

export async function parseMarkets(page, tab) {
  return extractSectionTable(page, tab);
}
