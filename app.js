const STORAGE_KEY = "sunami-sale-products-v2";
const LINE_CONTACT_URL = "https://lin.ee/US6LBI4";
const ADMIN_SESSION_KEY = "sunami-sale-admin-passcode";
const SUPABASE_URL = "https://kuxdmlmimltngqjekckk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_C6cNc2gB3JL2wQo3ZyF-HA_OJcGH7hh";

const $ = (selector) => document.querySelector(selector);
const grid = $("#productGrid");
const emptyState = $("#emptyState");
const filters = $("#filters");
const editor = $("#editorDialog");
const detailDialog = $("#detailDialog");
const form = $("#productForm");
const passcodeDialog = $("#passcodeDialog");
const passcodeForm = $("#passcodeForm");
let products = [];
let activeCategory = "すべて";
let pendingPhotos = [];
let pendingAdminAction = null;
let refreshPromise = null;

function loadLegacyProducts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const error = new Error(detail.message || "通信に失敗しました");
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

function fromCloudProduct(row) {
  const photos = parsePhotos(row.photo);
  return {
    id: row.id,
    productNumber: row.product_number,
    name: row.name,
    category: normalizeCategory(row.category),
    free: row.free,
    price: row.price,
    description: row.description,
    status: row.status,
    photo: photos[0] || "",
    photos,
    updatedAt: row.updated_at
  };
}

function normalizeCategory(category) {
  return category === "自動車用品" ? "車用品" : category;
}

function parsePhotos(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).slice(0, 5);
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).slice(0, 5);
    } catch {
      return [text].slice(0, 5);
    }
  }
  return [text].slice(0, 5);
}

function serializePhotos(photos) {
  const list = photos.filter(Boolean).slice(0, 5);
  if (list.length === 0) return "";
  return list.length === 1 ? list[0] : JSON.stringify(list);
}

function productPhotos(product) {
  return parsePhotos(product.photos?.length ? product.photos : product.photo);
}

function mainPhoto(product) {
  return productPhotos(product)[0] || "";
}

function compareProductsByRegistration(a, b) {
  const numberA = Number(a.productNumber || 0);
  const numberB = Number(b.productNumber || 0);
  if (numberA && numberB && numberA !== numberB) return numberA - numberB;

  const dateA = Date.parse(a.updatedAt || "") || 0;
  const dateB = Date.parse(b.updatedAt || "") || 0;
  if (dateA !== dateB) return dateA - dateB;
  return String(a.id).localeCompare(String(b.id));
}

function assignDisplayNumbers(items) {
  return [...items]
    .sort(compareProductsByRegistration)
    .map((product, index) => ({
      ...product,
      displayNumber: product.productNumber
        ? String(product.productNumber).padStart(3, "0")
        : String(index + 1).padStart(3, "0")
    }));
}

