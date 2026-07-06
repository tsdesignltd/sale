const STORAGE_KEY = "sunami-sale-products-v1";
const SAMPLE_SEEDED_KEY = "sunami-sale-samples-v1";
const MESSENGER_RECIPIENT = "";
const SAMPLE_PRODUCTS = [
  {
    id: "sample-sigma-lens",
    name: "SIGMA ズームレンズ",
    category: "カメラ・映像",
    free: false,
    price: 12000,
    description: "広角から標準域をカバーするSIGMAのズームレンズです。外観には使用に伴う小傷があります。価格・対応マウント・動作状態は出品前にご確認ください。",
    status: "available",
    photo: "assets/products/sigma-lens.jpeg",
    updatedAt: "2026-07-06T00:00:00.000Z"
  },
  {
    id: "sample-car-springs",
    name: "車用スプリング・ラバーセット",
    category: "自動車用品",
    free: false,
    price: 6000,
    description: "車両用のスプリング4本とラバーパーツのセットです。塗装の剥がれや錆があります。適合車種とセット内容は出品前にご確認ください。",
    status: "available",
    photo: "assets/products/car-springs.jpeg",
    updatedAt: "2026-07-06T00:00:00.000Z"
  },
  {
    id: "sample-camera-gimbal",
    name: "DJI RONIN-SC カメラジンバル",
    category: "カメラ・映像",
    free: false,
    price: 18000,
    description: "ミラーレスカメラ向けの3軸ジンバルです。撮影機材整理のため出品するサンプルです。付属品と動作状態は出品前にご確認ください。",
    status: "available",
    photo: "assets/products/camera-gimbal.jpg",
    updatedAt: "2026-07-06T00:00:00.000Z"
  },
  {
    id: "sample-outdoor-chair",
    name: "NEMO リクライニングチェア",
    category: "アウトドア",
    free: false,
    price: 15000,
    description: "座面が吊り下げ式になったアウトドアチェアです。屋外で使用した中古品のため、脚部や生地の状態は写真と現物でご確認ください。",
    status: "available",
    photo: "assets/products/outdoor-chair.jpeg",
    updatedAt: "2026-07-06T00:00:00.000Z"
  },
  {
    id: "sample-bike-roller",
    name: "LiveRide ハイブリッドローラー",
    category: "自転車用品",
    free: false,
    price: 20000,
    description: "室内トレーニング用のハイブリッドローラーです。使用に伴う傷や汚れがあります。対応ホイールサイズと固定部品をご確認ください。",
    status: "available",
    photo: "assets/products/bike-roller.jpeg",
    updatedAt: "2026-07-06T00:00:00.000Z"
  }
];

const $ = (selector) => document.querySelector(selector);
const grid = $("#productGrid");
const emptyState = $("#emptyState");
const filters = $("#filters");
const editor = $("#editorDialog");
const detailDialog = $("#detailDialog");
const form = $("#productForm");
let products = loadProducts();
let activeCategory = "すべて";
let pendingPhoto = "";

function loadProducts() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    if (localStorage.getItem(SAMPLE_SEEDED_KEY)) return stored;
    const seeded = [...SAMPLE_PRODUCTS, ...stored];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    localStorage.setItem(SAMPLE_SEEDED_KEY, "1");
    return seeded;
  } catch {
    return [...SAMPLE_PRODUCTS];
  }
}

function saveProducts() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    return true;
  } catch {
    showToast("保存容量を超えました。写真を小さくしてお試しください");
    return false;
  }
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

function statusLabel(status) {
  return { available: "販売中", reserved: "商談中", sold: "売約済み" }[status] || "販売中";
}

function inquiryLabel(product) {
  return product.free ? "譲渡希望" : "購入希望";
}

