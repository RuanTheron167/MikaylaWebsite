# Romantic Website

A complete static romantic website built with HTML5, modern CSS3, and vanilla JavaScript.

## Structure

```text
romantic-website/
|-- index.html
|-- letters.html
|-- photo-library.html
|-- css/
|   `-- style.css
|-- js/
|   `-- script.js
|-- images/
|   |-- hero.jpg
|   |-- memories/
|   `-- background.jpg
`-- README.md
```

## Features

- Cinematic fullscreen landing page
- Transparent navbar that becomes solid on scroll
- Live relationship counter starting from Saturday, 23 May 2026 at 17:00 local time
- Elegant letters page with three written letters
- Add Letter modal with browser local storage
- Photo library page with local browser photo storage
- Memories page layout with a random featured photo and gallery grid
- Mobile-first responsive layout
- Subtle reveal animations
- Google Fonts: Cormorant Garamond and Montserrat

## Run Locally

Open `index.html` directly in a browser, or serve the folder with any static server.

## Add Memories

Place memory photos inside `images/memories/`, then list them in `images/memories/memories.js`:

```js
window.MEMORY_PHOTOS = [
  { file: "photo-name.jpg", caption: "A day I never want to forget" }
];
```