async function refreshProducts({ silent = false } = {}) {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const rows = await apiRequest("/rest/v1/products?select=*&order=updated_at.desc");
      products = assignDisplayNumbers(rows.map(fromCloudProduct));
      render();
    } catch {
      if (!silent) {
        $("#itemCount").textContent = "接続エラー";
        showToast("商品を読み込めませんでした。通信状態をご確認ください");
      }
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function adminMutation(passcode, action, product = {}) {
  return apiRequest("/rest/v1/rpc/admin_product_mutation", {
    method: "POST",
    body: JSON.stringify({
      p_passcode: passcode,
      p_action: action,
      p_product: product
    })
  });
}

async function migrateLegacyProducts(passcode) {
  const legacyProducts = loadLegacyProducts();
  if (!legacyProducts.length) return;
  showToast(`${legacyProducts.length}件の商品を共有しています…`);
  for (const product of legacyProducts) {
    await adminMutation(passcode, "upsert", {
      ...product,
      category: normalizeCategory(product.category)
    });
  }
  localStorage.removeItem(STORAGE_KEY);
  await refreshProducts();
  showToast(`${legacyProducts.length}件の商品を共有しました`);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function formatPrice(product) {
  if (product.free) return "無料";
  return `¥${Number(product.price || 0).toLocaleString("ja-JP")}`;
}

function formatProductNumber(product) {
  if (product.displayNumber) return product.displayNumber;
  return product.productNumber ? String(product.productNumber).padStart(3, "0") : "";
}

function productDisplayName(product) {
  const number = formatProductNumber(product);
  return number ? `${number} ${product.name}` : product.name;
}

function statusLabel(status) {
  return { available: "販売中", reserved: "商談中", sold: "売約済み" }[status] || "販売中";
}

function inquiryLabel(product) {
  return product.free ? "欲しい" : "買いたい";
}

function inquiryMessage(product) {
  const label = inquiryLabel(product);
  return `【${label}】\n「${productDisplayName(product)}」（${formatPrice(product)}）を希望します。\nまだお取引可能でしょうか？`;
}

async function copyInquiryMessage(message) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(message);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = message;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function openLineInquiry(id) {
  const product = products.find((item) => item.id === id);
  if (!product || product.status !== "available") return;
  const lineWindow = window.open(LINE_CONTACT_URL, "_blank");
  if (lineWindow) lineWindow.opener = null;

  copyInquiryMessage(inquiryMessage(product))
    .then(() => showToast("希望メッセージをコピーしました"))
    .catch(() => showToast("公式LINEで商品名を添えてご連絡ください"));

  if (!lineWindow) {
    location.href = LINE_CONTACT_URL;
  }
}

function render() {
  const categories = ["すべて", ...new Set(products.map((item) => item.category))];
  if (!categories.includes(activeCategory)) activeCategory = "すべて";
  filters.innerHTML = categories.map((category) => `
    <button class="filter ${category === activeCategory ? "active" : ""}" data-category="${escapeHTML(category)}" type="button">${escapeHTML(category)}</button>
  `).join("");

  const visible = activeCategory === "すべて"
    ? products
    : products.filter((item) => item.category === activeCategory);

  $("#itemCount").textContent = `${visible.length} ${visible.length === 1 ? "ITEM" : "ITEMS"}`;
  emptyState.hidden = products.length > 0;
  grid.hidden = products.length === 0;
  grid.innerHTML = visible.map((product) => {
    const photo = mainPhoto(product);
    const number = formatProductNumber(product);
    return `
    <article class="product-card" data-id="${product.id}" tabindex="0">
      <div class="product-image-wrap">
        ${photo
          ? `<img class="product-image" src="${photo}" alt="${escapeHTML(productDisplayName(product))}" loading="lazy" decoding="async" />`
          : `<div class="no-image">NO IMAGE</div>`}
        ${product.status !== "available" ? `<span class="status ${product.status}">${statusLabel(product.status)}</span>` : ""}
        <span class="card-index">${number}</span>
      </div>
      <div class="product-meta">
        <p class="product-category">${escapeHTML(product.category)}</p>
        <div class="product-title-row">
          <h3 class="product-title">${escapeHTML(productDisplayName(product))}</h3>
          <span class="product-price">${formatPrice(product)}</span>
        </div>
        <p class="product-description">${escapeHTML(product.description || "詳しい状態については、お問い合わせください。")}</p>
        <div class="card-actions">
          <button class="inquiry-button ${product.free ? "is-free" : "is-paid"}" type="button" data-inquiry="${product.id}" ${product.status !== "available" ? "disabled" : ""}>
            ${product.status === "available" ? inquiryLabel(product) : statusLabel(product.status)}
            <span aria-hidden="true">↗</span>
          </button>
          <button class="edit-link" type="button" data-edit="${product.id}">内容を編集</button>
        </div>
      </div>
    </article>
  `; }).join("");
}

function renderPhotoEditor() {
  const previewList = $("#photoPreviewList");
  previewList.innerHTML = pendingPhotos.map((photo, index) => `
    <div class="photo-preview-card">
      <img src="${photo}" alt="商品写真 ${index + 1}" />
      <button class="photo-remove-button" type="button" data-remove-photo="${index}" aria-label="写真${index + 1}を削除">×</button>
      <span class="photo-count">${index + 1}/5</span>
    </div>
  `).join("");
  previewList.hidden = pendingPhotos.length === 0;
  $("#photoPrompt").hidden = pendingPhotos.length > 0;
}

function resetForm() {
  form.reset();
  $("#productId").value = "";
  $("#editorTitle").textContent = "商品を登録";
  $("#deleteButton").hidden = true;
  pendingPhotos = [];
  renderPhotoEditor();
  $("#priceInput").disabled = false;
}

function openEditor(id = "") {
  resetForm();
  if (id) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    $("#productId").value = product.id;
    $("#editorTitle").textContent = "商品を編集";
    $("#nameInput").value = product.name;
    $("#categoryInput").value = product.category;
    $("#freeInput").checked = product.free;
    $("#priceInput").value = product.price || "";
    $("#priceInput").disabled = product.free;
    $("#descriptionInput").value = product.description || "";
    $("#statusInput").value = product.status;
    $("#deleteButton").hidden = false;
    pendingPhotos = productPhotos(product);
    renderPhotoEditor();
  }
  editor.showModal();
}

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 1400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openDetail(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  const unavailable = product.status !== "available";
  const photos = productPhotos(product);
  const gallery = photos.length
    ? `<div class="detail-gallery ${photos.length === 1 ? "is-single" : ""}">
        ${photos.map((photo, index) => `<img class="detail-image" src="${photo}" alt="${escapeHTML(productDisplayName(product))} 写真${index + 1}" />`).join("")}
      </div>`
    : `<div class="detail-gallery is-single"><div class="detail-image no-image">NO IMAGE</div></div>`;
  $("#detailContent").innerHTML = `
    <div class="detail-layout">
      ${gallery}
      <div class="detail-copy">
        <p class="section-label">${escapeHTML(product.category)} / ${statusLabel(product.status)}</p>
        <h2>${escapeHTML(productDisplayName(product))}</h2>
        <p class="detail-price">${formatPrice(product)}</p>
        <p class="detail-description">${escapeHTML(product.description || "詳しい状態については、お問い合わせください。")}</p>
        <button class="contact-link ${product.free ? "is-free" : "is-paid"}" type="button" data-detail-inquiry="${product.id}" ${unavailable ? "disabled" : ""}>
          ${unavailable ? statusLabel(product.status) : `${inquiryLabel(product)}を公式LINEで連絡`}
        </button>
        <p class="detail-caption">希望文をコピーして公式LINEを開きます。送料・受け渡し方法は個別にご相談ください。</p>
      </div>
    </div>
  `;
  detailDialog.showModal();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function isAdminAuthenticated() {
  return Boolean(sessionStorage.getItem(ADMIN_SESSION_KEY));
}

function requireAdminAccess(action) {
  if (isAdminAuthenticated()) {
    action();
    return;
  }
  pendingAdminAction = action;
  $("#passcodeInput").value = "";
  $("#passcodeError").hidden = true;
  passcodeDialog.showModal();
  setTimeout(() => $("#passcodeInput").focus(), 0);
}

document.querySelectorAll(".open-editor").forEach((button) => {
  button.addEventListener("click", () => requireAdminAccess(() => openEditor()));
});
passcodeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const passcode = $("#passcodeInput").value;
  const submitButton = passcodeForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  $("#passcodeError").hidden = true;
  try {
    await adminMutation(passcode, "verify");
  } catch {
    $("#passcodeError").hidden = false;
    $("#passcodeInput").select();
    submitButton.disabled = false;
    return;
  }

  sessionStorage.setItem(ADMIN_SESSION_KEY, passcode);
  passcodeDialog.close();
  const action = pendingAdminAction;
  pendingAdminAction = null;
  try {
    await migrateLegacyProducts(passcode);
  } catch {
    showToast("端末内の商品を共有できませんでした。通信状態をご確認ください");
  }
  action?.();
  submitButton.disabled = false;
});
$("#cancelPasscode").addEventListener("click", () => {
  pendingAdminAction = null;
  passcodeDialog.close();
});
$("#closeEditor").addEventListener("click", () => editor.close());
$("#closeDetail").addEventListener("click", () => detailDialog.close());

