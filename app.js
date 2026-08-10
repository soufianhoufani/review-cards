(function () {
  const config = window.ACTIVATION_CONFIG || {};
  const client = window.supabase?.createClient(config.supabaseUrl, config.supabaseAnonKey);

  const params = new URLSearchParams(window.location.search);
  const cardToken = params.get("card");

  const elements = {
    loading: document.getElementById("loadingState"),
    missing: document.getElementById("missingState"),
    notFound: document.getElementById("notFoundState"),
    form: document.getElementById("activationForm"),
    activated: document.getElementById("activatedState"),
    pageTitle: document.getElementById("pageTitle"),
    button: document.getElementById("submitButton"),
    message: document.getElementById("formMessage"),
    targetUrl: document.getElementById("targetUrl"),
    businessName: document.getElementById("businessName"),
    manualLink: document.getElementById("manualLink")
  };

  function show(name) {
    document.body.classList.toggle("booting", name === "loading");

    const titles = {
      loading: "",
      missing: "Aktivera ditt kort",
      notFound: "Kortet hittades inte",
      form: "Aktivera ditt kort",
      activated: "Kortet ar aktiverat"
    };

    if (elements.pageTitle) {
      elements.pageTitle.textContent = titles[name] || "";
      elements.pageTitle.hidden = name === "loading";
    }

    ["loading", "missing", "notFound", "form", "activated"].forEach((key) => {
      elements[key].classList.toggle("hidden", key !== name);
    });
  }

  function normalizeUrl(value) {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).href;
  }

  function redirectTo(url, immediate = false) {
    if (immediate) {
      window.location.replace(url);
      return;
    }

    elements.manualLink.href = url;
    show("activated");
    window.setTimeout(() => {
      window.location.href = url;
    }, config.redirectDelayMs || 700);
  }

  async function loadCard() {
    if (!cardToken) {
      show("missing");
      return;
    }

    if (!client || config.supabaseUrl.includes("DIN-") || config.supabaseAnonKey.includes("DIN-")) {
      elements.message.textContent = "Supabase är inte konfigurerat ännu.";
      show("form");
      return;
    }

    const { data, error } = await client
      .rpc("get_or_activate_review_card", {
        card_token: cardToken,
        new_destination_url: null,
        new_business_name: null
      });

    if (error) {
      elements.message.textContent = "Kunde inte kontrollera kortet. Försök igen.";
      show("form");
      return;
    }

    const card = Array.isArray(data) ? data[0] : data;

    if (!card || card.status === "not_found") {
      show("notFound");
      return;
    }

    if (card.status === "active" && card.destination_url) {
      redirectTo(card.destination_url, true);
      return;
    }

    show("form");
  }

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.message.textContent = "";
    elements.button.disabled = true;

    let destinationUrl;
    try {
      destinationUrl = normalizeUrl(elements.targetUrl.value);
    } catch {
      elements.message.textContent = "Skriv in en giltig länk.";
      elements.button.disabled = false;
      return;
    }

    const { data, error } = await client
      .rpc("get_or_activate_review_card", {
        card_token: cardToken,
        new_destination_url: destinationUrl,
        new_business_name: elements.businessName.value.trim() || null
      });

    elements.button.disabled = false;

    if (error) {
      elements.message.textContent = "Kunde inte aktivera kortet. Försök igen.";
      return;
    }

    const card = Array.isArray(data) ? data[0] : data;

    if (!card || card.status === "not_found") {
      show("notFound");
      return;
    }

    if (card.status !== "active" || !card.destination_url) {
      elements.message.textContent = "Kortet verkar redan vara aktiverat.";
      return;
    }

    redirectTo(card.destination_url);
  });

  loadCard();
})();
