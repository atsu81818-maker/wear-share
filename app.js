
import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

import { supabaseConfig } from "./config.js";

const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey
);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let authMessageTimer = null;

const REDIRECT_URL =
  "https://atsu81818-maker.github.io/wear-share/";

// メッセージ表示
function showMessage(message, isError = false) {
  const element = $("authMessage");

  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#e07878" : "#d8c7a0";

  clearTimeout(authMessageTimer);

  authMessageTimer = setTimeout(() => {
    if (element.textContent === message) {
      element.textContent = "";
    }
  }, 10000);
}

// ログイン状態に合わせて画面を切り替える
function updateAuthUI(user) {
  currentUser = user;

  $("authArea").classList.toggle("hidden", !!user);
  $("profileArea").classList.toggle("hidden", !user);

  $("listingFormArea").classList.toggle("hidden", !user);

  $("userEmail").textContent = user
    ? user.email || ""
    : "";

  if (user) {
    loadMyListings();
  } else {
    $("myListings").replaceChildren();
  }
}

// ボタンの送信状態
function setButtonLoading(button, loading, normalText, loadingText) {
  button.disabled = loading;
  button.textContent = loading ? loadingText : normalText;
}

// 会員登録
$("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const displayName = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const button = event.submitter;

  if (!displayName || !email || password.length < 8) {
    showMessage("入力内容を確認してください。", true);
    return;
  }

  if (button) {
    setButtonLoading(button, true, "会員登録する →", "登録中...");
  }

  showMessage("会員登録中...");

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: REDIRECT_URL,
        data: {
          display_name: displayName
        }
      }
    });

    if (error) {
      console.error("Signup error:", error.message);
      showMessage(
        "会員登録できませんでした。入力内容を確認してください。",
        true
      );
      return;
    }

    if (data.session) {
      showMessage("会員登録が完了しました。");
    } else {
      $("resendEmail").value = email;

      showMessage(
        "確認メールを送信しました。メールを確認してください。"
      );
    }

  } catch (error) {
    console.error(error);
    showMessage("通信エラーが発生しました。", true);

  } finally {
    if (button) {
      setButtonLoading(
        button,
        false,
        "会員登録する →",
        "登録中..."
      );
    }
  }
});

// 確認メールの再送信
$("resendForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("resendEmail").value.trim();
  const button = $("resendButton");

  if (!email) {
    showMessage("メールアドレスを入力してください。", true);
    return;
  }

  setButtonLoading(
    button,
    true,
    "確認メールを再送信",
    "送信中..."
  );

  showMessage("確認メールを再送信しています...");

  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: REDIRECT_URL
      }
    });

    if (error) {
      console.error("Resend error:", error.message);

      showMessage(
        "再送信できませんでした。時間をおいて再度お試しください。",
        true
      );
      return;
    }

    showMessage(
      "再送信処理を受け付けました。メールボックスを確認してください。"
    );

  } catch (error) {
    console.error(error);
    showMessage("通信エラーが発生しました。", true);

  } finally {
    setButtonLoading(
      button,
      false,
      "確認メールを再送信",
      "送信中..."
    );
  }
});

// ログイン
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const button = event.submitter;

  if (button) {
    setButtonLoading(button, true, "ログイン →", "ログイン中...");
  }

  showMessage("ログイン中...");

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error("Login error:", error.message);

      showMessage(
        "ログインできませんでした。メールアドレスとパスワードを確認してください。",
        true
      );
      return;
    }

    showMessage("ログインしました。");

  } catch (error) {
    console.error(error);
    showMessage("通信エラーが発生しました。", true);

  } finally {
    if (button) {
      setButtonLoading(button, false, "ログイン →", "ログイン中...");
    }
  }
});

// ログアウト
$("logoutButton").addEventListener("click", async () => {
  const button = $("logoutButton");

  button.disabled = true;

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      showMessage("ログアウトに失敗しました。", true);
      return;
    }

    showMessage("ログアウトしました。");

  } catch (error) {
    console.error(error);
    showMessage("通信エラーが発生しました。", true);

  } finally {
    button.disabled = false;
  }
});

