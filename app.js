;(function() {
  "use strict";

  var PAGE_SIZE = 24;
  var FAV_KEY = "dine_chil_favorites";



  var PLANT_TYPES = [
    { key: "Grass", icon: "\u{1F33E}", label: "Grasses" },
    { key: "Shrub", icon: "\u{1FAB4}", label: "Shrubs" },
    { key: "Tree", icon: "\u{1F332}", label: "Trees" },
    { key: "Forb", icon: "\u{1F33C}", label: "Forbs" },
    { key: "Cactus", icon: "\u{1F335}", label: "Cacti" },
    { key: "Grasslike", icon: "\u{1F33F}", label: "Grasslike" }
  ];

  var AUDIO_FILES = {};
  var currentAudio = null;

  var D = [];
  var activeFilter = "all";
  var currentResults = [];
  var shownCount = 0;
  var favorites = loadFavorites();

  var $input = document.getElementById("search-input");
  var $clearBtn = document.getElementById("clear-btn");
  var $resultsHeader = document.getElementById("results-header");
  var $resultsCount = document.getElementById("results-count");
  var $grid = document.getElementById("plant-grid");
  var $loadMore = document.getElementById("load-more");
  var $browseGrid = document.getElementById("browse-type-grid");
  var $browseResults = document.getElementById("browse-results");
  var $browseList = document.getElementById("browse-list");
  var $browseMore = document.getElementById("browse-more");
  var $browseHeading = document.getElementById("browse-type-heading");
  var $favList = document.getElementById("fav-list");
  var $favEmpty = document.getElementById("fav-empty");
  var $featuredCard = document.getElementById("featured-card");
  var $overlay = document.getElementById("detail-overlay");

  // ===== LOAD DATA =====
  function loadPlants() {
    return fetch("plants.json")
      .then(function(res) {
        if (!res.ok) throw new Error("Failed: " + res.status);
        return res.json();
      })
      .then(function(plants) {
        D = plants.map(function(p) {
          return {
            english_name: p.english_name || "",
            navajo_name: p.navajo_name || "",
            scientific_name: p.scientific_name || "",
            aka: p.aka || "",
            plant_type: p.plant_type || "",
            habitat: p.habitat || "",
            growing_season: p.growing_season || "",
            special_considerations: p.special_considerations || "",
            description: p.description || "",
            photo_url: p.photo_url || "",
            photo_attr: p.photo_attr || "",
            photos: p.photos || [],
            single_photo_reason: p.single_photo_reason || "",
            _search: normalize(
              p.english_name + " " + p.navajo_name + " " +
              p.scientific_name + " " + (p.aka || "")
            )
          };
        });
      });
  }

  // ===== NAVIGATION =====
  function navigate(section) {
    document.querySelectorAll(".section").forEach(function(s) { s.classList.remove("active"); });
    document.getElementById("section-" + section).classList.add("active");
    document.querySelectorAll("[data-nav]").forEach(function(el) {
      el.classList.toggle("active", el.dataset.nav === section);
    });
    if (section === "favorites") renderFavorites();
    if (section === "search") $input.focus();
    window.scrollTo(0, 0);
  }

  document.querySelectorAll("[data-nav]").forEach(function(el) {
    el.addEventListener("click", function(e) {
      e.preventDefault();
      navigate(this.dataset.nav);
      var menu = document.getElementById("mobile-menu");
      if (menu) menu.classList.remove("open");
    });
  });

  var hamburger = document.getElementById("hamburger-btn");
  var mobileMenu = document.getElementById("mobile-menu");
  if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", function() {
      mobileMenu.classList.toggle("open");
    });
    document.addEventListener("click", function(e) {
      if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove("open");
      }
    });
  }

  // ===== NORMALIZE / ESCAPE =====
  function normalize(str) {
    return str.toLowerCase()
      .replace(/ł/g, "l").replace(/Ł/g, "l")
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ===== SEARCH =====
  function matchesType(entry) {
    if (activeFilter === "all") return true;
    return entry.plant_type.indexOf(activeFilter) !== -1;
  }

  function search(query) {
    var q = normalize(query);
    if (!q) return getAllFiltered();

    var words = q.split(/\s+/);
    var scored = [];

    for (var i = 0; i < D.length; i++) {
      if (!matchesType(D[i])) continue;
      var field = D[i]._search;
      var score = 0;

      if (field === q) score = 100;
      else if (field.indexOf(q) === 0) score = 80;
      else if (field.indexOf(" " + q) !== -1) score = 60;
      else if (field.indexOf(q) !== -1) score = 40;
      else {
        var allMatch = true;
        for (var w = 0; w < words.length; w++) {
          if (field.indexOf(words[w]) === -1) { allMatch = false; break; }
        }
        if (allMatch) score = 20;
      }

      if (score > 0) scored.push({ idx: i, score: score });
    }

    scored.sort(function(a, b) { return b.score - a.score || a.idx - b.idx; });
    return scored.map(function(s) { return s.idx; });
  }

  function getAllFiltered() {
    var results = [];
    for (var i = 0; i < D.length; i++) {
      if (matchesType(D[i])) results.push(i);
    }
    return results;
  }

  // ===== RENDER CARD GRID =====
  function renderGrid() {
    $grid.innerHTML = "";
    shownCount = 0;
    var toShow = currentResults.slice(0, PAGE_SIZE);
    shownCount = toShow.length;

    for (var i = 0; i < toShow.length; i++) {
      $grid.appendChild(createPlantCard(toShow[i]));
    }

    var isSearching = $input.value || activeFilter !== "all";
    if (isSearching) {
      $resultsCount.textContent = currentResults.length + " plant" + (currentResults.length !== 1 ? "s" : "");
      $resultsHeader.hidden = false;
    } else {
      $resultsHeader.hidden = true;
    }

    $loadMore.hidden = currentResults.length <= shownCount;
  }

  function createPlantCard(idx) {
    var p = D[idx];
    var card = document.createElement("div");
    card.className = "plant-card";

    var isFav = favorites.has(p.english_name);
    var navajoDisplay = p.navajo_name
      ? escapeHtml(p.navajo_name)
      : '<span class="plant-card-no-navajo">No Diné name recorded</span>';

    card.innerHTML =
      '<div class="plant-card-img-wrap">' +
        '<img class="plant-card-img" src="' + escapeHtml(p.photo_url) + '" alt="' + escapeHtml(p.english_name) + '" loading="lazy" onerror="this.style.display=\'none\'">' +
      '</div>' +
      '<button class="plant-card-fav' + (isFav ? ' saved' : '') + '" data-plant="' + escapeHtml(p.english_name) + '" aria-label="' + (isFav ? 'Remove from' : 'Save to') + ' favorites">' +
        (isFav ? '&#9829;' : '&#9825;') +
      '</button>' +
      '<div class="plant-card-body">' +
        '<div class="plant-card-navajo">' + navajoDisplay + '</div>' +
        '<div class="plant-card-english">' + escapeHtml(p.english_name) + '</div>' +
        '<div class="plant-card-scientific">' + escapeHtml(p.scientific_name) + '</div>' +
        '<div class="plant-card-badges">' +
          (p.plant_type ? '<span class="plant-card-badge">' + escapeHtml(p.plant_type) + '</span>' : '') +
          (p.growing_season ? '<span class="plant-card-badge season">' + escapeHtml(p.growing_season) + '</span>' : '') +
        '</div>' +
      '</div>';

    card.addEventListener("click", function(e) {
      if (e.target.closest(".plant-card-fav")) return;
      openDetail(idx);
    });

    card.querySelector(".plant-card-fav").addEventListener("click", function(e) {
      e.stopPropagation();
      toggleFavorite(p.english_name);
      var saved = favorites.has(p.english_name);
      this.classList.toggle("saved", saved);
      this.innerHTML = saved ? "&#9829;" : "&#9825;";
    });

    return card;
  }

  $loadMore.addEventListener("click", function() {
    var next = currentResults.slice(shownCount, shownCount + PAGE_SIZE);
    shownCount += next.length;
    for (var i = 0; i < next.length; i++) {
      $grid.appendChild(createPlantCard(next[i]));
    }
    $loadMore.hidden = currentResults.length <= shownCount;
  });

  // ===== SEARCH INPUT =====
  var searchTimer;
  $input.addEventListener("input", function() {
    clearTimeout(searchTimer);
    var val = this.value;
    $clearBtn.hidden = !val;

    if (!val && activeFilter === "all") {
      $featuredCard.style.display = "";
      currentResults = getAllFiltered();
      renderGrid();
      return;
    }

    $featuredCard.style.display = "none";
    searchTimer = setTimeout(function() {
      currentResults = search(val);
      renderGrid();
    }, 150);
  });

  $clearBtn.addEventListener("click", function() {
    $input.value = "";
    $clearBtn.hidden = true;
    if (activeFilter === "all") {
      $featuredCard.style.display = "";
    }
    currentResults = search("");
    renderGrid();
    $input.focus();
  });

  // ===== FILTER CHIPS =====
  document.querySelectorAll(".filter-chip").forEach(function(chip) {
    chip.addEventListener("click", function() {
      activeFilter = this.dataset.type;
      document.querySelectorAll(".filter-chip").forEach(function(c) { c.classList.remove("active"); });
      this.classList.add("active");

      if (activeFilter === "all" && !$input.value) {
        $featuredCard.style.display = "";
      } else {
        $featuredCard.style.display = "none";
      }

      currentResults = search($input.value);
      renderGrid();
    });
  });

  // ===== DETAIL MODAL =====
  var galleryPhotos = [];
  var galleryIndex = 0;
  var $detailImg = document.getElementById("detail-img");
  var $galleryPrev = document.getElementById("gallery-prev");
  var $galleryNext = document.getElementById("gallery-next");
  var $galleryDots = document.getElementById("gallery-dots");
  var $galleryCounter = document.getElementById("gallery-counter");

  function updateGallery() {
    var photo = galleryPhotos[galleryIndex];
    $detailImg.src = photo.url;
    $galleryCounter.textContent = (galleryIndex + 1) + " / " + galleryPhotos.length;

    var dots = $galleryDots.children;
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle("active", i === galleryIndex);
    }

    $galleryPrev.style.display = galleryPhotos.length > 1 ? "" : "none";
    $galleryNext.style.display = galleryPhotos.length > 1 ? "" : "none";
    $galleryCounter.style.display = galleryPhotos.length > 1 ? "" : "none";
    $galleryDots.style.display = galleryPhotos.length > 1 ? "" : "none";
  }

  function buildGalleryDots() {
    $galleryDots.innerHTML = "";
    for (var i = 0; i < galleryPhotos.length; i++) {
      var dot = document.createElement("button");
      dot.className = "gallery-dot" + (i === 0 ? " active" : "");
      dot.dataset.idx = i;
      dot.setAttribute("aria-label", "Photo " + (i + 1));
      dot.addEventListener("click", function() {
        galleryIndex = parseInt(this.dataset.idx);
        updateGallery();
      });
      $galleryDots.appendChild(dot);
    }
  }

  $galleryPrev.addEventListener("click", function(e) {
    e.stopPropagation();
    galleryIndex = (galleryIndex - 1 + galleryPhotos.length) % galleryPhotos.length;
    updateGallery();
  });

  $galleryNext.addEventListener("click", function(e) {
    e.stopPropagation();
    galleryIndex = (galleryIndex + 1) % galleryPhotos.length;
    updateGallery();
  });

  function openDetail(idx) {
    var p = D[idx];

    galleryPhotos = p.photos && p.photos.length > 0
      ? p.photos
      : [{ url: p.photo_url, attr: p.photo_attr || "" }];
    galleryIndex = 0;

    $detailImg.alt = p.english_name;
    buildGalleryDots();
    updateGallery();

    var $notice = document.getElementById("gallery-notice");
    if (p.single_photo_reason) {
      $notice.textContent = "Only 1 photo available — " + p.single_photo_reason;
      $notice.style.display = "";
    } else {
      $notice.style.display = "none";
    }

    document.getElementById("detail-type").textContent = p.plant_type;
    document.getElementById("detail-season").textContent = p.growing_season;
    var $navajo = document.getElementById("detail-navajo");
    var $audioBtn = document.getElementById("audio-btn");
    if (p.navajo_name) {
      $navajo.textContent = p.navajo_name;
      $navajo.className = "detail-navajo";
    } else {
      $navajo.textContent = "No Diné name recorded";
      $navajo.className = "detail-navajo detail-navajo-missing";
    }
    if (AUDIO_FILES[p.english_name]) {
      $audioBtn.hidden = false;
      $audioBtn.onclick = function() {
        if (currentAudio) { currentAudio.pause(); currentAudio = null; }
        currentAudio = new Audio(AUDIO_FILES[p.english_name]);
        $audioBtn.classList.add("playing");
        currentAudio.play();
        currentAudio.onended = function() { $audioBtn.classList.remove("playing"); currentAudio = null; };
        currentAudio.onerror = function() { $audioBtn.classList.remove("playing"); currentAudio = null; };
      };
    } else {
      $audioBtn.hidden = true;
      $audioBtn.onclick = null;
    }
    document.getElementById("detail-english").textContent = p.english_name;
    document.getElementById("detail-scientific").textContent = p.scientific_name;
    document.getElementById("detail-aka").textContent = p.aka ? "Also known as: " + p.aka : "";
    document.getElementById("detail-description").textContent = p.description;
    document.getElementById("detail-habitat").textContent = p.habitat;
    document.getElementById("detail-considerations").textContent = p.special_considerations;

    document.getElementById("detail-habitat-row").style.display = p.habitat ? "" : "none";
    document.getElementById("detail-considerations-row").style.display =
      (p.special_considerations && p.special_considerations !== "None") ? "" : "none";

    var $detailFav = document.getElementById("detail-fav");
    var isFav = favorites.has(p.english_name);
    $detailFav.className = "detail-fav-btn" + (isFav ? " saved" : "");
    document.getElementById("detail-fav-icon").innerHTML = isFav ? "&#9829;" : "&#9825;";

    $detailFav.onclick = function() {
      toggleFavorite(p.english_name);
      var saved = favorites.has(p.english_name);
      this.className = "detail-fav-btn" + (saved ? " saved" : "");
      document.getElementById("detail-fav-icon").innerHTML = saved ? "&#9829;" : "&#9825;";
    };

    $overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeDetail() {
    $overlay.hidden = true;
    document.body.style.overflow = "";
  }

  document.getElementById("detail-close").addEventListener("click", closeDetail);
  $overlay.addEventListener("click", function(e) {
    if (e.target === $overlay) closeDetail();
  });
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      if (!$lightbox.hidden) { closeLightbox(); return; }
      if (!$overlay.hidden) closeDetail();
      return;
    }
    if (!$lightbox.hidden) {
      if (e.key === "ArrowLeft") {
        lightboxIndex = (lightboxIndex - 1 + galleryPhotos.length) % galleryPhotos.length;
        updateLightbox();
      }
      if (e.key === "ArrowRight") {
        lightboxIndex = (lightboxIndex + 1) % galleryPhotos.length;
        updateLightbox();
      }
      return;
    }
    if ($overlay.hidden) return;
    if (e.key === "ArrowLeft") {
      galleryIndex = (galleryIndex - 1 + galleryPhotos.length) % galleryPhotos.length;
      updateGallery();
    }
    if (e.key === "ArrowRight") {
      galleryIndex = (galleryIndex + 1) % galleryPhotos.length;
      updateGallery();
    }
  });

  // ===== FULLSCREEN LIGHTBOX (desktop only) =====
  var $lightbox = document.getElementById("lightbox-overlay");
  var $lightboxImg = document.getElementById("lightbox-img");
  var $lightboxCounter = document.getElementById("lightbox-counter");
  var lightboxIndex = 0;

  function openLightbox() {
    if (galleryPhotos.length === 0) return;
    lightboxIndex = galleryIndex;
    updateLightbox();
    $lightbox.hidden = false;
  }

  function updateLightbox() {
    var photo = galleryPhotos[lightboxIndex];
    $lightboxImg.src = photo.url.replace('/medium.', '/large.');
    $lightboxCounter.textContent = (lightboxIndex + 1) + " / " + galleryPhotos.length;
    document.getElementById("lightbox-prev").style.display = galleryPhotos.length > 1 ? "" : "none";
    document.getElementById("lightbox-next").style.display = galleryPhotos.length > 1 ? "" : "none";
  }

  function closeLightbox() {
    $lightbox.hidden = true;
    $lightboxImg.src = "";
  }

  $detailImg.addEventListener("click", function(e) {
    e.stopPropagation();
    openLightbox();
  });

  document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
  $lightbox.addEventListener("click", function(e) {
    if (e.target === $lightbox) closeLightbox();
  });

  document.getElementById("lightbox-prev").addEventListener("click", function(e) {
    e.stopPropagation();
    lightboxIndex = (lightboxIndex - 1 + galleryPhotos.length) % galleryPhotos.length;
    updateLightbox();
  });

  document.getElementById("lightbox-next").addEventListener("click", function(e) {
    e.stopPropagation();
    lightboxIndex = (lightboxIndex + 1) % galleryPhotos.length;
    updateLightbox();
  });

  // Touch swipe for gallery
  var touchStartX = 0;
  var $gallery = document.getElementById("detail-gallery");
  $gallery.addEventListener("touchstart", function(e) {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  $gallery.addEventListener("touchend", function(e) {
    var diff = e.changedTouches[0].screenX - touchStartX;
    if (galleryPhotos.length <= 1) return;
    if (diff < -40) {
      galleryIndex = (galleryIndex + 1) % galleryPhotos.length;
      updateGallery();
    } else if (diff > 40) {
      galleryIndex = (galleryIndex - 1 + galleryPhotos.length) % galleryPhotos.length;
      updateGallery();
    }
  }, { passive: true });

  // Touch swipe for lightbox
  var lbTouchStartX = 0;
  $lightbox.addEventListener("touchstart", function(e) {
    lbTouchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  $lightbox.addEventListener("touchend", function(e) {
    var diff = e.changedTouches[0].screenX - lbTouchStartX;
    if (galleryPhotos.length <= 1) return;
    if (diff < -40) {
      lightboxIndex = (lightboxIndex + 1) % galleryPhotos.length;
      updateLightbox();
    } else if (diff > 40) {
      lightboxIndex = (lightboxIndex - 1 + galleryPhotos.length) % galleryPhotos.length;
      updateLightbox();
    }
  }, { passive: true });

  // ===== BROWSE SECTION =====
  function buildBrowseGrid() {
    var counts = {};
    PLANT_TYPES.forEach(function(t) { counts[t.key] = 0; });
    for (var i = 0; i < D.length; i++) {
      PLANT_TYPES.forEach(function(t) {
        if (D[i].plant_type.indexOf(t.key) !== -1) counts[t.key]++;
      });
    }

    PLANT_TYPES.forEach(function(t) {
      var tile = document.createElement("button");
      tile.className = "browse-type-tile";
      tile.innerHTML =
        '<div class="browse-type-icon">' + t.icon + '</div>' +
        '<div class="browse-type-name">' + t.label + '</div>' +
        '<div class="browse-type-count">' + counts[t.key] + ' plants</div>';
      tile.addEventListener("click", function() {
        document.querySelectorAll(".browse-type-tile").forEach(function(tt) { tt.classList.remove("active"); });
        this.classList.add("active");
        browseByType(t.key, t.label);
      });
      $browseGrid.appendChild(tile);
    });
  }

  var browseResults = [];
  var browseShown = 0;

  function browseByType(typeKey, label) {
    browseResults = [];
    for (var i = 0; i < D.length; i++) {
      if (D[i].plant_type.indexOf(typeKey) !== -1) browseResults.push(i);
    }
    browseShown = 0;
    $browseList.innerHTML = "";

    if (browseResults.length === 0) {
      $browseHeading.textContent = label;
      $browseList.innerHTML = '<li class="empty-msg">No plants of this type found.</li>';
      $browseResults.hidden = false;
      $browseMore.hidden = true;
      return;
    }

    $browseHeading.textContent = label + " — " + browseResults.length + " plants";
    var toShow = browseResults.slice(0, PAGE_SIZE);
    browseShown = toShow.length;
    for (var i = 0; i < toShow.length; i++) {
      $browseList.appendChild(createBrowseItem(browseResults[i]));
    }
    $browseResults.hidden = false;
    $browseMore.hidden = browseResults.length <= browseShown;
  }

  function createBrowseItem(idx) {
    var p = D[idx];
    var li = document.createElement("li");
    li.className = "plant-card";
    li.style.cursor = "pointer";

    li.innerHTML =
      '<div class="plant-card-img-wrap">' +
        '<img class="plant-card-img" src="' + escapeHtml(p.photo_url) + '" alt="' + escapeHtml(p.english_name) + '" loading="lazy" onerror="this.style.display=\'none\'">' +
      '</div>' +
      '<div class="plant-card-body">' +
        '<div class="plant-card-navajo">' + (p.navajo_name ? escapeHtml(p.navajo_name) : '<span class="plant-card-no-navajo">No Diné name recorded</span>') + '</div>' +
        '<div class="plant-card-english">' + escapeHtml(p.english_name) + '</div>' +
        '<div class="plant-card-scientific">' + escapeHtml(p.scientific_name) + '</div>' +
      '</div>';

    li.addEventListener("click", function() { openDetail(idx); });
    return li;
  }

  $browseMore.addEventListener("click", function() {
    var next = browseResults.slice(browseShown, browseShown + PAGE_SIZE);
    browseShown += next.length;
    for (var i = 0; i < next.length; i++) {
      $browseList.appendChild(createBrowseItem(next[i]));
    }
    $browseMore.hidden = browseResults.length <= browseShown;
  });

  // ===== FAVORITES =====
  function loadFavorites() {
    try {
      var raw = localStorage.getItem(FAV_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch(e) { return new Set(); }
  }

  function saveFavorites() {
    localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favorites)));
  }

  function toggleFavorite(name) {
    if (favorites.has(name)) favorites.delete(name);
    else favorites.add(name);
    saveFavorites();
    updateFeaturedFavBtn();
  }

  function renderFavorites() {
    $favList.innerHTML = "";
    if (favorites.size === 0) {
      $favEmpty.style.display = "";
      return;
    }
    $favEmpty.style.display = "none";
    favorites.forEach(function(name) {
      var idx = -1;
      for (var i = 0; i < D.length; i++) {
        if (D[i].english_name === name) { idx = i; break; }
      }
      if (idx === -1) return;
      $favList.appendChild(createBrowseItem(idx));
    });
  }

  // ===== FEATURED PLANT =====
  function pickFeatured() {
    if (D.length === 0) return;
    var withNavajo = [];
    for (var i = 0; i < D.length; i++) {
      if (D[i].navajo_name) withNavajo.push(i);
    }
    if (withNavajo.length === 0) return;
    var today = new Date();
    var seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    var idx = withNavajo[seed % withNavajo.length];
    var p = D[idx];

    document.getElementById("featured-img").src = p.photo_url;
    document.getElementById("featured-img").alt = p.english_name;
    document.getElementById("featured-navajo").textContent = p.navajo_name || "—";
    document.getElementById("featured-english").textContent = p.english_name;
    document.getElementById("featured-scientific").textContent = p.scientific_name;
    document.getElementById("featured-type").textContent = p.plant_type;
    document.getElementById("featured-season").textContent = p.growing_season;
    document.getElementById("featured-desc").textContent = p.description;
    $featuredCard.dataset.plant = p.english_name;
    $featuredCard.dataset.idx = idx;
    updateFeaturedFavBtn();

    $featuredCard.addEventListener("click", function(e) {
      if (e.target.closest(".fav-btn")) return;
      openDetail(parseInt(this.dataset.idx));
    });

    document.getElementById("featured-fav").onclick = function(e) {
      e.stopPropagation();
      toggleFavorite(p.english_name);
    };
  }

  function updateFeaturedFavBtn() {
    var name = $featuredCard.dataset.plant;
    if (!name) return;
    var isFav = favorites.has(name);
    var btn = document.getElementById("featured-fav");
    btn.innerHTML = isFav ? "&#9829;" : "&#9825;";
    btn.classList.toggle("saved", isFav);
  }

  // ===== PHOTO CREDITS =====
  function buildPhotoCredits() {
    var $credits = document.getElementById("photo-credits");
    if (!$credits) return;
    var lines = [];
    for (var i = 0; i < D.length; i++) {
      if (D[i].photo_attr) {
        lines.push(escapeHtml(D[i].english_name) + " — " + escapeHtml(D[i].photo_attr));
      }
    }
    $credits.innerHTML = lines.join("<br>");
  }

  // ===== INIT =====
  loadPlants().then(function() {
    pickFeatured();
    buildBrowseGrid();
    buildPhotoCredits();
    currentResults = getAllFiltered();
    renderGrid();
    if (window.innerWidth > 768) $input.focus();
  }).catch(function(err) {
    console.error("Failed to load plants:", err);
    $resultsCount.textContent = "Unable to load plant data.";
    $resultsHeader.hidden = false;
  });

})();
