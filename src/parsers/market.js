/**
 * Generic section-table extractor.
 * Falls back to the generic approach for pages without Tijori's specific structure.
 */
async function extractSectionTable(page, sectionId) {
  await page.evaluate((sectionId) => {
    try {
      if (window.jQuery) {
        window.jQuery(`#${sectionId} table.dataTable`).each(function () {
          try { window.jQuery(this).DataTable().page.len(-1).draw(false); } catch (_) {}
        });
      }
    } catch (_) {}
  }, sectionId);
  await page.waitForTimeout(400);

  return page.evaluate(({ sectionId }) => {
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
      const labelDiv = tr.querySelector('.nameofmetriccol');
      const firstCol = tr.querySelector('.firstcol, td:first-child');
      // Constituent stock rows use an <a> tag inside firstcol for the company name
      const label = labelDiv?.textContent.trim()
        ?? firstCol?.querySelector('a')?.textContent.trim()
        ?? firstCol?.textContent.trim();

      if (!label) return [];

      const unit = labelDiv?.dataset?.unit ?? null;
      const parentAttr = tr.getAttribute('parent');
      const depth = parentAttr !== null ? parseInt(parentAttr, 10) : null;

      const dataCells = tr.querySelectorAll('td.numericvalue, td.knowledge.numericvalue');
      let values;
      if (dataCells.length > 0) {
        values = Array.from(dataCells).map(td => {
          const raw = td.textContent.trim().replace(/\s+/g, ' ');
          return raw === '—' || raw === '-' || raw === '' ? null : raw;
        });
      } else {
        const allCells = Array.from(tr.querySelectorAll('td, th')).map(td => td.textContent.trim().replace(/\s+/g, ' '));
        values = allCells.slice(1);
      }

      const row = { metric: label };
      if (unit) row.unit = unit;
      if (!isNaN(depth)) row.depth = depth;

      values.forEach((val, i) => {
        const header = periodHeaders[i];
        if (header) row[header] = val;
      });

      return [row];
    });

    return { headers: ['metric', ...periodHeaders], rows };
  }, { sectionId });
}

export async function parseRawMaterials(page, tab) {
  return extractSectionTable(page, tab);
}

export async function parseMacroIndicators(page, tab) {
  return extractSectionTable(page, tab);
}

export async function parseMarkets(page, tab) {
  if (tab === 'niche') return parseNiche(page);
  if (tab === 'conglomerates') return parseConglomerates(page);
  return extractSectionTable(page, tab);
}

async function parseConglomerates(page) {
  await page.waitForTimeout(400);

  return page.evaluate(() => {
    const wrapper = document.getElementById('market__table__groups_wrapper');
    if (!wrapper) return { rows: [], headers: [], error: 'No #market__table__groups_wrapper section' };

    const rows = Array.from(wrapper.querySelectorAll('tbody tr')).flatMap(tr => {
      if (tr.getAttribute('parent') !== '1') return [];

      const nameDiv = tr.querySelector('.nameofmetriccol');
      const label = nameDiv?.childNodes[0]?.textContent?.trim()
        ?? nameDiv?.textContent.replace(/[+\-]/g, '').trim()
        ?? tr.querySelector('.firstcol')?.textContent.trim();

      if (!label) return [];

      return [{ conglomerate: label, tjiid: tr.getAttribute('tjiid') ?? null, myid: tr.getAttribute('myid') ?? null }];
    });

    return { headers: ['conglomerate', 'tjiid', 'myid'], rows };
  });
}

async function parseNiche(page) {
  await page.waitForTimeout(400);

  return page.evaluate(() => {
    const wrapper = document.querySelector('#market__table__niche_wrapper');
    if (!wrapper) return { rows: [], headers: [], error: 'No #market__table__niche_wrapper section' };

    // Period headers — take the first thead only (page has fixed + scrollable thead duplicates)
    const headWrapper = document.getElementById('market__table__niche_wrapper');
    const firstThead = headWrapper?.querySelector('thead');
    const headCells = Array.from(firstThead?.querySelectorAll('th, td') ?? []);
    const periodHeaders = headCells.map(th => th.textContent.trim()).filter(h => h.length > 0);

    const bodyTable = wrapper.querySelector('tbody');
    if (!bodyTable) return { rows: [], headers: periodHeaders };

    const rows = Array.from(bodyTable.querySelectorAll('tr')).flatMap(tr => {
      if (tr.getAttribute('parent') !== '1') return [];

      const nameDiv = tr.querySelector('.nameofmetriccol');
      // Strip the collapse icon text (+/-) from the label
      const label = nameDiv?.childNodes[0]?.textContent?.trim()
        ?? nameDiv?.textContent.replace(/[+\-]/g, '').trim()
        ?? tr.querySelector('.firstcol')?.textContent.trim();

      if (!label) return [];

      const tjiid = tr.getAttribute('tjiid') ?? null;
      const myid = tr.getAttribute('myid') ?? null;

      const dataCells = tr.querySelectorAll('td.numericvalue, td.knowledge.numericvalue');
      let values;
      if (dataCells.length > 0) {
        values = Array.from(dataCells).map(td => {
          const raw = td.textContent.trim().replace(/\s+/g, ' ');
          return raw === '—' || raw === '-' || raw === '' ? null : raw;
        });
      } else {
        const allCells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim().replace(/\s+/g, ' '));
        values = allCells.slice(1);
      }

      const row = { sector: label, tjiid, myid };
      values.forEach((val, i) => {
        const header = periodHeaders[i];
        if (header) row[header] = val;
      });

      return [row];
    });

    return { headers: ['sector', 'tjiid', 'myid', ...periodHeaders], rows };
  });
}
