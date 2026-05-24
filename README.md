# A-Town Hoops Website

Website for A-Town Hoops — a non-profit youth basketball organization in Arlington, Washington.

## Project Structure

```
atown-hoops/
├── index.html   ← All HTML: nav, pages (Home/About/Teams/Gallery/Contact), footer
├── style.css    ← All styles: design tokens, layout, components, responsive
├── main.js      ← Navigation, page switching, team tabs, contact form, mobile menu
└── README.md
```

## Running Locally

1. Open the folder in VS Code
2. Install the **Live Server** extension (by Ritwick Dey)
3. Right-click `index.html` → **Open with Live Server**
4. The site opens at `http://127.0.0.1:5500`

Changes to any file auto-reload in the browser.

## Pages

| Page    | Section in index.html         |
|---------|-------------------------------|
| Home    | `#page-home`                  |
| About   | `#page-about`                 |
| Teams   | `#page-teams`                 |
| Gallery | `#page-gallery`               |
| Contact | `#page-contact`               |

## Common Edits

### Update season wins / ticker
In `index.html`, search for `class="ticker-inner"` and edit the `ticker-item` spans.

### Add/update team info
Search for `panel-boys` or `panel-girls` in `index.html` and edit the `team-card` blocks.

### Update board members
Search for `board-grid` in `index.html`.

### Change colors
All colors are CSS variables at the top of `style.css`:
```css
:root {
  --navy:    #0D2340;
  --gold:    #C8A84B;
  --sand:    #FAF7F2;
  /* ... */
}
```

### Wire up the contact form
In `main.js`, find the `submitForm()` function and replace the placeholder with a real
form backend. Good free options:
- **Formspree** — https://formspree.io
- **EmailJS** — https://www.emailjs.com

### Add real photos to the Gallery
Replace each `.g-placeholder` block in `index.html` with an `<img>` tag:
```html
<img src="images/your-photo.jpg" alt="Description" style="width:100%; height:100%; object-fit:cover;" />
```

## Deploying to GitHub Pages

1. Push the project to a GitHub repository
2. Go to **Settings → Pages**
3. Set source branch to `main`, folder to `/ (root)`
4. GitHub will publish at `https://your-username.github.io/atown-hoops`
