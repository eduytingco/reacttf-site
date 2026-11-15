#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'static', 'data', 'pages.csv');
const JSON_PATH = path.join(__dirname, '..', 'static', 'data', 'pages.json');

// ----------------------------------------------------------------------------
//  CSV format
// ----------------------------------------------------------------------------
//  slug, category, titleKey, intro, sectionHeading, paragraphs, list
//
//  - The first row for a slug must have category, titleKey, and intro filled in.
//  - Additional rows for the same slug are extra sections (leave category,
//    titleKey, and intro empty).
//  - paragraphs: multiple paragraphs separated by |
//  - list: multiple items separated by |  (leave blank for no list)
// ----------------------------------------------------------------------------

function parseCSV(text) {
  const rows = [];
  let i = 0;

  while (i < text.length) {
    const row = [];
    while (i < text.length) {
      let value = '';
      if (text[i] === '"') {
        i++;
        while (i < text.length) {
          if (text[i] === '"' && text[i + 1] === '"') {
            value += '"';
            i += 2;
          } else if (text[i] === '"') {
            i++;
            break;
          } else {
            value += text[i];
            i++;
          }
        }
      } else {
        while (i < text.length && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          value += text[i];
          i++;
        }
      }
      row.push(value);
      if (i < text.length && text[i] === ',') {
        i++;
      } else {
        break;
      }
    }
    if (text[i] === '\r') i++;
    if (text[i] === '\n') i++;
    rows.push(row);
  }

  return rows;
}

function convert() {
  const raw = fs.readFileSync(CSV_PATH, 'utf-8').trim();
  const rows = parseCSV(raw);
  const header = rows.shift();

  const colIndex = {};
  header.forEach(function (name, idx) { colIndex[name.trim()] = idx; });

  const pages = {};
  let currentSlug = null;

  for (const row of rows) {
    const slug = (row[colIndex['slug']] || '').trim();
    const category = (row[colIndex['category']] || '').trim();
    const titleKey = (row[colIndex['titleKey']] || '').trim();
    const intro = (row[colIndex['intro']] || '').trim();
    const heading = (row[colIndex['sectionHeading']] || '').trim();
    const paragraphs = (row[colIndex['paragraphs']] || '').trim();
    const list = (row[colIndex['list']] || '').trim();

    if (slug) currentSlug = slug;
    if (!currentSlug) continue;

    if (!pages[currentSlug]) {
      pages[currentSlug] = {
        category: category,
        titleKey: titleKey,
        intro: intro,
        sections: []
      };
    } else if (category || titleKey || intro) {
      if (category) pages[currentSlug].category = category;
      if (titleKey) pages[currentSlug].titleKey = titleKey;
      if (intro) pages[currentSlug].intro = intro;
    }

    if (heading) {
      const section = {
        heading: heading,
        paragraphs: paragraphs ? paragraphs.split('|').map(function (p) { return p.trim(); }) : []
      };
      if (list) {
        section.list = list.split('|').map(function (item) { return item.trim(); });
      }
      pages[currentSlug].sections.push(section);
    }
  }

  const output = {
    _comment: 'Auto-generated from pages.csv — do not edit by hand. Run: npm run csv2json',
    pages: pages
  };

  fs.writeFileSync(JSON_PATH, JSON.stringify(output, null, 2) + '\n');
  const count = Object.keys(pages).length;
  console.log('Wrote ' + count + ' page(s) to ' + path.relative(process.cwd(), JSON_PATH));
}

convert();
