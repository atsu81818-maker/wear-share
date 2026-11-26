
import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

import { supabaseConfig } from "./config.js";

const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey
);

const $ = (id) => document.getElementById(id);

let currentUser = null;

// メッセージ表示
function showMessage(message, isError = false) {
  const element = $("authMessage");
  element.textContent = message;
  element.style.color = isError ? "#c0392b" : "#27834a";
}

// ログイン状態に合わせて画面を切り替える
function updateAuthUI(user) {
  currentUser = user;

  $("authArea").classList.toggle("hidden", !!user);
  $("profileArea").classList.toggle("hidden", !user);

  $("userEmail").textContent = user
    ? user.email
    : "";

  $("listingForm").classList.toggle("hidden", !user);

  if (user) {
    loadMyListings();
  } else {
    $("myListings").innerHTML = "";
  }
}

// 会員登録
$("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const displayName = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;

  if (!displayName || !email || password.length < 8) {
    showMessage("入力内容を確認してください。", true);
    return;
  }

  showMessage("会員登録中...");


const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo:
      "https://atsu81818-maker.github.io/wear-share/",
    data: {
      display_name: displayName
    }
  }
});


  if (error) {
    showMessage(error.message, true);
    return;
  }

  if (data.session) {
    showMessage("会員登録が完了しました。");
  } else {
    showMessage(
      "確認メールを送信しました。メール内のリンクを確認してください。"
    );
  }
});

// ログイン
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  showMessage("ログイン中...");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage("ログインできませんでした。入力内容を確認してください。", true);
    return;
  }

  showMessage("ログインしました。");
});

// ログアウト
$("logoutButton").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    showMessage("ログアウトに失敗しました。", true);
    return;
  }

  showMessage("ログアウトしました。");
});

// 商品一覧の取得
async function loadProducts() {
  const container = $("productList");

  container.innerHTML = "<p>商品を読み込んでいます...</p>";

  const { data, error } = await supabase
    .from("listings")
    .select("id, title, brand, size, condition, daily_price, image_path")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "商品を読み込めませんでした。";
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<p>現在、公開中の商品はありません。</p>";
    return;
  }

  renderProducts(data);
}

// 商品表示
function renderProducts(products) {
  const container = $("productList");
  container.replaceChildren();

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const image = document.createElement("img");
    image.alt = product.title;
    image.loading = "lazy";

    // 画像アップロード機能は次の段階で実装する
    image.src = product.image_path || "";

    const info = document.createElement("div");
    info.className = "product-info";

    const title = document.createElement("h3");
    title.textContent = product.title;

    const brand = document.createElement("p");
    brand.textContent = product.brand || "ブランド未設定";

    const size = document.createElement("p");
    size.textContent = "サイズ：" + (product.size || "未設定");

    const condition = document.createElement("p");
    condition.textContent = "状態：" + (product.condition || "未設定");

    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent =
      "¥" + Number(product.daily_price).toLocaleString("ja-JP") + " / 日";

    info.append(title, brand, size, condition, price);
    card.append(image, info);
    container.append(card);
  });
}

// 自分の出品一覧
async function loadMyListings() {
  if (!currentUser) return;

  const container = $("myListings");
  container.textContent = "出品商品を読み込んでいます...";

  const { data, error } = await supabase
    .from("listings")
    .select("id, title, daily_price, status, created_at")
    .eq("seller_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "出品一覧を取得できませんでした。";
    console.error(error);
    return;
  }

  container.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = "あなたの出品商品";
  container.append(heading);

  if (!data || data.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "まだ出品商品はありません。";
    container.append(empty);
    return;
  }

  data.forEach((item) => {
    const row = document.createElement("div");
    row.className = "product-info";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const price = document.createElement("p");
    price.textContent =
      "希望価格：¥" +
      Number(item.daily_price).toLocaleString("ja-JP") +
      " / 日";

    const status = document.createElement("p");
    status.textContent =
      "状態：" +
      (item.status === "active"
        ? "公開中"
        : item.status === "pending_review"
          ? "審査中"
          : item.status === "rejected"
            ? "非承認"
            : "下書き");

    row.append(title, price, status);
    container.append(row);
  });
}

// 出品申請
$("listingForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    showMessage("ログインしてください。", true);
    return;
  }

  const title = $("listingTitle").value.trim();
  const brand = $("listingBrand").value.trim();
  const size = $("listingSize").value.trim();
  const condition = $("listingCondition").value;
  const dailyPrice = Number($("listingPrice").value);
  const description = $("listingDescription").value.trim();

  if (
    !title ||
    !condition ||
    !Number.isSafeInteger(dailyPrice) ||
    dailyPrice <= 0 ||
    dailyPrice > 1000000
  ) {
    showMessage("商品情報と価格を確認してください。", true);
    return;
  }

  showMessage("出品申請を送信しています...");

  const { error } = await supabase
    .from("listings")
    .insert({
      seller_id: currentUser.id,
      title,
      brand,
      size,
      condition,
      daily_price: dailyPrice,
      description,
      status: "draft"
    });

  if (error) {
    showMessage("出品申請に失敗しました。", true);
    console.error(error);
    return;
  }

  $("listingForm").reset();

  showMessage("出品情報を下書きとして保存しました。");
  await loadMyListings();
});

// 検索
$("searchButton").addEventListener("click", async () => {
  const keyword = $("searchInput").value.trim().toLowerCase();

  const { data, error } = await supabase
    .from("listings")
    .select("id, title, brand, size, condition, daily_price, image_path")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    showMessage("検索に失敗しました。", true);
    return;
  }

  const filtered = (data || []).filter((item) => {
    const text = `${item.title} ${item.brand || ""}`.toLowerCase();
    return text.includes(keyword);
  });

  renderProducts(filtered);
});

// 認証状態の監視
supabase.auth.onAuthStateChange((_event, session) => {
  updateAuthUI(session?.user || null);
});

// 初期化
async function initialize() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    showMessage("ログイン状態を確認できませんでした。", true);
  }

  updateAuthUI(data?.session?.user || null);
  await loadProducts();
}

initialize();
console.log("WEAR SHARE app.js loaded");

supabase
  .from("listings")
  .select("id")
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error("Supabase connection test failed:", error.message);
      showMessage("データベース接続を確認できませんでした。", true);
    } else {
      console.log("Supabase connection test succeeded:", data);
      showMessage("データベースとの接続に成功しました。");
    }
  });