$("#freeInput").addEventListener("change", (event) => {
  $("#priceInput").disabled = event.target.checked;
  if (event.target.checked) $("#priceInput").value = "";
});

document.querySelectorAll(".photo-input").forEach((input) => {
  input.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const availableSlots = 5 - pendingPhotos.length;
    if (availableSlots <= 0) {
      showToast("写真は最大5枚までです");
      event.target.value = "";
      return;
    }
    const selectedFiles = files.slice(0, availableSlots);
    try {
      const resizedPhotos = await Promise.all(selectedFiles.map(resizePhoto));
      pendingPhotos = [...pendingPhotos, ...resizedPhotos].slice(0, 5);
      renderPhotoEditor();
      if (files.length > availableSlots) showToast("写真は最大5枚まで追加しました");
    } catch {
      showToast("写真を読み込めませんでした");
    } finally {
      event.target.value = "";
    }
  });
});

$("#photoPreviewList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-photo]");
  if (!button) return;
  pendingPhotos.splice(Number(button.dataset.removePhoto), 1);
  renderPhotoEditor();
});

filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  render();
});

grid.addEventListener("click", (event) => {
  const inquiryButton = event.target.closest("[data-inquiry]");
  if (inquiryButton) {
    event.stopPropagation();
    openLineInquiry(inquiryButton.dataset.inquiry);
    return;
  }
  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    event.stopPropagation();
    requireAdminAccess(() => openEditor(editButton.dataset.edit));
    return;
  }
  const card = event.target.closest("[data-id]");
  if (card) openDetail(card.dataset.id);
});