// 商品一覧の取得
async function loadProducts() {
  const container = $("productList");

  container.innerHTML =
    '<p class="empty-message">商品を読み込んでいます...</p>';

  const { data, error } = await supabase
    .from("listings")
    .select("id, title, brand, size, condition, daily_price, image_path")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Product load error:", error);

    container.innerHTML =
      '<p class="empty-message">商品を読み込めませんでした。</p>';

    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML =
      '<p class="empty-message">現在、公開中の商品はありません。</p>';

    return;
  }

  renderProducts(data);
}

// 商品表示
function renderProducts(products) {
  const container = $("productList");

  container.replaceChildren();

  if (!products.length) {
    container.innerHTML =
      '<p class="empty-message">該当する商品がありません。</p>';
    return;
  }

  products.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.style.animationDelay = `${Math.min(index * 0.08, 0.4)}s`;

    const image = document.createElement("img");
    image.alt = product.title || "商品画像";
    image.loading = "lazy";

    if (product.image_path) {
      image.src = product.image_path;
    } else {
      image.style.display = "none";
    }

    const info = document.createElement("div");
    info.className = "product-info";

    const title = document.createElement("h3");
    title.textContent = product.title || "商品名未設定";

    const brand = document.createElement("p");
    brand.textContent = product.brand || "ブランド未設定";

    const size = document.createElement("p");
    size.textContent = "サイズ：" + (product.size || "未設定");

    const condition = document.createElement("p");
    condition.textContent = "状態：" + (product.condition || "未設定");

    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent =
      "¥" +
      Number(product.daily_price).toLocaleString("ja-JP") +
      " / 日";

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
    console.error("My listings error:", error);

    container.textContent =
      "出品一覧を取得できませんでした。";

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

  const button = event.submitter;

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

  if (button) {
    setButtonLoading(
      button,
      true,
      "出品情報を保存する →",
      "保存中..."
    );
  }

  showMessage("出品申請を送信しています...");

  try {
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
      console.error("Listing error:", error);

      showMessage(
        "出品申請に失敗しました。入力内容を確認してください。",
        true
      );

      return;
    }

    $("listingForm").reset();

    showMessage("出品情報を下書きとして保存しました。");

    await loadMyListings();

  } catch (error) {
    console.error(error);
    showMessage("通信エラーが発生しました。", true);

  } finally {
    if (button) {
      setButtonLoading(
        button,
        false,
        "出品情報を保存する →",
        "保存中..."
      );
    }
  }
});

// 商品検索
$("searchButton").addEventListener("click", async () => {
  const keyword = $("searchInput").value.trim().toLowerCase();
  const button = $("searchButton");

  button.disabled = true;
  button.textContent = "検索中...";

  try {
    const { data, error } = await supabase
      .from("listings")
      .select("id, title, brand, size, condition, daily_price, image_path")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      showMessage("検索に失敗しました。", true);
      return;
    }

    const filtered = (data || []).filter((item) => {
      const text =
        `${item.title || ""} ${item.brand || ""}`.toLowerCase();

      return text.includes(keyword);
    });

    renderProducts(filtered);

  } catch (error) {
    console.error(error);
    showMessage("通信エラーが発生しました。", true);

  } finally {
    button.disabled = false;
    button.textContent = "SEARCH";
  }
});

// Enterキーでも検索できるようにする
$("searchInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    $("searchButton").click();
  }
});

// 認証状態の監視
supabase.auth.onAuthStateChange((_event, session) => {
  updateAuthUI(session?.user || null);
});

// 初期化
async function initialize() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    showMessage("ログイン状態を確認できませんでした。", true);
  }

  updateAuthUI(data?.session?.user || null);

  await loadProducts();

  console.log("WEAR SHARE initialized.");
}

initialize();
async function testDatabaseConnection() {
  console.log("データベース接続テスト開始");

  const { data, error } = await supabase
    .from("listings")
    .select("id")
    .limit(1);

  if (error) {
    console.error("データベース接続失敗:", error);
    alert("接続失敗: " + error.message);
    return;
  }

  console.log("データベース接続成功:", data);
  alert("データベース接続成功！");
}

testDatabaseConnection();