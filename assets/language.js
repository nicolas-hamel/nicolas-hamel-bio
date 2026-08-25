(function () {
  "use strict";

  var storageKey = "nicolas-hamel-language";
  var currentLanguage = (document.documentElement.lang || "en").toLowerCase().slice(0, 2);
  var alternateFrench = document.querySelector('link[rel="alternate"][hreflang="fr"]');

  function readPreference() {
    try {
      return window.localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  }

  function savePreference(language) {
    try {
      window.localStorage.setItem(storageKey, language);
    } catch (error) {
      /* Language selection still works when storage is unavailable. */
    }
  }

  document.querySelectorAll("[data-language-choice]").forEach(function (link) {
    link.addEventListener("click", function () {
      savePreference(link.getAttribute("data-language-choice"));
    });
  });

  var savedPreference = readPreference();
  var isEnglishHome = currentLanguage === "en" && (location.pathname === "/" || location.pathname === "/index.html");

  if (savedPreference === "fr" && isEnglishHome && alternateFrench) {
    location.replace(alternateFrench.href + location.search + location.hash);
    return;
  }

  if (currentLanguage !== "en" || savedPreference || !alternateFrench) {
    return;
  }

  var browserLanguages = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || ""];
  var prefersFrench = String(browserLanguages[0] || "").toLowerCase().startsWith("fr");

  if (!prefersFrench) {
    return;
  }

  var suggestion = document.createElement("aside");
  suggestion.className = "language-suggestion";
  suggestion.setAttribute("role", "region");
  suggestion.setAttribute("aria-label", "Sélection de la langue");
  suggestion.innerHTML =
    '<p><strong>Ce site est disponible en français.</strong>' +
    'Vous pouvez consulter la version française de cette page.</p>' +
    '<div class="language-suggestion-actions">' +
    '<a href="' + alternateFrench.href + '" lang="fr" hreflang="fr" data-language-choice="fr">Passer en français</a>' +
    '<button type="button">Continuer en anglais</button>' +
    '</div>';

  suggestion.querySelector('[data-language-choice="fr"]').addEventListener("click", function () {
    savePreference("fr");
  });
  suggestion.querySelector("button").addEventListener("click", function () {
    savePreference("en");
    suggestion.remove();
  });
  document.body.appendChild(suggestion);
})();