detailDialog.addEventListener("click", (event) => {
  const inquiryButton = event.target.closest("[data-detail-inquiry]");
  if (!inquiryButton) return;
  openLineInquiry(inquiryButton.dataset.detailInquiry);
});

grid.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-id]")) {
    event.preventDefault();
    openDetail(event.target.dataset.id);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#productId").value;
  const product = {
    id: id || crypto.randomUUID(),
    name: $("#nameInput").value.trim(),
    category: $("#categoryInput").value,
    free: $("#freeInput").checked,
    price: $("#freeInput").checked ? 0 : Number($("#priceInput").value || 0),
    description: $("#descriptionInput").value.trim(),
    status: $("#statusInput").value,
    photo: serializePhotos(pendingPhotos),
    updatedAt: new Date().toISOString()
  };
  if (!product.name) return;
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    await adminMutation(sessionStorage.getItem(ADMIN_SESSION_KEY), "upsert", product);
    await refreshProducts();
    editor.close();
    showToast(id ? "商品を更新しました" : "商品を掲載しました");
  } catch (error) {
    showToast(error.message.includes("999")
      ? "商品番号が999に達したため、これ以上登録できません"
      : "保存できませんでした。通信状態をご確認ください");
  } finally {
    submitButton.disabled = false;
  }
});

$("#deleteButton").addEventListener("click", async () => {
  const id = $("#productId").value;
  if (!id || !confirm("この商品を削除しますか？")) return;
  const deleteButton = $("#deleteButton");
  deleteButton.disabled = true;
  try {
    await adminMutation(sessionStorage.getItem(ADMIN_SESSION_KEY), "delete", { id });
    await refreshProducts();
    editor.close();
    showToast("商品を削除しました");
  } catch {
    showToast("削除できませんでした。通信状態をご確認ください");
  } finally {
    deleteButton.disabled = false;
  }
});

[passcodeDialog, editor, detailDialog].forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

$("#year").textContent = new Date().getFullYear();
emptyState.hidden = true;
grid.hidden = true;
$("#itemCount").textContent = "読み込み中";
refreshProducts();

window.setInterval(() => {
  if (document.visibilityState === "visible") refreshProducts({ silent: true });
}, 15000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshProducts({ silent: true });
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
