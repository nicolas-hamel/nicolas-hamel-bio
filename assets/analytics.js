/* GA4 measurement for the public EN/FR website. */
(function () {
  'use strict';
  if (window.__nhAnalyticsLoaded || !['nicolas-hamel.africa', 'www.nicolas-hamel.africa'].includes(location.hostname)) return;
  window.__nhAnalyticsLoaded = true;
  var measurementId = 'G-0WCF4KZ70Z';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  document.head.appendChild(tag);

  function trackLink(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var url;
    try { url = new URL(link.href, location.href); } catch (_) { return; }
    var name, parameters = {
      send_to: measurementId,
      page_path: location.pathname,
      content_language: document.documentElement.lang === 'fr' ? 'fr' : 'en'
    };
    if (url.protocol === 'mailto:') {
      name = 'email_contact_click';
      parameters.contact_method = 'email';
    } else if ((url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com')) && /^\/in\/nicolas-hamel\/?$/.test(url.pathname)) {
      name = 'linkedin_contact_click';
      parameters.contact_method = 'linkedin';
    } else if (url.origin === location.origin && /^\/assets\/customer-references\/[^/]+\.pdf$/i.test(url.pathname)) {
      name = 'customer_reference_click';
      parameters.file_name = url.pathname.split('/').pop();
      parameters.file_extension = 'pdf';
    } else return;
    // Never send mailto recipients, subjects, message bodies or link query strings.
    // Record intent without interrupting navigation; these are not completed enquiries.
    window.gtag('event', name, parameters);
  }
  document.addEventListener('click', trackLink);
  document.addEventListener('auxclick', trackLink);
})();
