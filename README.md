# gccaing.com — GCCAI website (V1)

A simple, fast website for Girl Child Care Advancement Initiative. No plugins, no database, nothing to install. Vercel rebuilds the site automatically every time you change a file on GitHub.

## Where things live

| To change… | Edit this |
|---|---|
| A blog post | `content/blog/` (one `.md` file per post) |
| A cause page | `content/causes/` |
| Photos in the gallery | `content/gallery/` (+ captions in `content/gallery/captions.json`) |
| Home, About, Get involved, Contact page text | `src/pages/*.html` |
| Email, phones, address, social links, form links, impact numbers | `site.config.json` |
| Colours and fonts | `public/css/style.css` |

You should not need to touch `build.js`.

## Add a blog post

1. On GitHub, open `content/blog/` → **Add file** → **Create new file**.
2. Name it with dashes and `.md` at the end, e.g. `day-of-the-girl-2026.md`. The name becomes the web address: `gccaing.com/blog/day-of-the-girl-2026/`.
3. Paste this at the top and fill it in:

```
---
title: Your post title
date: 2026-11-16
category: Opportunity
author: GCCAI Team
summary: One or two sentences that appear on the blog card.
image: /images/gallery/your-photo.jpg
imageAlt: Describe the photo for people who can't see it
---

Write your post here. Leave a blank line between paragraphs.

## A subheading

- a bullet point
- another one

**Bold words** and [a link](https://example.com).
```

4. Click **Commit changes**. The site updates in about a minute.

`image` and `imageAlt` are optional. Add `draft: true` to hide a post until it is ready. Newest `date` shows first.

## Add photos

1. Resize first: aim for about 1600 pixels wide and under 400 KB (use squoosh.app, or your phone's "medium" size option).
2. Name the file in lowercase with dashes, e.g. `illuminate-2019-seminar.jpg`.
3. On GitHub, open `content/gallery/` → **Add file** → **Upload files** → drag the photos in → **Commit changes**.
4. Optional: open `captions.json` and add a line for each photo:
   `"illuminate-2019-seminar.jpg": "Speakers at the first Illuminate seminar, 2019",`
   Every line except the last needs a comma at the end. Without a caption, the file name is used.

Photos of girls: publish only with consent, never with full names or anything that identifies where a girl lives.

## Turn on the forms

Paste the links into `site.config.json` under `"forms"`:

- `"volunteer"`: a Google Form link (Forms → Send → link icon → copy)
- `"partner"`: a Google Form link
- `"newsletter"`: your Brevo signup form link (Brevo → Contacts → Forms → Share → copy link)

Leave a link as `""` and the button opens an email to info@gccaing.com instead.

## Preview on your own computer (optional)

Install Node.js, then in this folder run `node build.js` and open `dist/index.html`, or run `npx serve dist`.