function inquiryMessage(product) {
  const label = inquiryLabel(product);
  return `【${label}】\n「${product.name}」（${formatPrice(product)}）を希望します。\nまだお取引可能でしょうか？`;
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

function openMessengerInquiry(id) {
  const product = products.find((item) => item.id === id);
  if (!product || product.status !== "available") return;
  const recipient = MESSENGER_RECIPIENT.trim().replace(/^@/, "");
  const messengerUrl = recipient
    ? `https://m.me/${encodeURIComponent(recipient)}?ref=${encodeURIComponent(product.id)}`
    : "https://www.facebook.com/messages/";
  const messengerWindow = window.open(messengerUrl, "_blank");
  if (messengerWindow) messengerWindow.opener = null;

  copyInquiryMessage(inquiryMessage(product))
    .then(() => showToast("希望メッセージをコピーしました"))
    .catch(() => showToast("Messengerで商品名を添えてご連絡ください"));

  if (!messengerWindow) {
    location.href = messengerUrl;
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
  grid.innerHTML = visible.map((product, index) => `
    <article class="product-card" data-id="${product.id}" tabindex="0">
      <div class="product-image-wrap">
        ${product.photo
          ? `<img class="product-image" src="${product.photo}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async" />`
          : `<div class="no-image">NO IMAGE</div>`}
        ${product.status !== "available" ? `<span class="status ${product.status}">${statusLabel(product.status)}</span>` : ""}
        <span class="card-index">${String(index + 1).padStart(2, "0")}</span>
      </div>
      <div class="product-meta">
        <p class="product-category">${escapeHTML(product.category)}</p>
        <div class="product-title-row">
          <h3 class="product-title">${escapeHTML(product.name)}</h3>
          <span class="product-price">${formatPrice(product)}</span>
        </div>
        <div class="card-actions">
          <button class="inquiry-button" type="button" data-inquiry="${product.id}" ${product.status !== "available" ? "disabled" : ""}>
            ${product.status === "available" ? inquiryLabel(product) : statusLabel(product.status)}
            <span aria-hidden="true">↗</span>
          </button>
          <button class="edit-link" type="button" data-edit="${product.id}">内容を編集</button>
        </div>
      </div>
    </article>
  `).join("");
}

function resetForm() {
  form.reset();
  $("#productId").value = "";
  $("#editorTitle").textContent = "商品を登録";
  $("#deleteButton").hidden = true;
  pendingPhoto = "";
  $("#photoPreview").hidden = true;
  $("#photoPreview").removeAttribute("src");
  $("#photoPrompt").hidden = false;
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
    pendingPhoto = product.photo || "";
    if (pendingPhoto) {
      $("#photoPreview").src = pendingPhoto;
      $("#photoPreview").hidden = false;
      $("#photoPrompt").hidden = true;
    }
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
  $("#detailContent").innerHTML = `
    <div class="detail-layout">
      ${product.photo
        ? `<img class="detail-image" src="${product.photo}" alt="${escapeHTML(product.name)}" />`
        : `<div class="detail-image no-image">NO IMAGE</div>`}
      <div class="detail-copy">
        <p class="section-label">${escapeHTML(product.category)} / ${statusLabel(product.status)}</p>
        <h2>${escapeHTML(product.name)}</h2>
        <p class="detail-price">${formatPrice(product)}</p>
        <p class="detail-description">${escapeHTML(product.description || "詳しい状態については、お問い合わせください。")}</p>
        <button class="contact-link" type="button" data-detail-inquiry="${product.id}" ${unavailable ? "disabled" : ""}>
          ${unavailable ? statusLabel(product.status) : `${inquiryLabel(product)}をMessengerで送る`}
        </button>
        <p class="detail-caption">希望文をコピーしてMessengerを開きます。送料・受け渡し方法は個別にご相談ください。</p>
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

document.querySelectorAll(".open-editor").forEach((button) => {
  button.addEventListener("click", () => openEditor());
});
$("#closeEditor").addEventListener("click", () => editor.close());
$("#closeDetail").addEventListener("click", () => detailDialog.close());
$("#aboutButton").addEventListener("click", () => $("#about").scrollIntoView());

$("#freeInput").addEventListener("change", (event) => {
  $("#priceInput").disabled = event.target.checked;
  if (event.target.checked) $("#priceInput").value = "";
});

$("#photoInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    pendingPhoto = await resizePhoto(file);
    $("#photoPreview").src = pendingPhoto;
    $("#photoPreview").hidden = false;
    $("#photoPrompt").hidden = true;
  } catch {
    showToast("写真を読み込めませんでした");
  }
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
    openMessengerInquiry(inquiryButton.dataset.inquiry);
    return;
  }
  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    event.stopPropagation();
    openEditor(editButton.dataset.edit);
    return;
  }
  const card = event.target.closest("[data-id]");
  if (card) openDetail(card.dataset.id);
});

detailDialog.addEventListener("click", (event) => {
  const inquiryButton = event.target.closest("[data-detail-inquiry]");
  if (!inquiryButton) return;
  openMessengerInquiry(inquiryButton.dataset.detailInquiry);
});

grid.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-id]")) {
    event.preventDefault();
    openDetail(event.target.dataset.id);
  }
});

form.addEventListener("submit", (event) => {
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
    photo: pendingPhoto,
    updatedAt: new Date().toISOString()
  };
  if (!product.name) return;
  const previous = [...products];
  if (id) {
    products = products.map((item) => item.id === id ? product : item);
  } else {
    products = [product, ...products];
  }
  if (!saveProducts()) {
    products = previous;
    return;
  }
  editor.close();
  render();
  showToast(id ? "商品を更新しました" : "商品を掲載しました");
});

$("#deleteButton").addEventListener("click", () => {
  const id = $("#productId").value;
  if (!id || !confirm("この商品を削除しますか？")) return;
  products = products.filter((item) => item.id !== id);
  saveProducts();
  editor.close();
  render();
  showToast("商品を削除しました");
});

[editor, detailDialog].forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

$("#year").textContent = new Date().getFullYear();
render();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
