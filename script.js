(() => {
  const config = window.SITE_CONFIG || {};
  const surahs = window.SURAHS || [];

  const grid = document.getElementById("surahGrid");
  const searchInput = document.getElementById("searchInput");
  const modal = document.getElementById("surahModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalSurahNumber = document.getElementById("modalSurahNumber");
  const videoArea = document.getElementById("videoArea");
  const selectedSurah = document.getElementById("selectedSurah");
  const form = document.getElementById("uploadForm");
  const fileInput = document.getElementById("recitationFile");
  const fileLabel = document.getElementById("fileLabel");
  const fileHint = document.getElementById("fileHint");
  const submitButton = document.getElementById("submitButton");
  const formMessage = document.getElementById("formMessage");
  const progressWrap = document.getElementById("progressWrap");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  document.getElementById("siteTitle").textContent = config.siteTitle || "منصة التلاوة الصحيحة";
  document.getElementById("schoolName").textContent = config.schoolName || "مدرستي";
  document.title = config.siteTitle || "منصة التلاوة الصحيحة";

  function renderSurahs(list) {
    if (!list.length) {
      grid.innerHTML = '<p class="empty-search">لم يتم العثور على سورة بهذا الاسم.</p>';
      return;
    }

    grid.innerHTML = list.map(surah => `
      <button class="surah-card" type="button" data-surah="${surah.number}">
        <span class="surah-number">${surah.number}</span>
        <span>
          <strong>سورة ${surah.name}</strong>
          <small>${(config.youtubePlaylistId || surah.videoUrl) ? "مشاهدة التلاوة ورفع التسجيل" : "جاهزة لإضافة رابط الفيديو"}</small>
        </span>
      </button>
    `).join("");
  }

  function normalizeArabic(text) {
    return text
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[ً-ْ]/g, "")
      .trim();
  }

  function youtubeEmbedUrl(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) {
        const id = parsed.pathname.split("/").filter(Boolean)[0];
        return id ? `https://www.youtube.com/embed/${id}` : "";
      }
      if (parsed.hostname.includes("youtube.com")) {
        if (parsed.pathname.startsWith("/embed/")) return url;
        if (parsed.pathname.startsWith("/shorts/")) {
          const id = parsed.pathname.split("/")[2];
          return id ? `https://www.youtube.com/embed/${id}` : "";
        }
        const id = parsed.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : "";
      }
      return url;
    } catch {
      return "";
    }
  }

  // تحميل YouTube IFrame API مرة واحدة فقط.
  let youtubeApiPromise;
  function ensureYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (youtubeApiPromise) return youtubeApiPromise;

    youtubeApiPromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === "function") previousReady();
        resolve();
      };

      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existing) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        tag.async = true;
        tag.onerror = () => reject(new Error("تعذر تحميل مشغل YouTube."));
        document.head.appendChild(tag);
      }
    });

    return youtubeApiPromise;
  }

  async function showPlaylistSurah(surah) {
    const playlistId = String(config.youtubePlaylistId || "").trim();
    if (!playlistId) return false;

    // ترتيب YouTube يبدأ من 0، لذلك الفاتحة = 0 والبقرة = 1 ... الناس = 113.
    const playlistIndex = Math.max(0, Number(surah.number) - 1);
    videoArea.innerHTML = '<div class="no-video"><strong>جاري تحميل التلاوة...</strong></div>';

    try {
      await ensureYouTubeApi();
      if (!modal.classList.contains("open")) return true;

      videoArea.innerHTML = '<div id="youtubePlayer"></div>';
      new YT.Player("youtubePlayer", {
        width: "100%",
        height: "100%",
        playerVars: {
          playsinline: 1,
          rel: 0
        },
        events: {
          onReady(event) {
            event.target.cuePlaylist({
              listType: "playlist",
              list: playlistId,
              index: playlistIndex,
              startSeconds: 0
            });
          },
          onError() {
            videoArea.innerHTML = `
              <div class="no-video">
                <strong>تعذر تشغيل سورة ${surah.name}</strong>
                <span>تأكدي أن الـ Playlist عامة أو غير مدرجة وأن ترتيب السور صحيح.</span>
              </div>`;
          }
        }
      });
      return true;
    } catch (error) {
      console.error(error);
      videoArea.innerHTML = `
        <div class="no-video">
          <strong>تعذر تحميل مشغل YouTube</strong>
          <span>تحققي من اتصال الإنترنت وحاولي مرة أخرى.</span>
        </div>`;
      return true;
    }
  }

  function openSurah(surah) {
    selectedSurah.value = surah.name;
    modalTitle.textContent = `سورة ${surah.name}`;
    modalSurahNumber.textContent = surah.number;
    form.reset();
    selectedSurah.value = surah.name;
    resetFormStatus();

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (config.youtubePlaylistId) {
      showPlaylistSurah(surah);
      return;
    }

    const embed = youtubeEmbedUrl(surah.videoUrl);
    if (embed) {
      if (embed.includes("youtube.com/embed/")) {
        videoArea.innerHTML = `<iframe src="${embed}" title="تلاوة سورة ${surah.name}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
      } else {
        videoArea.innerHTML = `<video src="${embed}" controls playsinline style="width:100%;max-height:520px;background:#000"></video>`;
      }
    } else {
      videoArea.innerHTML = `
        <div class="no-video">
          <strong>لم يُضف رابط فيديو سورة ${surah.name} بعد</strong>
          <span>ضعي Playlist في ملف <code>config.js</code> أو رابطًا منفردًا في <code>surahs.js</code>.</span>
        </div>`;
    }
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    videoArea.innerHTML = "";
  }

  function resetFormStatus() {
    fileLabel.textContent = "اختاري ملفًا صوتيًا أو فيديو";
    fileHint.textContent = "MP3, M4A, WAV, MP4, MOV وغيرها";
    formMessage.textContent = "";
    formMessage.className = "form-message";
    progressWrap.hidden = true;
    progressBar.style.width = "0%";
    progressText.textContent = "جاري تجهيز الملف...";
    submitButton.disabled = false;
    submitButton.textContent = "إرسال التلاوة";
  }

  grid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-surah]");
    if (!card) return;
    const surah = surahs.find(s => s.number === Number(card.dataset.surah));
    if (surah) openSurah(surah);
  });

  searchInput.addEventListener("input", () => {
    const q = normalizeArabic(searchInput.value);
    const filtered = !q ? surahs : surahs.filter(s =>
      normalizeArabic(s.name).includes(q) || String(s.number).includes(q)
    );
    renderSurahs(filtered);
  });

  document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && modal.classList.contains("open")) closeModal(); });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return resetFormStatus();
    fileLabel.textContent = file.name;
    fileHint.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
  });

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("تعذر قراءة الملف."));
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.max(5, Math.min(45, Math.round((event.loaded / event.total) * 45)));
          progressBar.style.width = `${pct}%`;
          progressText.textContent = "جاري تجهيز الملف للإرسال...";
        }
      };
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage.textContent = "";
    formMessage.className = "form-message";

    const endpoint = config.appsScriptUrl || "";
    if (!endpoint || endpoint.includes("PUT_YOUR_")) {
      formMessage.textContent = "يجب أولًا وضع رابط Google Apps Script في ملف config.js.";
      formMessage.classList.add("error");
      return;
    }

    const file = fileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      formMessage.textContent = "الملف يجب أن يكون صوتًا أو فيديو.";
      formMessage.classList.add("error");
      return;
    }

    const maxMB = Number(config.maxFileSizeMB || 25);
    if (file.size > maxMB * 1024 * 1024) {
      formMessage.textContent = `حجم الملف أكبر من الحد المسموح (${maxMB} MB).`;
      formMessage.classList.add("error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "جاري الإرسال...";
    progressWrap.hidden = false;
    progressBar.style.width = "5%";

    try {
      const fileData = await fileToDataUrl(file);
      progressBar.style.width = "55%";
      progressText.textContent = "جاري رفع الملف إلى مساحة المدرسة...";

      const payload = {
        studentName: document.getElementById("studentName").value.trim(),
        studentClass: document.getElementById("studentClass").value.trim(),
        surah: selectedSurah.value,
        originalFileName: file.name,
        mimeType: file.type,
        fileData
      };

      const response = await fetch(endpoint, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let result = {};
      try { result = await response.json(); } catch { /* response may be opaque/text */ }
      if (result && result.ok === false) throw new Error(result.message || "فشل حفظ الملف.");

      progressBar.style.width = "100%";
      progressText.textContent = "تم الرفع بنجاح.";
      formMessage.textContent = "✓ تم إرسال تلاوتك للمعلمة بنجاح.";
      formMessage.classList.add("success");
      form.reset();
      fileLabel.textContent = "اختاري ملفًا صوتيًا أو فيديو";
      fileHint.textContent = "MP3, M4A, WAV, MP4, MOV وغيرها";
    } catch (error) {
      console.error(error);
      progressBar.style.width = "0%";
      progressText.textContent = "تعذر إكمال الرفع.";
      formMessage.textContent = "حدث خطأ أثناء رفع الملف. تأكدي من إعداد Apps Script وحاولي مرة أخرى.";
      formMessage.classList.add("error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "إرسال التلاوة";
    }
  });

  renderSurahs(surahs);
})();
