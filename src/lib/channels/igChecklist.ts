// The Meta App Review checklist shown in Admin (plan 8.19). Safe for the browser. Read on 21 Nov 2026
// from the pages linked on each item. Meta's review can take weeks, so it is started as soon as an
// account exists; for your own account Standard Access may be all you need (see the first item).

export type CheckItem = { key: string; text: string; detail: string; links: { label: string; url: string }[] };

const OVERVIEW = "https://developers.facebook.com/documentation/instagram-platform/overview";
const PUBLISH = "https://developers.facebook.com/documentation/instagram-platform/content-publishing";
const COMMENTS = "https://developers.facebook.com/documentation/instagram-platform/comment-moderation";
const LOGIN = "https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login";
const REVIEW = "https://developers.facebook.com/documentation/resp-plat-initiatives/individual-processes/app-review";
const VERIFY = "https://developers.facebook.com/documentation/development/release/business-verification";
const ACCESS = "https://developers.facebook.com/documentation/development/graph-api/overview/access-levels";

export const IG_CHECKLIST: CheckItem[] = [
  {
    key: "access-level",
    text: "Decide which access level you need",
    detail:
      "Meta says Standard Access is enough when the app only serves your own Instagram professional account or one you manage and have added to the app. Advanced Access, which needs App Review and Business Verification, is for accounts you do not own or manage.",
    links: [{ label: "Instagram Platform overview, access levels", url: OVERVIEW }, { label: "Access levels", url: ACCESS }],
  },
  {
    key: "professional-account",
    text: "Make the Instagram account a professional account (Business or Creator)",
    detail: "The API works only with professional accounts. A Page that requires Page Publishing Authorization must complete it before anything can be published.",
    links: [{ label: "Content publishing requirements", url: PUBLISH }],
  },
  {
    key: "meta-app",
    text: "Create a Meta app with the Instagram API with Instagram Login product",
    detail: "Add the Instagram account to the app, then generate an access token for it in the App Dashboard. Paste the token and the account ID into the Instagram card above.",
    links: [{ label: "Business Login for Instagram", url: LOGIN }],
  },
  {
    key: "permissions",
    text: "Request the three permissions this app uses",
    detail: "instagram_business_basic (read the account), instagram_business_content_publish (publish posts), instagram_business_manage_comments (read comments and reply).",
    links: [{ label: "Content publishing permissions", url: PUBLISH }, { label: "Comment moderation permissions", url: COMMENTS }],
  },
  {
    key: "app-review",
    text: "For Advanced Access: submit each permission for App Review",
    detail:
      "Meta asks for a description of how each permission is used and a screen recording of the app using it. Reviewers must be able to test the app: one that is only on a private network cannot be tested, which limits what can be approved.",
    links: [{ label: "Meta App Review", url: REVIEW }],
  },
  {
    key: "business-verification",
    text: "For Advanced Access: complete Business Verification",
    detail: "Required for Advanced Access, when people without a role on the app use it.",
    links: [{ label: "Business Verification", url: VERIFY }],
  },
  {
    key: "public-images",
    text: "Plan where post images will be hosted",
    detail:
      "Instagram fetches each image from a public https address at the moment of publishing, and only JPEG is accepted. This app is behind sign-in and may run on a machine with no public address, so each post needs the address of a copy you host elsewhere (your website, a storage bucket, a CDN).",
    links: [{ label: "Media on a public server", url: PUBLISH }],
  },
];
