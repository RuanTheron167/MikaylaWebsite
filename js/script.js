const STORY_START = new Date(2026, 4, 23, 17, 0, 0);
const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

const formatNumber = (value) => String(value).padStart(2, "0");

// The header gains weight only after the page starts moving.
function updateHeader() {
  const header = document.querySelector("[data-header]");

  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 12);
}

// The counter intentionally clamps to zero before the relationship start date.
function updateCounter() {
  const counter = document.querySelector("[data-counter]");

  if (!counter) {
    return;
  }

  const elapsed = Math.max(0, Date.now() - STORY_START.getTime());
  const days = Math.floor(elapsed / DAY);
  const hours = Math.floor((elapsed % DAY) / HOUR);
  const minutes = Math.floor((elapsed % HOUR) / MINUTE);
  const seconds = Math.floor((elapsed % MINUTE) / SECOND);

  counter.querySelector('[data-unit="days"]').textContent = formatNumber(days);
  counter.querySelector('[data-unit="hours"]').textContent = formatNumber(hours);
  counter.querySelector('[data-unit="minutes"]').textContent = formatNumber(minutes);
  counter.querySelector('[data-unit="seconds"]').textContent = formatNumber(seconds);
}

// IntersectionObserver keeps reveal animations subtle and inexpensive.
function initRevealAnimations() {
  const revealItems = document.querySelectorAll(
    ".reveal-up, .reveal-fade, .reveal-blur"
  );

  if (!revealItems.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function formatReadableDate(value) {
  const date = new Date(`${value}T12:00:00`);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

// Build saved letters with textContent so user-written text remains safe.
function createLetterCard(letter) {
  const card = document.createElement("article");
  card.className = "letter-card is-visible";

  const time = document.createElement("time");
  time.dateTime = letter.date;
  time.textContent = formatReadableDate(letter.date);

  const title = document.createElement("h2");
  title.textContent = letter.title;

  const body = document.createElement("p");
  body.textContent = letter.body;

  card.append(time, title, body);
  return card;
}

// Letters are stored locally so this static site still feels personal.
function initLetters() {
  const modal = document.querySelector("[data-letter-modal]");
  const openButton = document.querySelector("[data-open-letter]");
  const closeButtons = document.querySelectorAll("[data-close-letter]");
  const form = document.querySelector("[data-letter-form]");
  const list = document.querySelector("[data-letters-list]");

  if (!modal || !openButton || !form || !list) {
    return;
  }

  let storedLetters = JSON.parse(localStorage.getItem("romanticLetters") || "[]");
  storedLetters.forEach((letter) => list.append(createLetterCard(letter)));

  const openModal = () => {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    form.elements.title.focus();
  };

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    form.reset();
  };

  openButton.addEventListener("click", openModal);
  closeButtons.forEach((button) => button.addEventListener("click", closeModal));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const letter = {
      date: formData.get("date"),
      title: formData.get("title").trim(),
      body: formData.get("body").trim(),
    };

    storedLetters = [letter, ...storedLetters];
    localStorage.setItem("romanticLetters", JSON.stringify(storedLetters));
    list.prepend(createLetterCard(letter));
    closeModal();
  });
}

function openPhotoDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Photo storage is not supported in this browser."));
      return;
    }

    const request = indexedDB.open("romanticPhotoLibrary", 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains("photos")) {
        database.createObjectStore("photos", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readPhotoStore(database, mode, callback) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("photos", mode);
    const store = transaction.objectStore("photos");
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createPhotoCard(photo, onRemove) {
  const card = document.createElement("figure");
  card.className = "photo-card reveal-fade is-visible";

  const image = document.createElement("img");
  image.src = URL.createObjectURL(photo.file);
  image.alt = photo.name;
  image.loading = "lazy";

  const caption = document.createElement("figcaption");
  const name = document.createElement("span");
  name.textContent = photo.name;

  const remove = document.createElement("button");
  remove.className = "photo-remove";
  remove.type = "button";
  remove.setAttribute("aria-label", `Remove ${photo.name}`);
  remove.textContent = "x";
  remove.addEventListener("click", () => onRemove(photo.id));

  caption.append(name, remove);
  card.append(image, caption);
  return card;
}

function createPhotoId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${Date.now()}-${window.crypto.randomUUID()}`;
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// The photo library stores original image files privately in this browser.
async function initPhotoLibrary() {
  const input = document.querySelector("[data-photo-input]");
  const grid = document.querySelector("[data-photo-grid]");
  const dropZone = document.querySelector("[data-drop-zone]");
  const clearButton = document.querySelector("[data-clear-photos]");
  const count = document.querySelector("[data-photo-count]");
  const empty = document.querySelector("[data-empty-library]");

  if (!input || !grid || !dropZone || !clearButton || !count || !empty) {
    return;
  }

  let database;

  try {
    database = await openPhotoDatabase();
  } catch (error) {
    dropZone.innerHTML = "<p>Photo storage is not available in this browser.</p>";
    clearButton.disabled = true;
    return;
  }

  const getPhotos = () =>
    readPhotoStore(database, "readonly", (store) => store.getAll());

  const savePhoto = (photo) =>
    readPhotoStore(database, "readwrite", (store) => store.put(photo));

  const deletePhoto = (id) =>
    readPhotoStore(database, "readwrite", (store) => store.delete(id));

  const clearPhotos = () =>
    readPhotoStore(database, "readwrite", (store) => store.clear());

  const renderPhotos = async () => {
    const photos = (await getPhotos()).sort((a, b) => b.createdAt - a.createdAt);

    grid.innerHTML = "";
    photos.forEach((photo) => grid.append(createPhotoCard(photo, removePhoto)));

    const total = photos.length;
    count.textContent = `${total} ${total === 1 ? "photo" : "photos"} saved`;
    empty.classList.toggle("is-visible-empty", total === 0);
  };

  const addPhotos = async (files) => {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));

    await Promise.all(
      images.map((file) =>
        savePhoto({
          id: createPhotoId(),
          name: file.name,
          file,
          createdAt: Date.now(),
        })
      )
    );

    input.value = "";
    await renderPhotos();
  };

  const removePhoto = async (id) => {
    await deletePhoto(id);
    await renderPhotos();
  };

  input.addEventListener("change", () => addPhotos(input.files));

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });

  dropZone.addEventListener("drop", (event) => addPhotos(event.dataTransfer.files));

  clearButton.addEventListener("click", async () => {
    await clearPhotos();
    await renderPhotos();
  });

  await renderPhotos();
}

function createMemoryImage(photo, className) {
  const image = document.createElement("img");
  image.className = className;
  image.src = `images/memories/${encodeURIComponent(photo.file)}`;
  image.alt = photo.alt || "A shared memory";
  image.loading = "lazy";
  return image;
}

function createMemoryCard(photo) {
  const figure = document.createElement("figure");
  figure.className = "memory-card";

  const image = createMemoryImage(photo, "");
  const captionText = photo.caption || photo.alt;

  figure.append(image);

  if (captionText) {
    const caption = document.createElement("figcaption");
    caption.textContent = captionText;
    figure.append(caption);
  }

  return figure;
}

// Static sites cannot list folders, so the memories page reads this manifest.
async function initMemoryGallery() {
  const featured = document.querySelector("[data-featured-memory]");
  const grid = document.querySelector("[data-memory-grid]");
  const gallery = document.querySelector("[data-memory-gallery]");

  if (!featured || !grid || !gallery) {
    return;
  }

  let photos = Array.isArray(window.MEMORY_PHOTOS) ? window.MEMORY_PHOTOS : [];

  if (!photos.length) {
    try {
      const response = await fetch("images/memories/manifest.json", {
        cache: "no-store",
      });
      photos = await response.json();
    } catch (error) {
      photos = [];
    }
  }

  if (!Array.isArray(photos) || photos.length === 0) {
    featured.innerHTML =
      '<div class="memory-empty"><p>Add photos to the memories folder to begin.</p></div>';
    grid.innerHTML = "";
    gallery.hidden = true;
    return;
  }

  const featuredIndex = Math.floor(Math.random() * photos.length);
  const featuredPhoto = photos[featuredIndex];
  const remainingPhotos = photos.filter((_, index) => index !== featuredIndex);

  featured.innerHTML = "";
  const featuredImage = createMemoryImage(featuredPhoto, "featured-memory-image");
  const featuredContent = document.createElement("div");
  featuredContent.className = "featured-memory-content";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Today's memory";

  const title = document.createElement("h2");
  title.textContent = featuredPhoto.caption || "A Moment With You";

  featuredContent.append(eyebrow, title);

  featured.append(featuredImage, featuredContent);
  grid.innerHTML = "";
  remainingPhotos.forEach((photo) => grid.append(createMemoryCard(photo)));
  gallery.hidden = remainingPhotos.length === 0;
}

window.addEventListener("scroll", updateHeader, { passive: true });

updateHeader();
updateCounter();
initRevealAnimations();
initLetters();
initPhotoLibrary();
initMemoryGallery();
setInterval(updateCounter, 1000);
