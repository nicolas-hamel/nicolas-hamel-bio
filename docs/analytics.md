# Website analytics

Installed 25 September 2026. GA4 web measurement ID: G-0WCF4KZ70Z.

One shared /assets/analytics.js script on all 36 EN/FR HTML pages. Runs only on the production domain. Standard gtag config generates page views; no second manual page_view is sent. Google signals and advertising personalisation signals are disabled.

Custom events:
- email_contact_click: activation of a mailto link; no recipient, subject or body sent in custom parameters.
- linkedin_contact_click: activation of Nicolas Hamel's LinkedIn profile link (not post/document links).
- customer_reference_click: activation of a same-origin customer-reference PDF link; file_name and file_extension identify the reference.

Each custom event includes page_path and content_language. Clicks measure intent, not sent emails, completed downloads or qualified leads. GA4 Enhanced Measurement may additionally record generic outbound click/file_download events; do not sum those with the custom events as independent actions.

In GA4, use Realtime to check receipt, and register content_language as an event-scoped custom dimension if needed in reports. Mark the two contact-click events as key events if desired, retaining their intent-based names. Keep actual enquiries and qualification in the CRM. Measurement starts after installation, with no historical backfill. Blocking extensions or visitor settings can prevent collection.

The repository cannot verify the Analytics property's reports or settings. Confirm reception in the owning GA4 account. No credentials or Measurement Protocol API secret are needed for the web tag.
